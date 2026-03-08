import "@total-typescript/ts-reset"

declare global {
  interface ArrayConstructor {
    // https://github.com/microsoft/TypeScript/issues/17002
    isArray(arg: unknown): arg is readonly unknown[]
  }
}
