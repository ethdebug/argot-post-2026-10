import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { declarationOf, linesOf } from "./declaration";
import { A } from "../../test/expect";

it("a member: its struct; a variable: its declaration", async () => {
  const p = await testProject();
  const dc = p.decodings["sol:arcade-alice"];
  const d = await decode(p, dc, "arcade-alice:after");
  const c = await p.compilation(dc.compilation);
  const text = c.sources[0].text;
  const at = (q: string) => {
    const r = declarationOf(c, d, q)!;
    return text.split("\n").slice(...((([a, b]) => [a, b + 1])(
      linesOf(text, r)))).join("\n");
  };
  expect(at(`${A}.combo`)).toMatch(/^\s*struct Player \{[\s\S]*\}/);
  expect(at("totalScore")).toContain("totalScore");
  expect(at(A)).toContain("mapping(address => Player)");
});
