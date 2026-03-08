import type { Transformer } from "../mod.ts"
import { extractSharedModule } from "./extract-shared-module.ts"
import { extractWorkerModule } from "./extract-worker-module.ts"
import { unwrapIIFE } from "./utils.ts"

export const demin: Transformer = async (context) => {
  unwrapIIFE(context.entryFile)
  // extract the worker module first to find all references to __dcg_shared_module_exports__
  await extractWorkerModule(context)
  await extractSharedModule(context)
}
