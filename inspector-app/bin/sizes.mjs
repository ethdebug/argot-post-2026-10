// The loader's file sizes: each file the built page fetches (the
// built code chunks, the fixtures) with its size, as a block in
// dist/index.html. bin/run.gen.mjs checks that the block is current.
// Usage: node bin/sizes.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dist = path.join(app, "dist");
const list = (d) => fs.existsSync(path.join(dist, d))
  ? fs.readdirSync(path.join(dist, d)).sort().map((f) => `${d}/${f}`) : [];

export function sizes() {
  const files = [...list("assets").filter((f) => f.endsWith(".js")),
    ...list("fixtures").filter((f) => f.endsWith(".json"))];
  return Object.fromEntries(files.map((f) =>
    [f, fs.statSync(path.join(dist, f)).size]));
}
const RE = /\/\* sizes \*\/[\s\S]*?\/\* end sizes \*\//;
export const block = () => "/* sizes */" + JSON.stringify(sizes(), null, 2)
  .replace(/\n/g, "\n  ") + "/* end sizes */";
export function current() {
  const html = path.join(dist, "index.html");
  return fs.existsSync(html) &&
    fs.readFileSync(html, "utf8").match(RE)?.[0] === block();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(current() ? "sizes current" : "sizes stale");
  process.exit(current() ? 0 : 1);
}
