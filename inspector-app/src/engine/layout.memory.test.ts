// The memory dump's rows (vanilla mem.js build, renderDumps): the words
// a local lives in at either step, and the words that changed between
// them, by offset; and storage's, in a dump of its own
import { it, expect } from "vitest";
import { pauseOf, testProject } from "../../test/project";
import { decode } from "./decode";
import { layout, rowLabel } from "./layout";
import { byteKey, slotHex } from "./hex";
import { A } from "../../test/expect";

// (a pause: its trace steps, test/expect.ts PAUSE_STEPS, in the
// debugger's decoding of the bug run; "mult": two, either side of
// `mult = combo`)
const PAUSE: Record<string, number[]> = { roll: [0], mult: [1, 2],
  writes: [3] };
const pair = async (o: "O0" | "O2", pt: string, k = 1) => {
  const p = await testProject();
  const at = await Promise.all(PAUSE[pt].map((i) => pauseOf(p, o, i)));
  const d = at[0].decoding;
  const pts = await Promise.all(at.map((x) => p.point(d.timeline,
    x.point)));
  const ds = await Promise.all(pts.map((x) => decode(p, d, x.id)));
  return { d: ds[k] ?? ds[0], other: ds.length > 1 ? ds[1 - k] : undefined,
    point: pts[k] ?? pts[0], otherPoint: pts.length > 1 ? pts[1 - k]
      : undefined };
};

it("O0 inside _applyCombo: the frame pointer's word, and the locals' "
  + "words at either step, by offset", async () => {
  const x = await pair("O0", "mult");
  const l = layout(x.d, "memory", {}, { compare: x.other, point: x.point,
    comparePoint: x.otherPoint });
  // (the whole segment, every word from 0x0000 to its end, no gap;
  // the related view elides it: the maintainer, 10-08)
  const n = Math.ceil(x.point.snapshot.memory!.length / 32);
  expect(l.rows.map((r) => r.address)).toEqual(Array.from({ length: n },
    (_, k) => `0x${(k * 32).toString(16).padStart(4, "0")}`));
  expect(l.rows.every((r) => !r.gapBefore)).toBe(true);
  expect(l.more).toBe(false);
  for (const a of ["0x0080", "0x0980", "0x09a0", "0x09e0"]) {
    expect(l.rows.find((r) => r.address === a)!.how).toBe(`memory ${a}`);
  }
  // (the frame pointer's word: read to find the locals, owned by none)
  expect(rowLabel(l.rows.find((r) => r.address === "0x0080")!))
    .toBe("memory 0x0080");
  // (the related view: the selection's words and near ones, gaps between)
  const only = layout(x.d, "memory", { only: { rows: ["0x0080",
    "0x09e0"] } }, { compare: x.other, point: x.point,
    comparePoint: x.otherPoint });
  expect(only.rows.map((r) => r.address)).toEqual(["0x0080", "0x09e0"]);
  expect(only.rows.map((r) => !!r.gapBefore)).toEqual([true, true]);
  // (after mult = combo, mult's last 4 bytes are combo's: two owners)
  expect([...l.cover.get(byteKey("memory", "0x09e0", 31))!].sort())
    .toEqual(["combo", "mult"]);
});

it("O2 inside _applyCombo: no frame word", async () => {
  const x = await pair("O2", "mult");
  const l = layout(x.d, "memory", {}, { compare: x.other, point: x.point,
    comparePoint: x.otherPoint });
  // (the word is shown, as the whole segment is; no value owns it)
  expect(l.rows.find((r) => r.address === "0x0080")?.what).toEqual([]);
});

it("before the writes: gained's word in memory; alice's record slot, in "
  + "storage, its own dump's", async () => {
  const x = await pair("O0", "writes", 0);
  const l = layout(x.d, "memory", {}, { point: x.point });
  const gained = x.d.byPath.get("gained")!.regions[0];
  expect(l.rows.find((r) => r.address === `0x${(gained.offset & ~31)
    .toString(16).padStart(4, "0")}`)!.what.map((w) => w.path))
    .toContain("gained");
  const s = layout(x.d, "storage", {}, { point: x.point });
  const slot = slotHex(x.d.byPath.get(`${A}.score`)!.regions[0].slot!);
  expect(s.rows.map((r) => r.address)).toContain(slot);
  expect(s.cover.get(byteKey("storage", slot, 24)))
    .toEqual([`${A}.score`]);
});

it("the record selected: its members in child colours; a local: its "
  + "bytes and the frame word it is found from", async () => {
  const { forPath } = await import("./light");
  const x = await pair("O0", "writes", 0);
  const l = layout(x.d, "storage", {}, { point: x.point });
  const g = forPath(x.d, l, A, { selection: true });
  const ks = x.d.byPath.get(A)!.children!.slice(0, 6).map((c) =>
    g.colours.get(c.path));
  expect(ks).toEqual([1, 2, 3, 4, 5, 6]);
  const y = await pair("O0", "mult");
  const m = layout(y.d, "memory", {}, { compare: y.other, point: y.point,
    comparePoint: y.otherPoint });
  // (a local selected: its bytes, and the frame word it is found from)
  const pts = forPath(y.d, m, "points", { selection: true });
  expect(pts.bytes.has(byteKey("memory", "0x0080", 0))).toBe(true);
});
