import * as v from "valibot"
import * as path from "@std/path"
import * as prettier from "prettier"
import { catchIf, pick } from "@utils/utils.ts"

export const VersionSchema = v.pipe(
  v.string(),
  v.hash(["sha1"]),
  v.description("SHA-1 hash string in the source file name."),
)
export const VersionSpecifierSchema = v.union([
  v.literal("latest"),
  VersionSchema,
]) satisfies v.GenericSchema<VersionSpecifier>
// deno-lint-ignore ban-types
export type VersionSpecifier = "latest" | string & {}

export const GlobalConfigSchema = v.strictObject({
  demin: v.exactOptional(v.pipe(v.boolean(), v.description("Whether to run demin on the output."))),
  prettier: v.exactOptional(v.pipe(v.boolean(), v.description("Whether to run prettier on the output."))),
})

export type GlobalConfig = v.InferOutput<typeof GlobalConfigSchema>

export const globalConfigKeys = v.keyof(GlobalConfigSchema).options

export const CmdLineConfigSchema = v.strictObject({
  ...GlobalConfigSchema.entries,
  pin: v.exactOptional(v.pipe(
    v.boolean(),
    v.description("Whether to pull the latest source code or pin the version."),
  )),
})

export const cmdlineConfigKeys = v.keyof(CmdLineConfigSchema).options

export type CmdLineConfig = v.InferOutput<typeof CmdLineConfigSchema>

export const WorkspaceConfigSchema = v.strictObject({
  ...CmdLineConfigSchema.entries,
  path: v.pipe(v.string(), v.description("Workspace directory path.")),
  version: VersionSchema,
  files: v.exactOptional(v.pipe(
    v.array(v.string()),
    v.description("List of file paths to be tracked."),
  )),
})

export type WorkspaceConfig = v.InferOutput<typeof WorkspaceConfigSchema>

export const ConfigSchema = v.strictObject({
  $schema: v.exactOptional(v.pipe(v.string(), v.description("The schema to verify this document against."))),
  ...GlobalConfigSchema.entries,
  workspaces: v.exactOptional(v.pipe(
    v.array(WorkspaceConfigSchema),
    v.description("Separate workspaces for managing different versions of source code."),
  )),
})

type ConfigEntriesWithMeta = v.InferOutput<typeof ConfigSchema>
export type ConfigEntries = Omit<ConfigEntriesWithMeta, "$schema">

export class Config {
  private filePath: string
  private source: string

  private readonly entries: ConfigEntries

  constructor(filePath: string) {
    this.filePath = filePath
    this.source = Deno.readTextFileSync(filePath)
    this.entries = v.parse(v.pipe(v.string(), v.parseJson(), ConfigSchema), this.source)
  }

  getGlobalConfig(): GlobalConfig {
    return pick(this.entries, globalConfigKeys)
  }

  getWorkspaceConfig(workspace: string): WorkspaceConfig | undefined {
    const resolved = path.resolve(workspace)
    return this.entries.workspaces?.find((w) => path.resolve(path.dirname(this.filePath), w.path) === resolved)
  }

  addWorkspace(config: WorkspaceConfig): WorkspaceConfig {
    return (this.entries.workspaces ??= []).push(config), config
  }

  async save() {
    await Config.saveToFile(this.filePath, this.entries)
  }

  static readonly defaultConfig: ConfigEntriesWithMeta = {
    // "$schema": "TODO",
  }

  static readonly defaults: Required<CmdLineConfig> = {
    pin: false,
    prettier: true,
    demin: false,
  }

  static readonly configFileName = "red.json"

  static async saveToFile(filePath: string, entries: ConfigEntriesWithMeta, options?: Deno.WriteFileOptions) {
    const prettierConfig = await prettier.resolveConfig(filePath, { editorconfig: true })
    await Deno.writeTextFile(
      filePath,
      await prettier.format(JSON.stringify(entries), { ...prettierConfig, parser: "json" }),
      options,
    )
  }

  private static async _resolveConfigFile(dir: string): Promise<string | null> {
    const filePath = path.join(dir, this.configFileName)
    const info = await Deno.stat(filePath).catch(
      catchIf(() => null, [Deno.errors.NotFound, Deno.errors.PermissionDenied]),
    )
    if (info?.isFile) return filePath
    const parentDir = path.dirname(dir)
    return parentDir !== dir ? this._resolveConfigFile(parentDir) : null
  }

  static async resolveConfigFile(dir: string) {
    const realDir = await Deno.realPath(dir).catch(catchIf(() => null, [Deno.errors.NotFound]))
    return realDir && this._resolveConfigFile(realDir)
  }
}
