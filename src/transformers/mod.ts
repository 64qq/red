import { Project, SourceFile } from "ts-morph"
import * as path from "@std/path"
import { demin } from "./demin/mod.ts"
import { prettier } from "./prettier.ts"
import type { MaybePromise } from "@utils/utils.ts"

export interface TransformContext {
  readonly project: Project
  readonly entryFile: SourceFile
  readonly cwd: string
  readonly overwrite: boolean
}

export type Transformer = (context: TransformContext) => void | Promise<void>

export async function transform(
  source: string,
  entryFileName: string,
  opts: Readonly<{
    cwd: string
    demin: boolean
    prettier: boolean
    overwrite: boolean
    beforeSave?: () => MaybePromise<void>
  }>,
) {
  const project = new Project({
    compilerOptions: {
      allowJs: true,
      checkJs: true,
      strict: false,
      noImplicitAny: false,
    },
  })
  const entryFile = project.createSourceFile(
    path.join(opts.cwd, entryFileName),
    source,
    { overwrite: opts.overwrite },
  )
  const context: TransformContext = {
    project,
    entryFile,
    cwd: opts.cwd,
    overwrite: opts.overwrite,
  }
  if (opts.demin) await demin(context)
  if (opts.prettier) await prettier(context)

  await opts.beforeSave?.()
  await project.save()
  return project.getSourceFiles().map((file) => path.relative(opts.cwd, file.getFilePath()))
}
