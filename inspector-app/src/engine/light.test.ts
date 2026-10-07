import { it, expect, beforeAll } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { layout } from "./layout";
import { slotHex } from "./hex";
import { forBytes, forPath, noLight } from "./light";
import type { Decoded, Layout } from "./types";

const at = {} as { d: Decoded; l: Layout };
beforeAll(async () => {
  const p = await testProject();
  at.d = await decode(p, p.decodings["sol:arcade-mid"], "arcade-mid:after");
  at.l = layout(at.d, "storage", { rows: "values" });
});

it("total lights bytes 16-31 of slot 2 and its row", () => {
  const g = forPath(at.d, at.l, "total");
  expect([...g.bytes]).toEqual([...at.l.owned.get("total")!]);
  expect([...g.rows]).toEqual(["total"]);
  expect(g.muted).toBe(true);
  expect(g.colours.size).toBe(0);
});

it("byte 31 of slot 2 lights total", () => {
  const g = forBytes(at.d, at.l, { row: slotHex(2n), from: 31, to: 31,
    location: "storage" });
  expect([...g.rows]).toEqual(["total"]);
  expect([...g.bytes]).toEqual([...at.l.owned.get("total")!]);
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
