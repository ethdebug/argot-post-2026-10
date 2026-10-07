import test from "node:test";
import assert from "node:assert";
import { makeRun, PATCHES } from "./make-run.mjs";
import { vanillaFile } from "./vanilla.mjs";

const src = vanillaFile("bin/run.mjs").toString();

test("each patch applies exactly as declared", () => {
  assert.doesNotThrow(() => makeRun(src));
});

test("nothing but the patches differs", () => {
  let undone = makeRun(src);
  for (const p of PATCHES) undone = undone.split(p.to).join("§");
  let marked = src;
  for (const p of PATCHES) marked = marked.replace(
    typeof p.from === "string" ? new RegExp(p.from.replace(
      /[.*+?^${}()|[\]\\]/g, "\\$&"), "g") : p.from, "§");
  assert.strictEqual(undone, marked);
});

test("a patch that does not occur its count of times throws", () => {
  assert.throws(() => makeRun(src.replace(
    'const site = path.dirname(path.dirname(root));', "")), /site/);
});
