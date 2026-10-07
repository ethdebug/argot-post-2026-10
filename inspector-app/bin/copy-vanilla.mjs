// Copies the vanilla page's data and look into the app, from vanilla at
// a commit (default: sync-base): the fixtures, the contract, style.css,
// vendor/shiki.js, and index.html with its scripts replaced by the
// app's entry. Usage: node bin/copy-vanilla.mjs [sha]
import fs from "node:fs";
import path from "node:path";
import { app, vanillaFile } from "./vanilla.mjs";

const FIXTURES = ["arcade-alice", "arcade-mid", "arcade-motd",
  "arcade-vyper", "index", "memory"];
export const COPIES = [
  ...FIXTURES.map((f) => [`static/fixtures/${f}.json`, `fixtures/${f}.json`]),
  ["static/vendor/shiki.js", "vendor/shiki.js"],
  ["contracts/Arcade.sol", "contracts/Arcade.sol"],
  ["src/style.css", "style.css"],
];

const ENTRY = '<script type="module" src="/src/pages/parity.tsx"></script>';

// vanilla index.html -> the parity page: the stylesheet links, their
// `styled` script and the module preloads go (the entry imports the
// CSS and the code); the loader script becomes the entry
export function skeleton(html) {
  const out = html
    .replace(/<script>\s*\/\/ Shows the page once[\s\S]*?<\/script>\n/, "")
    .replace(/<link rel="stylesheet"[^>]*data-css[^>]*>\n/g, "")
    .replace(/<link rel="modulepreload"[^>]*>\n/g, "")
    .replace(/<script>\n\/\/ The loader\.[\s\S]*?<\/script>/, ENTRY);
  for (const gone of ["window.styled", "data-css", "modulepreload",
    "The loader."]) {
    if (out.includes(gone)) throw new Error(`index.html: ${gone} remains`);
  }
  if (!out.includes(ENTRY)) throw new Error("index.html: no entry");
  return out;
}

export function copyVanilla(sha) {
  for (const [mine, theirs] of COPIES) {
    const to = path.join(app, mine);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, vanillaFile(theirs, sha));
  }
  fs.writeFileSync(path.join(app, "index.html"),
    skeleton(vanillaFile("index.html", sha).toString()));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  copyVanilla(process.argv[2]);
  console.log(`copied ${COPIES.length} files and index.html`);
}
