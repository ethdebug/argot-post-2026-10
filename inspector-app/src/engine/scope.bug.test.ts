// bugc's storage variables, in scope at a moment of the BUG build's run
// (decodeScope): every one the program declares, its value types as the
// Solidity scenes' story has them at the same point (test/expect.ts mid:
// before alice's third play writes anything). Its composites (bugc's
// inline types and pointer templates) are not decoded yet.
import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { mid } from "../../test/expect";

for (const scene of ["bug-O0", "bug-O2"]) {
  it(`${scene}: the storage variables in scope; value types as the story`,
    async () => {
      const p = await testProject();
      const d = await decode(p, { ...p.decodings[scene],
        variables: "scope" }, `${scene}:0`);
      expect(d.tree.map((n) => n.path)).toEqual(["@storage", "@locals"]);
      expect(d.byPath.get("@storage")!.children!.map((n) => n.path))
        .toEqual(["playerList", "motd", "totalScore", "totalHits",
          "players"]);
      for (const path of ["totalScore", "totalHits"]) {
        expect(d.byPath.get(path)!.value?.text, path)
          .toBe(mid.find(([p]) => p === path)![1]);
      }
      expect(d.byPath.get("@locals")!.children!.map((n) => n.path))
        .toContain("hit");
    }, 30_000);
}
