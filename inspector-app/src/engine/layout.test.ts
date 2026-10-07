import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { A, C } from "../../test/expect";
import { decode } from "./decode";
import { layout, rowLabel } from "./layout";
import { slotHex, byteKey } from "./hex";
import type { Decoded, Hex } from "./types";

const at = async (decoding: string, point: string) => {
  const p = await testProject();
  return decode(p, p.decodings[decoding], point);
};
const mid = () => at("sol:arcade-mid", "arcade-mid:after");
const recordOf = (d: Decoded, who: string, k: number): Hex =>
  slotHex(d.byPath.get(`${who}.score`)!.regions[0].slot! + BigInt(k));

it("slot 2 holds rounds, then total, in byte order", async () => {
  const d = await mid();
  const l = layout(d, "storage", { rows: "values" });
  const row = l.rows.find((r) => r.address === slotHex(2n))!;
  expect(row.what.map((w) => w.name)).toEqual(["rounds", "total"]);
  expect(row.how).toBe("slot 2");
  expect([...l.owned.get("total")!]).toEqual(Array.from({ length: 16 },
    (_, i) => byteKey("storage", slotHex(2n), 16 + i)));
  expect(l.cover.get(byteKey("storage", slotHex(2n), 31)))
    .toEqual(["total"]);
});

it("slot labels", async () => {
  const d = await mid();
  const l = layout(d, "storage", { rows: "values" });
  const label = (h: Hex) => rowLabel(l.rows.find((r) => r.address === h)!);
  expect(label(slotHex(2n))).toBe("slot 2 : rounds · total");
  expect(label(slotHex(0n))).toBe("slot 0 : length");
  expect(label(recordOf(d, A, 1)))
    .toMatch(/^keccak\(0x7099…79c8, slot 3\) \+ 1 : name · name\.length$/);
  // (all of them: the popover fits them to its box, vanilla 9728db0)
  expect(label(recordOf(d, A, 0))).toBe("keccak(0x7099…79c8, slot 3) : " +
    "lastBlock · hitCount · plays · bestCombo · combo · score");
  // a value's other region alone in its slot: by its role
  expect(label(slotHex(1n))).toBe("slot 1 : motd.length");
  // roster's items, after keccak(slot 0)
  const item1 = slotHex(d.byPath.get("roster[1]")!.regions[0].slot!);
  expect(label(item1)).toBe("keccak(slot 0) + 1 : roster[1]");
  // carol's long name: its bytes at keccak(name's slot), two words
  const data = d.byPath.get(`${C}.name`)!.regions[0].slot!;
  expect(label(slotHex(data + 1n))).toBe(
    "keccak(keccak(0x90f7…b906, slot 3) + 1) + 1 : " +
    "players[0x90f7…b906].name");
});

it("rows in strict address order, gaps marked", async () => {
  const l = layout(await mid(), "storage", { rows: "values" });
  const ns = l.rows.map((r) => BigInt(r.address));
  expect(ns).toEqual([...ns].sort((a, b) => a < b ? -1 : a > b ? 1 : 0));
  expect(new Set(ns).size).toBe(ns.length);
  l.rows.forEach((r, k) => expect(r.gapBefore, r.address).toBe(k === 0
    ? ns[0] !== 0n : ns[k] !== ns[k - 1] + 1n));
  expect(l.rows.slice(0, 4).map((r) => r.gapBefore))
    .toEqual([false, false, false, false]);
});

it("slot 3 is an own-slot row (players holds none of its data)",
  async () => {
    const l = layout(await mid(), "storage", { rows: "values" });
    const r = l.rows.find((x) => x.address === slotHex(3n))!;
    expect(r.role).toBe("own-slot");
    expect(r.what).toEqual([{ path: "players", name: "players" }]);
    // (its label: how only, as vanilla's popover; no bytes are owned)
    expect(rowLabel(r)).toBe("slot 3");
    expect(l.rows.filter((x) => x.role === "own-slot")).toHaveLength(1);
  });

