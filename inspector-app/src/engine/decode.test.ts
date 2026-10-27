import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { expected, A, B, C, NAME_C } from "../../test/expect";
import { keysFor, mappingKeys } from "./keys";
import { slotHex } from "./hex";

// run.mjs's expected value of a path in a scene (after)
const value = (scene: string, path: string) =>
  expected[scene].find(([p]) => p === path)![2];

it("totalScore is 40 in the middle of the game, bytes 16-31 of slot 2",
  async () => {
    const p = await testProject();
    const d = await decode(p, p.decodings["pitfall-nesting"],
      "pitfall-nesting:0");
    const n = d.byPath.get("totalScore")!;
    expect(n.value?.text).toBe(value("pitfall-nesting", "totalScore"));
    expect(n.typeText).toBe("uint128");
    expect(n.regions).toEqual([expect.objectContaining({
      location: "storage", slot: 2n, offset: 16, length: 16,
      role: "value" })]);
    expect(d.byPath.get("totalHits")!.value?.text)
      .toBe(value("pitfall-nesting", "totalHits"));
  });

it("is memoised per decoding and point", async () => {
  const p = await testProject();
  const d = p.decodings["pitfall-nesting"];
  expect(decode(p, d, "pitfall-nesting:0"))
    .toBe(decode(p, d, "pitfall-nesting:0"));
});

it("carol's name is long: three regions incl. length parts", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings["pitfall-nesting"],
    "pitfall-nesting:0");
  const n = d.byPath.get(`${C}.name`)!;
  expect(n.value?.text).toBe(`"${NAME_C}"`);
  expect(n.regions.map((r) => [r.name, r.role, r.length])).toEqual([
    ["value-name-data", "value", 34],
    ["value-name-length-flag", "length", 1],
    ["value-name-long-length", "length", 32],
  ]);
});

it("playerList's keys equal the trace's keys", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings["pitfall-nesting"],
    "pitfall-nesting:0");
  const t = await p.timeline("scene:pitfall-nesting");
  const traced = mappingKeys(t.points[0].transaction!, slotHex(3n));
  const listed = keysFor(p.decodings["pitfall-nesting"], d.tree);
  expect(listed.provenance).toEqual({ list: "playerList" });
  expect(listed.values.map((v) => v.source))
    .toEqual(["playerList[0]", "playerList[1]", "playerList[2]"]);
  expect([...listed.values.map((v) => v.value)].sort())
    .toEqual([...traced].sort());
  expect(d.tree.find((n) => n.path === "players")!.children!
    .map((c) => c.path)).toEqual([A, B, C]);
});

it("composites: summaries, types and own regions", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings["pitfall-nesting"],
    "pitfall-nesting:0");
  const n = (q: string) => d.byPath.get(q)!;
  expect(d.tree.map((x) => x.path))
    .toEqual(["playerList", "motd", "totalScore", "totalHits", "players"]);
  expect([n("playerList").summary, n("playerList").typeText])
    .toEqual(["length 3", "address[]"]);
  expect(n("playerList").regions.map((r) => [r.role, r.slot]))
    .toEqual([["length", 0n]]);
  expect([n("players").summary, n("players").typeText])
    .toEqual(["3 entries", "mapping(address => Player)"]);
  expect([n(A).summary, n(A).label, n(A).typeText])
    .toEqual(["7 fields", "[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]",
      "Player"]);
  expect(n("playerList[1]").label).toBe("[1]");
  expect(n(`${A}.score`).label).toBe("score");
});
