import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { parentIn, within } from "./tree-paths";
import { A } from "../../test/expect";

it("by the tree: a record's member; a function's local", async () => {
  const p = await testProject();
  const s = await decode(p, p.decodings["sol:arcade-mid"],
    "arcade-mid:after");
  expect(parentIn(s.byPath, `${A}.score`)).toBe(A);
  expect(within(s.byPath, `${A}.score`, "players")).toBe(true);
  expect(within(s.byPath, "total", "players")).toBe(false);
  const m = await decode(p, p.decodings["mem:O0"], "O0/mult:0");
  expect(parentIn(m.byPath, "points")).toBe("multiplied");
  expect(within(m.byPath, "m", "multiplied")).toBe(true);
});
