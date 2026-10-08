// Writes bin/run.gen.mjs: vanilla's bin/run.mjs at sync-base, with
// PATCHES applied (the only differences: the port's URL, its paths and
// its source files). A patch whose `from` does not occur exactly
// `count` times throws, so a vanilla change to those lines is seen.
// Usage: node bin/make-run.mjs
import fs from "node:fs";
import path from "node:path";
import { app, vanillaFile } from "./vanilla.mjs";

const NEXT = "/demos/inspector-next/";
export const PATCHES = [
  { name: "page", from: '"http://localhost:8000/demos/inspector/"',
    to: `"http://localhost:5181${NEXT}"`, count: 1 },
  { name: "fixtures", from: 'path.join(root, "fixtures"',
    to: 'path.join(root, "static", "fixtures"', count: 4 },
  { name: "sources",
    from: '["index.html", "main.js", "panel.js", "mem.js",\n  "calldata.js"]',
    to: '["index.html", ...fs.readdirSync(path.join(root, "src"),\n' +
      '  { recursive: true }).filter((f) => /\\.tsx?$/.test(f))\n' +
      '  .map((f) => path.join("src", f))]',
    count: 1 },
  { name: "site", from: "const site = path.dirname(path.dirname(root));",
    to: "const site = path.dirname(root);", count: 1 },
  { name: "slow", from: "/demos/inspector/`", to: `${NEXT}\``, count: 1 },
  { name: "serve",
    from: "let f = path.join(site, decodeURIComponent(new URL(req.url,\n" +
      '    "http://x").pathname));',
    to: "const u = decodeURIComponent(new URL(req.url, \"http://x\")\n" +
      "    .pathname);\n" +
      `  let f = u.startsWith("${NEXT}") ? path.join(root, "dist",\n` +
      `    u.slice(${NEXT.length - 1})) : path.join(site, u);`,
    count: 1 },
  // (decided 10-07: every location one Dump; a byte's data-i is its
  // place in its row, as in storage and memory: calldata's byte 40 is
  // the 5th of the word at 0x24)
  { name: "calldata byte", from: `'#cpanel .b[data-i="40"]'`,
    to: `'#cpanel .wrow[data-slot="0x0024"] .b[data-i="4"]'`, count: 2 },
  { name: "calldata lit",
    from: '"#cpanel .b.hl")].map((b) => +b.dataset.i));',
    to: '"#cpanel .b.hl")].map((b) => Number(b.closest(".wrow")' +
      '.dataset.slot) + +b.dataset.i));', count: 1 },
  { name: "print", from: "/^.*\\/demos\\/inspector\\//",
    to: "/^.*\\/demos\\/inspector-next\\//", count: 1 },
];

export function makeRun(source) {
  let out = source;
  for (const p of PATCHES) {
    const n = out.split(p.from).length - 1;
    if (n !== p.count) {
      throw new Error(`patch ${p.name}: found ${n} times, want ${p.count}`);
    }
    out = out.split(p.from).join(p.to);
  }
  return out;
}

export function writeRun() {
  const to = path.join(app, "bin", "run.gen.mjs");
  fs.writeFileSync(to, makeRun(vanillaFile("bin/run.mjs").toString()));
  return to;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`wrote ${path.relative(app, writeRun())}`);
}
