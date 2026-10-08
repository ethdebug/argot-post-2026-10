// The memory dump's rows (vanilla mem.js build, renderDumps): the words
// a local lives in at either step, and the words that changed between
// them, by offset; then alice's record slot, in storage, last
import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { layout, rowLabel } from "./layout";
import { byteKey } from "./hex";

const pair = async (o: string, pt: string, k = 1) => {
  const p = await testProject();
  const d = p.decodings[`mem:${o}`];
  const t = await p.timeline(d.timeline);
  const pts = t.points.filter((x) => x.id.startsWith(`${o}/${pt}`));
  const ds = await Promise.all(pts.map((x) => decode(p, d, x.id)));
  return { d: ds[k] ?? ds[0], other: ds.length > 1 ? ds[1 - k] : undefined,
    point: pts[k] ?? pts[0], otherPoint: pts.length > 1 ? pts[1 - k]
      : undefined };
};

it("O0 inside multiplied: the frame pointer's word, and the locals' "
  + "words at either step, by offset", async () => {
  const x = await pair("O0", "mult");
  const l = layout(x.d, "memory", {}, { compare: x.other, point: x.point,
    comparePoint: x.otherPoint });
  expect(l.rows.map((r) => r.address)).toEqual(["0x0080", "0x06c0",
    "0x06e0", "0x0720"]);
  expect(l.rows.map((r) => r.how)).toEqual(["word 0x0080", "word 0x06c0",
    "word 0x06e0", "word 0x0720"]);
  expect(l.rows.map((r) => !!r.gapBefore)).toEqual([true, true, false,
    true]);
  // (vanilla's label: the frame pointer's owner id)
  expect(rowLabel(l.rows[0])).toBe("word 0x0080 : multiplied#frame");
  // (after m = combo, m's last 4 bytes are combo's: two owners)
  expect([...l.cover.get(byteKey("memory", "0x0720", 31))!].sort())
    .toEqual(["combo", "m"]);
});

it("O2 inside multiplied: no frame word", async () => {
  const x = await pair("O2", "mult");
  const l = layout(x.d, "memory", {}, { compare: x.other, point: x.point,
    comparePoint: x.otherPoint });
  expect(l.rows.some((r) => r.address === "0x0080")).toBe(false);
});

it("before the writes: gained's word, then alice's record slot in "
  + "storage, named by BUG's rule", async () => {
  const x = await pair("O0", "writes", 0);
  const l = layout(x.d, "memory", {}, { point: x.point });
  const last = l.rows.at(-1)!;
  expect(last).toMatchObject({ location: "storage",
    address: x.point.record!.slot, how: "keccak(msg.sender, slot 4)" });
  expect(l.rows.slice(0, -1).every((r) => !r.location)).toBe(true);
  expect(l.cover.get(byteKey("storage", last.address, 24)))
    .toEqual(["players[msg.sender].score"]);
});

it("the record selected: its six members in six child colours; "
  + "multiplied: its frame word in the selection's own", async () => {
  const { forPath } = await import("./light");
  const x = await pair("O0", "writes", 0);
  const l = layout(x.d, "memory", {}, { point: x.point });
  const g = forPath(x.d, l, "players[msg.sender]", { selection: true });
  const ks = x.d.byPath.get("players[msg.sender]")!.children!.map((c) =>
    g.colours.get(c.path));
  expect(ks).toEqual([1, 2, 3, 4, 5, 6]);
  const y = await pair("O0", "mult");
  const m = layout(y.d, "memory", {}, { compare: y.other, point: y.point,
    comparePoint: y.otherPoint });
  const h = forPath(y.d, m, "multiplied", { selection: true });
  expect(h.bytes.has(byteKey("memory", "0x0080", 31))).toBe(true);
  expect(h.colours.get("multiplied")).toBe(0);
  expect(new Set(["points", "combo", "m"].map((p) => h.colours.get(p))))
    .toEqual(new Set([1, 2, 3]));
  // (a local selected: its bytes, and the frame word it is found from)
  const pts = forPath(y.d, m, "points", { selection: true });
  expect(pts.bytes.has(byteKey("memory", "0x0080", 0))).toBe(true);
});
