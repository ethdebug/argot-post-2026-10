// Compares two directories of screenshots (bin/shots.mjs), by name.
// Usage: node bin/shot-diff.mjs <dirA> <dirB> [--threshold n]
// Prints one JSON line per PNG in either directory: { id, diffPixels,
// ratio, pass } (ratio: the share of pixels that differ; a missing file
// or another size counts as all), then the largest ratio; exits 1 if
// any ratio is above the threshold (default 0).
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import path from "node:path";
import fs from "node:fs";

const [a, b] = process.argv.slice(2).filter((x, k, all) =>
  !x.startsWith("--") && all[k - 1] !== "--threshold");
const t = process.argv.indexOf("--threshold");
const threshold = t < 0 ? 0 : Number(process.argv[t + 1]);
if (!a || !b || Number.isNaN(threshold)) {
  console.error("usage: node bin/shot-diff.mjs <dirA> <dirB> " +
    "[--threshold n]");
  process.exit(2);
}

const pngs = (d) => fs.readdirSync(d).filter((f) => f.endsWith(".png"));
const read = (d, f) => fs.existsSync(path.join(d, f))
  ? PNG.sync.read(fs.readFileSync(path.join(d, f))) : null;

let failed = 0;
let largest = 0;
for (const f of [...new Set([...pngs(a), ...pngs(b)])].sort()) {
  const [x, y] = [read(a, f), read(b, f)];
  let diffPixels;
  let ratio = 1;
  if (x && y && x.width === y.width && x.height === y.height) {
    diffPixels = pixelmatch(x.data, y.data, null, x.width, x.height);
    ratio = diffPixels / (x.width * x.height);
  } else {
    diffPixels = Math.max(x ? x.width * x.height : 0,
      y ? y.width * y.height : 0);
  }
  const pass = ratio <= threshold;
  if (!pass) failed++;
  largest = Math.max(largest, ratio);
  console.log(JSON.stringify({ id: f.replace(/\.png$/, ""), diffPixels,
    ratio, pass }));
}
console.log(JSON.stringify({ largest, threshold, failed }));
process.exit(failed ? 1 : 0);
