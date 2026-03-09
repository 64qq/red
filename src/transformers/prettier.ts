import { format, type Options, resolveConfig } from "prettier"
import type { Transformer } from "./mod.ts"

export const prettier: Transformer = async ({ project, cwd }) => {
  const prettierConfig: Options = {
    parser: "meriyah",
    ...await resolveConfig(cwd),
  }
  await Promise.all(
    project.getSourceFiles().map(async (sourceFile) => {
      const source = sourceFile.getFullText()
      const formatted = await format(source, prettierConfig)
      return sourceFile.replaceWithText(formatted)
    }),
  )
}
