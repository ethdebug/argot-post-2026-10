// The memory dump's rows (vanilla mem.js build, renderDumps): the words
// a local lives in at either step, and the words that changed between
// them, by offset; and storage's, in a dump of its own
import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { layout, rowLabel } from "./layout";
import { byteKey, slotHex } from "./hex";
import { A } from "../../test/expect";

// (a pause: its group's moments, in the bug scene's scope decoding)
const pair = async (o: string, pt: string, k = 1) => {
  const p = await testProject();
  const d = p.decodings[`bug-${o}/scope`];
  const t = await p.timeline(d.timeline);
  const ids = p.bookmarks.find((b) => b.id === `${o}/${pt}`)!.points;
  const pts = t.points.filter((x) => ids.includes(x.id));
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
  // (vanilla's label: the frame pointer's owner id)
  expect(rowLabel(l.rows.find((r) => r.address === "0x0080")!))
    .toBe("memory 0x0080 : _applyCombo#frame");
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
  expect(l.rows.filter((r) => r.what.length).map((r) => r.how))
    .toEqual(["memory 0x00a0"]);
  const s = layout(x.d, "storage", {}, { point: x.point });
  const slot = slotHex(x.d.byPath.get(`${A}.score`)!.regions[0].slot!);
  expect(s.rows.map((r) => r.address)).toContain(slot);
  expect(s.cover.get(byteKey("storage", slot, 24)))
    .toEqual([`${A}.score`]);
});

it("the record selected: its members in child colours; "
  + "_applyCombo: its frame word in the selection's own", async () => {
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
  const h = forPath(y.d, m, "_applyCombo", { selection: true });
  expect(h.bytes.has(byteKey("memory", "0x0080", 31))).toBe(true);
  expect(h.colours.get("_applyCombo")).toBe(0);
  expect(new Set(["points", "combo", "mult"].map((p) => h.colours.get(p))))
    .toEqual(new Set([1, 2, 3]));
  // (a local selected: its bytes, and the frame word it is found from)
  const pts = forPath(y.d, m, "points", { selection: true });
  expect(pts.bytes.has(byteKey("memory", "0x0080", 0))).toBe(true);
});
