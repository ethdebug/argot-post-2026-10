// Fills in each block's prevrandao in a scenario (default: Arcade's),
// once. Arcade's play() rolls from keccak256(prevrandao . sender) % 3
// (a hit unless 0), so each play gets the first prevrandao, from a seed,
// with the outcome the story needs; every other transaction gets the
// seed's first value. Nothing is random: run it again, get the same.
// (src/engine/run/scenario.ts rolledHit is the same roll; its test
// checks the values this writes.)
// Usage: node bin/scenario-roll.mjs [scenarios/arcade/scenario.json]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sha3 from "js-sha3";

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const file = process.argv[2] ??
  path.join(app, "scenarios", "arcade", "scenario.json");
// README "How the fixtures were made", step 3: alice hits; alice hits;
// bob hits; carol hits four times, then misses; alice hits
const HITS = [true, true, true, true, true, true, true, false, true];

const word = (h) => BigInt(h).toString(16).padStart(64, "0");
const hit = (prevrandao, sender) => BigInt("0x" + sha3.keccak256(
  Buffer.from(word(prevrandao) + word(sender), "hex"))) % 3n !== 0n;
const candidate = (seed, k, n) => "0x" + sha3.keccak256(`${seed}:${k}:${n}`);

const s = JSON.parse(fs.readFileSync(file, "utf8"));
const address = Object.fromEntries(s.accounts.map((a) =>
  [a.name, a.address]));
const plays = s.transactions.filter((t) => t.label === "play()").length;
if (plays !== HITS.length) throw new Error(`${plays} plays, ${HITS.length}`);
let p = 0;
s.transactions.forEach((t, k) => {
  let n = 0;
  if (t.label === "play()") {
    const want = HITS[p++];
    while (hit(candidate(s.id, k, n), address[t.from]) !== want) n++;
  }
  t.block.prevrandao = candidate(s.id, k, n);
  console.log(k, t.label, n);
});
fs.writeFileSync(file, JSON.stringify(s, null, 2) + "\n");
