import test from "node:test";
import assert from "node:assert";
import { states } from "./manifest.mjs";
const s = states();
test("every bookmark and side, in three modes", () => {
  for (const ex of ["mid", "alice", "motd", "vyper"])
    for (const mode of [["desktop", "light"], ["desktop", "dark"],
      ["phone", "light"]])
      assert.ok(s.some((x) => x.hash.includes(`ex=${ex}`) &&
        x.device === mode[0] && x.scheme === mode[1]), ex + mode);
});
test("walkthroughs: players at mid, in each mode", () => {
  const w = s.filter((x) => x.hash === "ex=mid&sel=players" &&
    x.walk === "all");
  assert.strictEqual(w.length, 3);
});
test("memory: O0 and O2, three points, both sides at mult", () => {
  for (const o of ["0", "2"]) for (const p of ["roll", "mult", "writes"])
    assert.ok(s.some((x) => x.hash.includes(`mopt=${o}&mpt=${p}`)));
  assert.ok(s.some((x) => x.hash.includes("mpt=mult&mmode=before")));
});
test("ids are unique", () =>
  assert.strictEqual(new Set(s.map((x) => x.id)).size, s.length));
