import { type ArgumentValue, Command, Type, ValidationError } from "@cliffy/command"
import { Input, Toggle } from "@cliffy/prompt"
import * as fs from "@std/fs"
import * as path from "@std/path"
import * as v from "valibot"
import { transform } from "./transformers/mod.ts"
import { fetchLatestVersionHash, pull } from "./pull.ts"
import {
  type CmdLineConfig,
  cmdlineConfigKeys,
  Config,
  VersionSchema,
  type VersionSpecifier,
  VersionSpecifierSchema,
  type WorkspaceConfig,
} from "./config.ts"
import { pick, PrimitiveProxy, type StrictObjectEntry, UnimplementedError } from "@utils/utils.ts"
import denoJson from "../deno.json" with { type: "json" }

class VersionOrURL extends Type<string> {
  private static readonly urlRegex =
    /^https?:\/\/(?:www\.)?desmos\.com\/assets\/build\/shared_calculator_desktop-(.*)\.js$/

  private static readonly schema = v.union([
    VersionSpecifierSchema,
    v.pipe(
      v.string(),
      v.transform((input) => {
        if (!URL.canParse(input)) return undefined
        return this.urlRegex.exec(input.trim())?.[1]
      }),
      VersionSchema,
    ),
  ])

  public parse({ label, name, value }: ArgumentValue): VersionSpecifier {
    const { success, output } = v.safeParse(VersionOrURL.schema, value)
    if (!success) {
      throw new ValidationError(
        `${label} "${name}" must be a valid version (hash) or "latest", but got ${Deno.inspect(value)}.`,
      )
    }
    return output
  }
}

const defaultEntryFileName = (hash: string) => `shared_calculator_desktop-${hash}.js`

export const command = new Command()
  .name("red")
  .version(denoJson.version)
  .description("Reverse engineering tools for Desmos")
  .action(function () {
    this.showHelp()
  })
  .command("demin", "Deminify a file to a directory.")
  .option("-i, --input <path:string>", "Input file", {
    required: true,
    conflicts: ["workspace"],
  })
  .option("-o, --outdir <path:string>", "Output directory", {
    required: true,
    conflicts: ["workspace"],
  })
  .option("--overwrite", "Overwrite the input", {
    default: false,
    conflicts: ["workspace"],
  })
  .option("-w, --workspace <path:string>", "Run this command in a workspace")
  .option("--prettier [flag:boolean]", "Run prettier on the output", { default: true })
  .action(() => {
    throw new UnimplementedError()
  })
  .command("pull", "Fetch the source code from Desmos.")
  .type("version", new VersionOrURL())
  .arguments("[version-or-url:version]")
  .option(
    "-o, --outdir <path:string>",
    "Output directory. You can use {version} as a placeholder for the version hash",
    {
      required: true,
      conflicts: ["workspace"],
    },
  )
  .option("--overwrite", "Overwrite the input", {
    default: false,
    conflicts: ["workspace"],
  })
  .option(
    "-w, --workspace <path:string>",
    "Run this command in a workspace. You can use {version} as a placeholder for the version hash",
  )
  .option("-p, --pin [flag:boolean]", "Whether to pull the latest source code or pin the version", {
    default: new PrimitiveProxy(Config.defaults.pin),
    // defaultText: Config.defaults.pin,
    depends: ["workspace"],
  })
  .option("--prettier [flag:boolean]", "Run prettier on the output", {
    default: new PrimitiveProxy(Config.defaults.prettier),
  })
  .option("--demin [flag:boolean]", "Run demin on the output", {
    default: new PrimitiveProxy(Config.defaults.demin),
  })
  .action(async (opts, version = "latest") => {
    const resolvedHash = version === "latest" ? await fetchLatestVersionHash() : version
    // drop defaults
    const cmdLineConfig: CmdLineConfig = pick(
      opts,
      (entry): entry is StrictObjectEntry<Required<CmdLineConfig>> =>
        cmdlineConfigKeys.includes(entry[0]) && !(entry[1] instanceof PrimitiveProxy),
    )
    const source = pull(resolvedHash)
    if (opts.workspace) {
      const configFilePath = await Config.resolveConfigFile(Deno.cwd())
        .then(async (filePath) => {
          if (filePath) return filePath
          const createNew = await Toggle.prompt("No configuration files found. Would you like to create a new one?")
          if (!createNew) Deno.exit(0)
          const newFilePath = await Input.prompt({
            message: `Where should the file (${Config.configFileName}) be saved?`,
            default: ".",
          }).then((dir) => path.resolve(dir, Config.configFileName))
          await Config.saveToFile(newFilePath, Config.defaultConfig, { createNew: true })
          return newFilePath
        })
      const config = new Config(configFilePath)
      const globalConfig = config.getGlobalConfig()

      const workspace = path.resolve(Deno.cwd(), opts.workspace.replace("{version}", resolvedHash))
      const _workspaceConfig = config.getWorkspaceConfig(workspace)
      if (_workspaceConfig) {
        if (_workspaceConfig.version === resolvedHash && version === "latest") {
          console.log("No updates available")
          Deno.exit(0)
        }
        if (_workspaceConfig.pin) {
          throw new Error("Cannot update pinned version")
        }
        _workspaceConfig.version = resolvedHash
      }
      const workspaceConfig: WorkspaceConfig = _workspaceConfig ??
        await Toggle.prompt("No matching workspaces found. Would you like to create a new one?")
          .then((createNew) => {
            if (!createNew) Deno.exit(0)
            return config.addWorkspace({
              path: path.relative(path.dirname(configFilePath), workspace),
              version: resolvedHash,
              ...cmdLineConfig,
            })
          })
      const mergedConfig = {
        ...Config.defaults,
        ...globalConfig,
        ...workspaceConfig,
        ...cmdLineConfig,
      }

      const files = await transform(await source, defaultEntryFileName(resolvedHash), {
        cwd: workspace,
        demin: mergedConfig.demin,
        prettier: mergedConfig.prettier,
        overwrite: true,
        beforeSave: async () => {
          if (!workspaceConfig.files) return
          await Promise.all(
            workspaceConfig.files.map((file) => Deno.remove(path.resolve(workspace, file))),
          )
        },
      })
      workspaceConfig.files = files
      await config.save()
    } else {
      const configFilePath = await Config.resolveConfigFile(Deno.cwd())
      const globalConfig = configFilePath ? new Config(configFilePath).getGlobalConfig() : null
      const mergedConfig = {
        ...Config.defaults,
        ...globalConfig,
        ...cmdLineConfig,
      }

      if (!opts.outdir) throw new Error('Missing required option "--output".')
      const outdir = path.resolve(Deno.cwd(), opts.outdir.replace("{version}", resolvedHash))
      await fs.ensureDir(outdir)

      await transform(await source, defaultEntryFileName(resolvedHash), {
        cwd: outdir,
        demin: mergedConfig.demin,
        prettier: mergedConfig.prettier,
        overwrite: opts.overwrite,
      })
    }
  })

if (import.meta.main) await command.parse(Deno.args)
