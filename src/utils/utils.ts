export function tryAny<A extends readonly (() => unknown)[]>(...callbacks: A) {
  const errors: unknown[] = []
  for (const fn of callbacks) {
    try {
      return fn() as ReturnType<A[number]>
    } catch (e) {
      errors.push(e)
    }
  }
  throw new AggregateError(errors, "All callbacks threw exceptions")
}

export function catchIf<C extends abstract new (...args: never) => unknown, R>(
  onrejected: (reason: InstanceType<C>) => R,
  ctors: readonly C[],
) {
  return (err: unknown): R => {
    if (ctors.some((c) => err instanceof c)) return onrejected(err as InstanceType<C>)
    throw err
  }
}

export type MaybePromise<T> = T | PromiseLike<T>

type FunctionType = (...args: never) => unknown
export type Prettify<T> = unknown extends T ? T
  : T extends FunctionType ? T
  : { [K in keyof T]: T[K] } & unknown

// https://stackoverflow.com/a/54947677
type UnionToIntersection<U> = (U extends U ? (x: U) => void : never) extends ((x: infer I) => void) ? I : never

// https://github.com/type-challenges/type-challenges/discussions/9100
export type Equal<X, Y> = (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false

type IsCastable<T, U> = T extends U ? true : U extends T ? true : false
type ObjectEntry<T> = readonly [string, T[keyof T]]
type CoerceKeysToString<T> = {
  [K in keyof T as K extends string | number ? `${K}` : never]: T[K]
}
export type StrictObjectEntry<T, _U = CoerceKeysToString<T>> = {
  [K in keyof _U]-?: Extract<readonly [K, _U[K]], ObjectEntry<T>>
}[keyof _U]
type AsIndexSignatureIfPossible<K extends PropertyKey> = Extract<PropertyKey, K>
type _PickWithPredicate<T, P extends readonly [PropertyKey, unknown]> = P extends P ? {
    [
      K in keyof T as K extends P[0] ? (true extends IsCastable<T[K], P[1]> ? K : never)
        : P[0] extends K ? (T[K] & P[1] extends never ? never : AsIndexSignatureIfPossible<K>)
        : never
    ]?: T[K] & P[1]
  }
  : never

// ["a", number] | ["a", string] | ["b", number] -> ["a", number | string] | ["b", number]
type NormalizePredicate<P extends readonly [PropertyKey, unknown]> = {
  [K in P[0]]: [K, Extract<P, readonly [K, unknown]>[1]]
}[P[0]]
type PickWithPredicate<T, P extends readonly [keyof T, T[keyof T]]> = Prettify<
  UnionToIntersection<
    _PickWithPredicate<T, NormalizePredicate<P>>
  >
>

export function pick<T extends object, K extends keyof T>(obj: T, keys: readonly K[]): Pick<T, K>
export function pick<T extends object, P extends StrictObjectEntry<T>>(
  obj: T,
  predicate: (entry: ObjectEntry<T>) => entry is P,
): PickWithPredicate<CoerceKeysToString<T>, P>
export function pick<T extends object>(
  obj: T,
  predicate: (entry: ObjectEntry<T>) => boolean,
): Partial<CoerceKeysToString<T>>
export function pick<T extends object, K extends keyof T>(
  obj: T,
  predicate: readonly K[] | ((entry: ObjectEntry<T>) => boolean),
) {
  if (Array.isArray(predicate)) {
    return predicate.reduce((acc, key) => {
      acc[key] = obj[key]
      return acc
    }, {} as Pick<T, K>)
  } else {
    return Object.entries(obj).reduce<Record<string, unknown>>((acc, entry) => {
      if (predicate(entry)) acc[entry[0]] = entry[1]
      return acc
    }, {}) as Partial<CoerceKeysToString<T>>
  }
}

export class PrimitiveProxy<T> {
  constructor(private readonly value: T, private readonly colors: boolean = !Deno.noColor) {}

  valueOf() {
    return this.value
  }

  [Symbol.for("Deno.customInspect")]() {
    return Deno.inspect(this.value, { colors: this.colors })
  }
}

export class UnimplementedError extends Error {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? "This feature has not been implemented yet.", options)
  }
}
