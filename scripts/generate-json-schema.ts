import { toJsonSchema } from "@valibot/to-json-schema"
import { ConfigSchema } from "../src/config.ts"
import * as path from "@std/path"

const filepath = path.fromFileUrl(import.meta.resolve("../src/red.schema.json"))
await Deno.writeTextFile(
  filepath,
  JSON.stringify(toJsonSchema(ConfigSchema, { errorMode: "ignore" })),
)
new Deno.Command(Deno.execPath(), {
  args: ["fmt", filepath],
  stdout: "null",
  stderr: "inherit",
}).spawn()
