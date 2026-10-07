import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";

it("total is 40 in the middle of the game, bytes 16-31 of slot 2",
  async () => {
    const p = await testProject();
    const d = await decode(p, p.decodings["sol:arcade-mid"],
      "arcade-mid:after");
    const n = d.byPath.get("total")!;
    expect(n.value?.text).toBe("40");
    expect(n.typeText).toBe("uint128");
    expect(n.regions).toEqual([expect.objectContaining({
      location: "storage", slot: 2n, offset: 16, length: 16,
      role: "value" })]);
    expect(d.byPath.get("rounds")!.value?.text).toBe("3");
  });

it("alice's hit: total 40 before, 70 after", async () => {
  const p = await testProject();
  const d = p.decodings["sol:arcade-alice"];
  expect((await decode(p, d, "arcade-alice:before")).byPath.get("total")
    ?.value?.text).toBe("40");
  expect((await decode(p, d, "arcade-alice:after")).byPath.get("total")
    ?.value?.text).toBe("70");
});

it("is memoised per decoding and point", async () => {
  const p = await testProject();
  const d = p.decodings["sol:arcade-mid"];
  expect(decode(p, d, "arcade-mid:after"))
    .toBe(decode(p, d, "arcade-mid:after"));
});
