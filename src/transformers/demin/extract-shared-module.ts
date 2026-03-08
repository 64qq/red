import { CallExpression, type Node, printNode, SyntaxKind, ts, VariableDeclarationKind } from "ts-morph"
import { type Export, type FileReplacement, isStringLiteralLike, performFileReplacements, unwrapIIFE } from "./utils.ts"
import * as path from "@std/path"
import type { Transformer } from "../mod.ts"
import { asValidIdentifierName } from "./ecma.ts"

export const extractSharedModule: Transformer = ({ project, entryFile, cwd, overwrite }) => {
  const sharedModuleSource = entryFile.getVariableDeclarationOrThrow("__dcg_shared_module_source__")
  const sharedModuleExports = entryFile.getVariableDeclarationOrThrow("__dcg_shared_module_exports__")
  const sharedModuleSourceStr = sharedModuleSource
    .getInitializerIfKind(SyntaxKind.StringLiteral)
    ?.getLiteralText()
  if (!sharedModuleSourceStr) {
    throw new Error("Expected the '__dcg_shared_module_exports__' initializer to be of kind StringLiteral.")
  }

  const sharedJs = project.createSourceFile(
    path.join(cwd, "shared.js"),
    sharedModuleSourceStr,
    { overwrite },
  )
  unwrapIIFE(sharedJs)
  const sharedModuleChunkExports = sharedJs.getVariableDeclarationOrThrow("__dcg_chunk_exports__")
  const namedExports: Export[] = []
  sharedModuleChunkExports.findReferencesAsNodes().forEach((ref) => {
    const parent = ref.getParent()
    if (!parent) return
    if (parent.isKind(SyntaxKind.CallExpression)) {
      const chunk = extractSharedModuleChunks(ref, parent)
      if (!chunk) return
      namedExports.push(chunk)
      parent.getParentIfKind(SyntaxKind.ExpressionStatement)?.remove()
    } else if (parent.isKind(SyntaxKind.ReturnStatement)) {
      parent.remove()
    }
  })
  if (!namedExports.length) throw new Error("Couldn't find any exported shared module chunks.")

  const sharedJsExports = sharedJs.addExportDeclaration({ namedExports }).getNamedExports()
  sharedModuleSource.getVariableStatementOrThrow().setDeclarationKind(VariableDeclarationKind.Let)
  sharedModuleSource.removeInitializer()
  sharedModuleExports.setInitializer('await import("./shared.js")')

  // Convert `namespaceImport["identifier"]` to `namespaceImport.identifier`.
  // The latter (dot notation) can jump to the actual definition directly with Go To Definition,
  // while the former (bracket notation) stops at the export location
  const sharedJsExportReplacements: FileReplacement[] = []
  sharedJsExports.forEach((exportSpecifier) => {
    const exportedNode = exportSpecifier.getAliasNode() ?? exportSpecifier.getNameNode()
    if (exportedNode.isKind(SyntaxKind.StringLiteral)) return
    const identifierName = exportedNode.getText()
    exportedNode.findReferencesAsNodes().forEach((ref) => {
      if (!isStringLiteralLike(ref) || ref.getLiteralText() !== identifierName) return
      const elementAccess = ref.getParentIfKind(SyntaxKind.ElementAccessExpression)
      if (!elementAccess) return
      const propertyAccess = ts.factory.createPropertyAccessExpression(
        elementAccess.getExpression().compilerNode,
        identifierName,
      )
      sharedJsExportReplacements.push({
        start: elementAccess.getStart(),
        end: elementAccess.getEnd(),
        newText: printNode(propertyAccess),
        file: ref.getSourceFile(),
      })
    })
  })
  performFileReplacements(sharedJsExportReplacements)
}

function extractSharedModuleChunks(
  ref: Node,
  parent: CallExpression,
): Export | undefined {
  // `Object.defineProperty(__dcg_chunk_exports__, "alias", { get: () => identifier });`
  const propAccess = parent.getExpressionIfKind(SyntaxKind.PropertyAccessExpression)
  if (propAccess?.getText() !== "Object.defineProperty") return
  const [obj, prop, descriptor] = parent.getArguments()
  const identifier = descriptor
    ?.asKind(SyntaxKind.ObjectLiteralExpression)
    ?.getProperty("get")
    ?.asKind(SyntaxKind.PropertyAssignment)
    ?.getInitializerIfKind(SyntaxKind.ArrowFunction)
    ?.getBody()
    .asKind(SyntaxKind.Identifier)
  if (obj === ref && prop?.isKind(SyntaxKind.StringLiteral) && identifier) {
    return {
      name: identifier.getText(),
      alias: asValidIdentifierName(prop.getLiteralText()) ?? prop.getText(),
    }
  }
}
