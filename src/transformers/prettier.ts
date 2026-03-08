import { format, type Options, resolveConfig } from "prettier"
import type { Transformer } from "./mod.ts"

export const prettier: Transformer = async ({ project, cwd }) => {
  const prettierConfig: Options = {
    parser: "meriyah",
    ...await resolveConfig(cwd),
  }
  await Promise.all(
    project.getSourceFiles().map((sourceFile) => {
      const source = sourceFile.getFullText()
      return format(source, prettierConfig).then(sourceFile.replaceWithText)
    }),
  )
}
