import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { parentIn, within } from "./tree-paths";
import { A } from "../../test/expect";

it("by the tree: a record's member; a function's local", async () => {
  const p = await testProject();
  const s = await decode(p, p.decodings["mid"],
    "mid:0");
  expect(parentIn(s.byPath, `${A}.score`)).toBe(A);
  expect(within(s.byPath, `${A}.score`, "players")).toBe(true);
  expect(within(s.byPath, "totalScore", "players")).toBe(false);
  const m = await decode(p, p.decodings["bug-O0/scope"], "bug-O0:1");
  expect(parentIn(m.byPath, "points")).toBe("_applyCombo");
  expect(within(m.byPath, "mult", "_applyCombo")).toBe(true);
});
