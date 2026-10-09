import { it, expect, beforeAll } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { layout } from "./layout";
import { slotHex } from "./hex";
import {
  childColours, forBytes, forPath, forRow, noLight,
} from "./light";
import type { Decoded, Layout } from "./types";

const at = {} as { d: Decoded; l: Layout };
beforeAll(async () => {
  const p = await testProject();
  at.d = await decode(p, p.decodings["sol:arcade-mid"], "arcade-mid:after");
  at.l = layout(at.d, "storage", { rows: "values" });
});

it("totalScore lights bytes 16-31 of slot 2 and its row", () => {
  const g = forPath(at.d, at.l, "totalScore");
  expect([...g.bytes]).toEqual([...at.l.owned.get("totalScore")!]);
  expect([...g.rows]).toEqual(["totalScore"]);
  expect(g.muted).toBe(true);
  expect(g.colours.size).toBe(0);
});

it("byte 31 of slot 2 lights totalScore", () => {
  const g = forBytes(at.d, at.l, { row: slotHex(2n), from: 31, to: 31,
    location: "storage" });
  expect([...g.rows]).toEqual(["totalScore"]);
  expect([...g.bytes]).toEqual([...at.l.owned.get("totalScore")!]);
  expect(g.at).toEqual({ row: slotHex(2n), from: 31, to: 31,
    location: "storage" });
});

it("bytes no value owns light nothing, and the rest mutes", () => {
  const g = forBytes(at.d, at.l, { row: slotHex(2n), from: 0, to: 3,
    location: "storage" });
  expect(g.bytes.size + g.rows.size).toBe(0);
  expect(g.muted).toBe(true);
});

it("a path absent here lights nothing and does not throw", () => {
  const g = forPath(at.d, at.l, "players[0x01].name");
  expect(g.bytes.size).toBe(0);
  expect([...g.rows]).toEqual(["players[0x01].name"]);
});

it("a lit row hidden by a collapse lights its nearest visible ancestor",
  () => {
    const g = forPath(at.d, at.l, "a[1].b",
      { collapsed: new Set(["a", "a[1]"]) });
    expect([...g.rows]).toEqual(["a[1].b", "a"]);
  });

it("no light mutes nothing", () => {
  expect(noLight.muted).toBe(false);
  expect(noLight.bytes.size + noLight.rows.size).toBe(0);
});

it("players: alice, bob and carol take colours 1, 2, 3", () => {
  const c = childColours(at.d, "players", 9);
  const [a, b, cc] = at.d.byPath.get("players")!.children!;
  expect([c.get("players"), c.get(a.path), c.get(b.path), c.get(cc.path)])
    .toEqual([0, 1, 2, 3]);
  expect(c.get(`${a.path}.score`)).toBe(1);
  expect(c.get(`${cc.path}.name`)).toBe(3);
});

it("a 10th child repeats the first colour (9 picks)", () => {
  const kids = Array.from({ length: 10 }, (_, i) => ({ path: `x[${i}]`,
    label: `[${i}]`, root: "x", type: "", typeText: "", regions: [{
      location: "storage" as const, slot: BigInt(i), offset: 0, length: 1,
      role: "value" as const, instance: "" }] }));
  const x = { path: "x", label: "x", root: "x", type: "", typeText: "",
    regions: [], children: kids };
  const d = { ...at.d, byPath: new Map([["x", x],
    ...kids.map((k) => [k.path, k] as const)]) };
  const c = childColours(d, "x", 9);
  expect(kids.map((k) => c.get(k.path))).toEqual([1, 2, 3, 4, 5, 6, 7, 8,
    9, 1]);
  expect(childColours(d, "x", 8).get("x[8]")).toBe(1);
});

it("a leaf has no child colours", () => {
  expect(childColours(at.d, "totalScore", 9).size).toBe(0);
});

it("forPath of a composite carries its child colours", () => {
  const g = forPath(at.d, at.l, "players");
  expect(g.colours.get("players")).toBe(0);
  expect(g.colours.size).toBeGreaterThan(3);
});

it("a collapsed selection lights all in colour 0", () => {
  const g = forPath(at.d, at.l, "players",
    { collapsed: new Set(["players"]) });
  expect(new Set(g.colours.values())).toEqual(new Set([0]));
});

it("a selection inside a variable tints the variable's own slot", () => {
  const [a] = at.d.byPath.get("players")!.children!;
  expect([...forPath(at.d, at.l, a.path, { selection: true }).gutters])
    .toEqual([slotHex(3n)]);
  expect([...forPath(at.d, at.l, "playerList[1]", { selection: true })
    .gutters]).toEqual([slotHex(0n)]);
  // (a hover does not; a mapping itself: its own slot, empty)
  expect(forPath(at.d, at.l, a.path).gutters.size).toBe(0);
  expect([...forPath(at.d, at.l, "players").gutters])
    .toEqual([slotHex(3n)]);
});

it("a gutter address lights its row's 32 bytes as pointed at", () => {
  const g = forRow(at.d, at.l, slotHex(2n));
  expect(g.at).toEqual({ row: slotHex(2n), from: 0, to: 31,
    location: "storage" });
  expect(g.bytes.size + g.rows.size).toBe(0);
});

it("motd's old data at motd:after lights nothing there",
  async () => {
    const p = await testProject();
    const d = p.decodings["sol:arcade-motd"];
    const before = await decode(p, d, "arcade-motd:before");
    const after = await decode(p, d, "arcade-motd:after");
    const old = before.byPath.get("motd")!.regions.find((r) =>
      r.role === "value")!.slot!;
    const la = layout(after, "storage", { rows: [slotHex(old)] });
    const g = forPath(after, la, "motd");
    expect([...g.bytes].some((k) => k.includes(slotHex(old)))).toBe(false);
    expect(() => forPath(after, la, "motd.data")).not.toThrow();
  });

it("a string's data and its length part light apart", () => {
  const [, bob] = at.d.byPath.get("players")!.children!;
  const name = at.d.byPath.get(`${bob.path}.name`)!;
  const row = slotHex(name.regions[0].slot!);
  const data = forBytes(at.d, at.l, { row, from: 0, to: 2,
    location: "storage" });
  const flag = forBytes(at.d, at.l, { row, from: 31, to: 31,
    location: "storage" });
  expect([...data.bytes].map((k) => +k.split("|")[2])).toEqual([0, 1, 2]);
  expect([...flag.bytes].map((k) => +k.split("|")[2])).toEqual([31]);
  expect([...data.rows]).toEqual([name.path]);
  expect([...flag.rows]).toEqual([name.path]);
  expect(at.l.cover.get(`storage|${row}|31`))
    .toEqual([`${name.path}#length`]);
  // the value as a whole: both
  expect(forPath(at.d, at.l, name.path).bytes.size).toBe(4);
});
