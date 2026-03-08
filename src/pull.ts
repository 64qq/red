import { DOMParser } from "deno-dom"
import { isTest } from "@utils/test-utils.ts"
import * as path from "@std/path"

export const TEST_HASH = "f2516a996d73d6d3b3e2f727c48ef0f00d74eec9"

export async function fetchLatestVersionHash() {
  if (isTest) return TEST_HASH
  const document = new DOMParser().parseFromString(
    await fetch(
      "https://www.desmos.com/calculator",
    ).then((r) => r.ok ? r.text() : onError(r)),
    "text/html",
  )
  for (const script of document.querySelectorAll("script[src]")) {
    const src = script.getAttribute("src")
    if (!src) continue
    const [, hash] = /^\/assets\/build\/shared_calculator_desktop-(.*)\.js$/.exec(src) ?? []
    if (hash) return hash
  }
  throw new Error("Couldn't find shared_calculator_desktop URL.")
}

export function pull(hash: string) {
  if (isTest) {
    return Deno.readTextFile(
      path.fromFileUrl(
        import.meta.resolve("./tests/fixtures/shared_calculator_desktop-f2516a996d73d6d3b3e2f727c48ef0f00d74eec9.js"),
      ),
    )
  }
  return fetch(
    `https://www.desmos.com/assets/build/shared_calculator_desktop-${hash}.js`,
  ).then((r) => r.ok ? r.text() : onError(r))
}

function onError(res: Response): never {
  throw new Error(`Failed to fetch ${res.url}: ` + `${res.status} ${res.statusText}`.trimEnd())
}
