import fs from "node:fs/promises";
import path from "node:path";
import type { Io } from "../src/engine/io";

// The demo's directory, the page's static files
const demo = path.join(__dirname, "..", "..", "demos", "inspector");

// The engine's IO from the demo's files
export function fsIo(): Io {
  const at = (p: string) => path.join(demo, p);
  return {
    json: async <T>(p: string) =>
      JSON.parse(await fs.readFile(at(p), "utf8")) as T,
    text: (p) => fs.readFile(at(p), "utf8"),
    bytes: async (p) => new Uint8Array(await fs.readFile(at(p))),
  };
}
