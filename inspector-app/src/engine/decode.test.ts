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
    const d = await decode(p, p.decodings["sol:arcade-mid"],
      "arcade-mid:after");
    const n = d.byPath.get("totalScore")!;
    expect(n.value?.text).toBe(value("mid", "totalScore"));
    expect(n.typeText).toBe("uint128");
    expect(n.regions).toEqual([expect.objectContaining({
      location: "storage", slot: 2n, offset: 16, length: 16,
      role: "value" })]);
    expect(d.byPath.get("totalHits")!.value?.text)
      .toBe(value("mid", "totalHits"));
  });

it("alice's hit: totalScore 40 before, 70 after", async () => {
  const p = await testProject();
  const d = p.decodings["sol:arcade-alice"];
  expect((await decode(p, d, "arcade-alice:before")).byPath.get("totalScore")
    ?.value?.text).toBe(expected.alice.find(([x]) => x === "totalScore")![1]);
  expect((await decode(p, d, "arcade-alice:after")).byPath.get("totalScore")
    ?.value?.text).toBe(value("alice", "totalScore"));
});

it("is memoised per decoding and point", async () => {
  const p = await testProject();
  const d = p.decodings["sol:arcade-mid"];
  expect(decode(p, d, "arcade-mid:after"))
    .toBe(decode(p, d, "arcade-mid:after"));
});

const sides = { mid: ["after"], alice: ["before", "after"],
  motd: ["before", "after"], vyper: ["after"] } as const;
type Scene = keyof typeof sides;

it.each(Object.keys(sides) as Scene[])(
  "%s: values equal run.mjs expected", async (bm) => {
    const p = await testProject();
    const b = p.bookmarks.find((x) => x.id === bm)!;
    for (const side of sides[bm]) {
      const d = await decode(p, p.decodings[b.decoding],
        `${b.timeline}:${side}`);
      for (const [path, before, after] of expected[bm]) {
        const n = d.byPath.get(path);
        expect(n?.value?.text ?? n?.summary, `${bm} ${side} ${path}`)
          .toBe(side === "before" ? before : after);
      }
    }
  });

it("carol's name is long: three regions incl. length parts", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings["sol:arcade-mid"],
    "arcade-mid:after");
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
  const d = await decode(p, p.decodings["sol:arcade-mid"],
    "arcade-mid:after");
  const t = await p.timeline("arcade-mid");
  const traced = mappingKeys(t.points[1].transaction!, slotHex(3n));
  const listed = keysFor(p.decodings["sol:arcade-mid"], d.tree);
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
  const d = await decode(p, p.decodings["sol:arcade-mid"],
    "arcade-mid:after");
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
