import { Expression, Node, SyntaxKind, VariableDeclaration, VariableDeclarationKind } from "ts-morph"
import { type Export, isStringLiteralLike, unwrapIIFE } from "./utils.ts"
import * as path from "@std/path"
import type { Transformer } from "../mod.ts"

export const extractWorkerModule: Transformer = ({ project, entryFile, cwd, overwrite }) => {
  const workerSourceExports = entryFile.getVariableDeclarationOrThrow("__dcg_worker_source_exports__")
  const workerSourceExportsIIFE = workerSourceExports.getInitializerIfKindOrThrow(SyntaxKind.CallExpression)
  const workerJs = project.createSourceFile(
    path.join(cwd, "worker.js"),
    workerSourceExportsIIFE.getFullText(),
    { overwrite },
  )
  unwrapIIFE(workerJs)
  const workerSource = workerJs.getVariableDeclarationOrThrow("__dcg_worker_source__")
  const workerSourceInitializer = workerSource.getInitializerIfKindOrThrow(SyntaxKind.BinaryExpression)
  const workerSourceStr = evalStringConcat(workerSourceInitializer, (node) => {
    const identifier = node.asKindOrThrow(SyntaxKind.Identifier).getText()
    if (identifier !== "__dcg_shared_module_source__") {
      throw new Error(`Unexpected identifier ${identifier} in the '__dcg_worker_source__' initializer.`)
    }
    return 'await import("./shared.js")'
  })
  const workerSourceJs = project.createSourceFile(
    path.join(cwd, "worker_source.js"),
    workerSourceStr,
    { overwrite },
  )
  const workerModule = workerSourceJs.getVariableDeclarationOrThrow("__dcg_worker_module__")
  const workerModuleInitializer = workerModule.getInitializerIfKindOrThrow(SyntaxKind.ArrowFunction)
  const workerModuleExecutorParams = workerModuleInitializer.getParameters()
  if (workerModuleExecutorParams.length !== 1 || !workerModuleExecutorParams[0]) {
    throw new Error("Expected the '__dcg_worker_module__' function to have only one parameter.")
  }
  const [sharedModuleExports] = workerModuleExecutorParams
  workerModule.getVariableStatementOrThrow().addJsDoc({
    tags: [{
      tagName: "param",
      text: `{typeof import("./shared.js")} ${sharedModuleExports.getName()}`,
    }],
  })
  const createWorker = workerJs.getVariableDeclarationOrThrow("createWorker")
  let worker: VariableDeclaration | undefined
  for (const node of createWorker.findReferencesAsNodes()) {
    const parent = node.getParentIfKind(SyntaxKind.BinaryExpression)
    if (!parent) continue
    const op = parent.getOperatorToken()
    const left = parent.getLeft()
    const right = parent.getRight()
    if (
      op.getKind() === SyntaxKind.EqualsToken &&
      left === node &&
      right.isKind(SyntaxKind.ArrowFunction)
    ) {
      const maybeWorker = right.getVariableDeclaration("worker")
      if (maybeWorker) {
        worker = maybeWorker
        break
      }
    }
  }
  if (!worker) throw new Error("Couldn't find the 'worker' declaration inside the 'createWorker' initializer.")
  // `const worker = new Worker(workerURL);`
  const workerInitializer = worker.getInitializerIfKindOrThrow(SyntaxKind.NewExpression)
  if (workerInitializer.getExpressionIfKind(SyntaxKind.Identifier)?.getText() !== "Worker") {
    throw new Error("Expected the 'worker' initializer to be an instance of Worker.")
  }
  const [workerURL] = workerInitializer.getArguments()
  if (!workerURL) throw new Error("Expected the first constructor argument of Worker to be present.")
  workerURL.replaceWithText(
    `/* ${
      workerURL.getText({
        includeJsDocComments: false,
        trimLeadingIndentation: true,
      })
    } */ import.meta.resolve("./worker_source.js")`,
  )
  workerSource.getVariableStatementOrThrow().setDeclarationKind(VariableDeclarationKind.Let)
  workerSource.removeInitializer()
  const workerJsReturn = workerJs
    .getStatementByKindOrThrow(SyntaxKind.ReturnStatement)
  const workerJsExports = workerJsReturn
    .getExpressionIfKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    .getProperties()
  const namedExports: Export[] = []
  let defaultExport: Expression | undefined
  workerJsExports.forEach((property) => {
    if (property.isKind(SyntaxKind.PropertyAssignment)) {
      const alias = property.getName()
      if (alias === "default") {
        defaultExport = property.getInitializerOrThrow()
      } else {
        const name = property.getInitializerIfKindOrThrow(SyntaxKind.Identifier).getText()
        namedExports.push(name === alias ? { name } : { name, alias })
      }
    } else if (property.isKind(SyntaxKind.ShorthandPropertyAssignment)) {
      const alias = property.getName()
      namedExports.push({ name: alias, alias })
    } else {
      throw new Error(`Unexpected node kind: ${property.getKindName()}.`)
    }
  })
  workerJs.addExportDeclaration({ namedExports })
  if (defaultExport) {
    workerJs.addExportAssignment({
      expression: defaultExport.getFullText(),
      isExportEquals: false,
    })
  }
  workerJsReturn.remove()
  workerSourceExports.setInitializer('await import("./worker.js")')
}

function evalStringConcat(node: Node, replacer: (node: Node) => string): string {
  if (isStringLiteralLike(node)) {
    return node.getLiteralText()
  } else if (node.isKind(SyntaxKind.TemplateExpression)) {
    return node.getTemplateSpans().reduce(
      (str, span) => str + replacer(span.getExpression()) + span.getLiteral().getLiteralText(),
      node.getHead().getLiteralText(),
    )
  } else if (node.isKind(SyntaxKind.BinaryExpression) && node.getOperatorToken().isKind(SyntaxKind.PlusToken)) {
    return evalStringConcat(node.getLeft(), replacer) + evalStringConcat(node.getRight(), replacer)
  } else if (node.isKind(SyntaxKind.ParenthesizedExpression)) {
    return evalStringConcat(node.getExpression(), replacer)
  } else {
    throw new Error(`Unexpected node kind: ${node.getKindName()}.`)
  }
}
