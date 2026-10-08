import fs from "node:fs/promises";
import path from "node:path";
import type { Io } from "../src/engine/io";

// The engine's IO from files (default: the demo's directory, which holds
// the fixtures)
export function fsIo(root = path.join(__dirname, "..", "..", "demos",
  "inspector")): Io {
  const at = (p: string) => path.join(root, p);
  return {
    json: async <T>(p: string) =>
      JSON.parse(await fs.readFile(at(p), "utf8")) as T,
    text: (p) => fs.readFile(at(p), "utf8"),
    bytes: async (p) => new Uint8Array(await fs.readFile(at(p))),
  };
}
