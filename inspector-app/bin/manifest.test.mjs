import test from "node:test";
import assert from "node:assert";
import { states } from "./manifest.mjs";
const s = states();
test("every scene, in three modes", () => {
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
test("players' focus states: at the step with the picker", () => {
  // (each scene, each mode)
  const f = s.filter((x) => x.id.endsWith("-sel=players-walk6-bob"));
  assert.strictEqual(f.length, 4 * 3);
});
test("ids are unique", () =>
  assert.strictEqual(new Set(s.map((x) => x.id)).size, s.length));
