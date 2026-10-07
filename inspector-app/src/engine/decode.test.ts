import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { expected } from "../../test/expect";

// run.mjs's expected value of a path in a scene (after)
const value = (scene: string, path: string) =>
  expected[scene].find(([p]) => p === path)![2];

it("total is 40 in the middle of the game, bytes 16-31 of slot 2",
  async () => {
    const p = await testProject();
    const d = await decode(p, p.decodings["sol:arcade-mid"],
      "arcade-mid:after");
    const n = d.byPath.get("total")!;
    expect(n.value?.text).toBe(value("mid", "total"));
    expect(n.typeText).toBe("uint128");
    expect(n.regions).toEqual([expect.objectContaining({
      location: "storage", slot: 2n, offset: 16, length: 16,
      role: "value" })]);
    expect(d.byPath.get("rounds")!.value?.text)
      .toBe(value("mid", "rounds"));
  });

it("alice's hit: total 40 before, 70 after", async () => {
  const p = await testProject();
  const d = p.decodings["sol:arcade-alice"];
  expect((await decode(p, d, "arcade-alice:before")).byPath.get("total")
    ?.value?.text).toBe(expected.alice.find(([x]) => x === "total")![1]);
  expect((await decode(p, d, "arcade-alice:after")).byPath.get("total")
    ?.value?.text).toBe(value("alice", "total"));
});

it("is memoised per decoding and point", async () => {
  const p = await testProject();
  const d = p.decodings["sol:arcade-mid"];
  expect(decode(p, d, "arcade-mid:after"))
    .toBe(decode(p, d, "arcade-mid:after"));
});
