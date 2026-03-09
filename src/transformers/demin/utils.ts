import {
  type ExportSpecifierStructure,
  Node,
  type OptionalKind,
  SourceFile,
  type StringLiteralLike,
  SyntaxKind,
} from "ts-morph"
import { tryAny } from "@utils/utils.ts"

export function asFunctionOrThrow(node: Node) {
  return tryAny(
    () => node.asKindOrThrow(SyntaxKind.ArrowFunction),
    () => node.asKindOrThrow(SyntaxKind.FunctionExpression),
  )
}

export function isStringLiteralLike(node: Node): node is StringLiteralLike {
  return node.isKind(SyntaxKind.StringLiteral) || node.isKind(SyntaxKind.NoSubstitutionTemplateLiteral)
}

export function unwrapIIFE(sourceFile: SourceFile) {
  const iife = sourceFile.getStatementByKindOrThrow(SyntaxKind.ExpressionStatement)
  const func = iife
    .getExpressionIfKindOrThrow(SyntaxKind.CallExpression)
    .getExpressionIfKindOrThrow(SyntaxKind.ParenthesizedExpression)
    .getExpression()
  const block = asFunctionOrThrow(func).getBody().asKindOrThrow(SyntaxKind.Block)
  const openBrace = block.getFirstChildIfKindOrThrow(SyntaxKind.OpenBraceToken)
  const closeBrace = block.getLastChildIfKindOrThrow(SyntaxKind.CloseBraceToken)
  // include leading & trailing trivia
  const funcBody = sourceFile.getFullText().slice(openBrace.getEnd(), closeBrace.getStart())

  iife.remove()
  return sourceFile.addStatements(funcBody)
}

export interface Replacement {
  start: number
  end: number
  newText: string
}

// https://ts-morph.com/manipulation/performance#performance-tip-batch-operations
export function applyReplacements(
  source: string,
  replacements: readonly Replacement[],
): string {
  return replacements.toSorted((a, b) => b.start - a.start).reduce(
    (acc, { start, end, newText }) => acc.slice(0, start) + newText + acc.slice(end),
    source,
  )
}

export function commitReplacements(file: SourceFile, replacements: readonly Replacement[]) {
  file.replaceWithText(applyReplacements(file.getFullText(), replacements))
}

export interface FileReplacement extends Replacement {
  file: SourceFile
}

export function commitFileReplacements(
  fileReplacements: readonly FileReplacement[],
): void {
  Map.groupBy(fileReplacements, ({ file }) => file)
    .forEach((replacements, file) => commitReplacements(file, replacements))
}

export type Export = OptionalKind<ExportSpecifierStructure>
