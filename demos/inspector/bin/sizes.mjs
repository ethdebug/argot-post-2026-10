// Writes the size of each file the loader in index.html fetches (the
// decoder bundle and fixtures/*.json) into index.html, so that the
// loading bar can say "n KB of m KB". Run it after changing any of
// them; bin/run.mjs checks that the sizes are current.
// Usage: node bin/sizes.mjs [--check]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function sizes() {
  const files = ["vendor/pointers.js", "vendor/shiki.js", ...fs.readdirSync(
    path.join(root, "fixtures")).filter((f) => f.endsWith(".json"))
    .sort().map((f) => `fixtures/${f}`)];
  return Object.fromEntries(files.map((f) =>
    [f, fs.statSync(path.join(root, f)).size]));
}
const RE = /\/\* sizes \*\/[\s\S]*?\/\* end sizes \*\//;
const html = path.join(root, "index.html");
export const block = () => "/* sizes */" + JSON.stringify(sizes(), null, 2)
  .replace(/\n/g, "\n  ") + "/* end sizes */";
export const current = () =>
  fs.readFileSync(html, "utf8").match(RE)?.[0] === block();

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    console.log(current() ? "sizes current" : "sizes stale");
    process.exit(current() ? 0 : 1);
  }
  fs.writeFileSync(html, fs.readFileSync(html, "utf8").replace(RE, block()));
  console.log(sizes());
}