it("one-point bookmark: rows 'values' only", async () => {
  const d = await mid();
  const l = layout(d, "storage", { rows: "values" });
  const owned = new Set([...l.cover.keys()].map((k) => k.split("|")[1]));
  for (const r of l.rows) {
    expect(owned.has(r.address) || r.role === "own-slot", r.address)
      .toBe(true);
  }
  expect(l.rows).toHaveLength(17);
  // (a two-point scene adds the slots its transaction read or wrote)
  const extra = slotHex(12345n);
  expect(layout(d, "storage", { rows: [extra] }).rows
    .some((r) => r.address === extra)).toBe(true);
});

it("vyper: the Vyper words appear, owned by nobody", async () => {
  const sol = await at("vyAsSol", "arcade-vyper:after");
  const vy = await at("vyRule", "arcade-vyper:after");
  const l = layout(sol, "storage", { rows: "values" },
    { others: [{ d: vy, who: "Vyper's" }] });
  const words = l.rows.filter((r) => r.how.startsWith("Vyper's"));
  expect(words).toHaveLength(3 * 8 + 1);
  expect(words.every((r) => r.what.length === 0)).toBe(true);
  expect(words.map((r) => r.how)).toContain(
    "Vyper's keccak(slot 108, 0x7099…79c8) + 2");
  expect(words.map((r) => r.how)).toContain(
    "Vyper's keccak(slot 108, 0x7099…79c8)");
  for (const r of words) {
    expect(l.cover.has(byteKey("storage", r.address, 0))).toBe(false);
  }
});

it("filter.roots keeps only those subtrees' rows (spec §6b)", async () => {
  const d = await mid();
  const l = layout(d, "storage", { roots: [A, "total", "rounds"],
    rows: "values" });
  expect(l.rows.map((r) => r.address)).toEqual([slotHex(2n),
    recordOf(d, A, 0), recordOf(d, A, 1)].sort());
  expect([...l.owned.keys()].every((p) => p === "total" ||
    p === "rounds" || p.startsWith(A))).toBe(true);
});

it("filter.maxRows cuts the rows, gaps still marked", async () => {
  const l = layout(await mid(), "storage", { rows: "values", maxRows: 5 });
  expect(l.rows).toHaveLength(5);
  expect(l.rows.map((r) => r.gapBefore))
    .toEqual([false, false, false, false, true]);
});

it.each([["sol:arcade-mid", "arcade-mid:after"],
  ["sol:arcade-alice", "arcade-alice:before"],
  ["sol:arcade-alice", "arcade-alice:after"],
  ["sol:arcade-motd", "arcade-motd:before"],
  ["sol:arcade-motd", "arcade-motd:after"],
  ["vyAsSol", "arcade-vyper:after"], ["vyRule", "arcade-vyper:after"]])(
  "%s at %s: every row is named from the graph", async (dc, point) => {
    const l = layout(await at(dc, point), "storage", { rows: "values" });
    expect(l.rows.length).toBeGreaterThan(0);
    for (const r of l.rows) expect(r.how, r.address).not.toMatch(/^slot 0x/);
  });

it("rows 'touched': the values', and the slots the point's "
  + "transaction read or wrote", async () => {
  const p = await testProject();
  const [before, after] = (await p.timeline("arcade-alice")).points;
  const d = await decode(p, p.decodings["sol:arcade-alice"], after.id);
  const values = layout(d, "storage", { rows: "values" });
  const touched = layout(d, "storage", { rows: "touched" },
    { point: after });
  const tx = after.transaction!;
  const want = [...tx.reads, ...tx.writes].filter((s) =>
    after.snapshot.storage.has(s));
  expect(want.length).toBeGreaterThan(0);
  const got = new Set(touched.rows.map((r) => r.address));
  for (const s of [...want, ...values.rows.map((r) => r.address)]) {
    expect(got.has(s), s).toBe(true);
  }
  // (no point given: as "values")
  expect(layout(d, "storage", { rows: "touched" }).rows)
    .toEqual(values.rows);
  expect(before.id).toBe("arcade-alice:before");
});
