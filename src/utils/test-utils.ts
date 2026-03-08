export type GlobalThis = typeof self & { isTest?: boolean }
declare const globalThis: GlobalThis

export const { isTest } = globalThis
