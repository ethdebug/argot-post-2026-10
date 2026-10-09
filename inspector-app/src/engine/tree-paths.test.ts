import { it, expect } from "vitest";
import { pauseOf, testProject } from "../../test/project";
import { decode } from "./decode";
import { parentIn, within } from "./tree-paths";
import { A } from "../../test/expect";

it("by the tree: a record's member; a local in its scope's group",
  async () => {
  const p = await testProject();
  const s = await decode(p, p.decodings["mid"],
    "mid:0");
  expect(parentIn(s.byPath, `${A}.score`)).toBe(A);
  expect(within(s.byPath, `${A}.score`, "players")).toBe(true);
  expect(within(s.byPath, "totalScore", "players")).toBe(false);
  const at = await pauseOf(p, "O0", 1);
  const m = await decode(p, at.decoding, at.point);
  expect(parentIn(m.byPath, "points")).toBe("@locals");
  expect(within(m.byPath, "mult", "@locals")).toBe(true);
});
