import { it, expect } from "vitest";
import fs from "node:fs";
import { vanillaFile } from "../bin/vanilla.mjs";

const copies: [string, string][] = [
  ...["arcade-alice", "arcade-mid", "arcade-motd", "arcade-vyper",
    "index", "memory"].map((f): [string, string] =>
    [`static/fixtures/${f}.json`, `fixtures/${f}.json`]),
  ["static/vendor/shiki.js", "vendor/shiki.js"],
  ["contracts/Arcade.sol", "contracts/Arcade.sol"],
  ["src/style.css", "style.css"],
];

it.each(copies)("%s equals vanilla at sync-base", (mine, theirs) =>
  expect(fs.existsSync(mine) &&
    fs.readFileSync(mine).equals(vanillaFile(theirs))).toBe(true));
