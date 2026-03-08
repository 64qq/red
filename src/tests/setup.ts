import type { GlobalThis } from "@utils/test-utils.ts"

declare const globalThis: GlobalThis

globalThis.isTest = true
