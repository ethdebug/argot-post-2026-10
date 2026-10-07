// The details of what is pointed at (vanilla panel.js details,
// ownerInfo, regionHtml, stateHtml, forBytes and forSlot info): term
// and description rows. A description is text with code spans.
import type {
  Decoded, Hex, Layout, ResolvedRegion, Snapshot, Target,
} from "../engine/types";
import { regionBytes } from "../engine/layout";
import { byteKey, short } from "../engine/hex";

export type Part = string | { code: string };
export type Info = [term: string, desc: Part[]][];

const PLAIN = 1n << 32n;
const tail = (s: string) => `…${s.slice(-4)}`;
const shortKeys = (path: string) =>
  path.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`);
const pairs = (h?: string) =>
  (h ?? "0x" + "0".repeat(64)).slice(2).padStart(64, "0").match(/../g)!;

// What the details read: the side shown, and the pair's other side
export interface Sides {
  d: Decoded; l: Layout; snap?: Snapshot;
  // a pair: each side's decoding and words
  pair?: { before: { d: Decoded; snap?: Snapshot };
    after: { d: Decoded; snap?: Snapshot } };
}

const slotName = (l: Layout, s: Hex) =>
  l.rows.find((r) => r.address === s)?.how ??
  (BigInt(s) < PLAIN ? `slot ${BigInt(s)}` : `slot ${short(s)}`);

// "slot 2, bytes 16–31", or "slot …a723 (keccak(…)), byte 4"
function regionText(l: Layout, r: ResolvedRegion): Part[] {
  const by = new Map<Hex, [number, number]>();
  for (const [s, i] of regionBytes(r)) {
    if (!by.has(s)) by.set(s, [i, i]);
    by.get(s)![1] = i;
  }
  if (!by.size) return ["no bytes"];
  const one = ([s, [a, b]]: [Hex, [number, number]]): Part[] => {
    const slot: Part[] = BigInt(s) < PLAIN ? [`slot ${BigInt(s)}`]
      : ["slot ", { code: tail(s) }, ` (${slotName(l, s)})`];
    return [...slot, `, ${a === 0 && b === 31 ? "bytes 0–31"
      : a === b ? `byte ${a}` : `bytes ${a}–${b}`}`];
  };
  const all = [...by];
  return all.length <= 2 ? all.flatMap((x, k) => [...(k ? ["; "] : []),
    ...one(x)]) : [...one(all[0]), `, and ${all.length - 1} more slots`];
}

const hexAt = (snap: Snapshot | undefined, s: Hex, from: number,
  to: number) => "0x" + pairs(snap?.storage.get(s)).slice(from, to + 1)
  .join("");

// One state of a value: "975 (0x…03cf)"
function stateText(d: Decoded, snap: Snapshot | undefined, path: string,
  length: boolean): Part[] {
  const n = d.byPath.get(path);
  if (!n) return ["none"];
  const rs = n.regions.filter((r) => (r.role === "length") === length &&
    r.location === "storage");
  if (!rs.length) return ["none"];
  const t = length ? undefined : n.value?.text ??
    (n.children && n.regions.some((r) => r.role === "length")
      ? n.summary : undefined);
  const b = rs.length === 1 ? regionBytes(rs[0]) : [];
  if (b.length && b.every(([s]) => s === b[0][0])) {
    const h = hexAt(snap, b[0][0], b[0][1], b.at(-1)![1]);
    const hs = h.length > 18 ? `0x…${h.slice(-6)}` : h;
    return t === undefined ? [{ code: hs }] : [`${t} (`, { code: hs }, ")"];
  }
  return [t ?? ""];
}

const flat = (ps: Part[]) => ps.map((p) => typeof p === "string" ? p
  : p.code).join("");

// A value (an owner: a path, or `<path>#length`)
function ownerInfo(x: Sides, id: string): Info {
  const length = id.endsWith("#length");
  const path = id.replace(/#length$/, "");
  const n = x.d.byPath.get(path);
  const composite = !!n?.children;
  const label = length || (composite && n?.regions.length)
    ? `${shortKeys(path)} (length)` : shortKeys(path);
  const value: Part[] = [{ code: label },
    n?.typeText ? ` (${n.typeText})` : ""];
  const where = (d: Decoded) => {
    const m = d.byPath.get(path);
    return (m?.regions ?? []).filter((r) => (r.role === "length") ===
      (length || composite) && r.location === "storage")
      .flatMap((r, k) => [...(k ? ["; "] : []), ...regionText(x.l, r)]);
  };
  if (!x.pair) {
    return [["Value", value], ["Where", where(x.d)],
      ["Holds", stateText(x.d, x.snap, path, length || composite)]];
  }
  const { before: b, after: a } = x.pair;
  const wb = where(b.d);
  const wa = where(a.d);
  return [
    ["Value", value],
    ...(!wb.length || !wa.length || flat(wa) === flat(wb)
      ? [["Where", wa.length ? wa : wb] as [string, Part[]]]
      : [["Where before", wb], ["Where after", wa]] as Info),
    ["Before", stateText(b.d, b.snap, path, length || composite)],
    ["After", stateText(a.d, a.snap, path, length || composite)],
  ];
}

// The details of a target (null: nothing pointed at)
export function infoOf(x: Sides, t: Target | null): Info | null {
  if (!t) return null;
  const { l } = x;
  if (t.path && !t.bytes) {
    const ids = [...l.owned.keys()].filter((q) => {
      const p = q.replace(/#length$/, "");
      return p === t.path || p.startsWith(t.path + ".") ||
        p.startsWith(t.path + "[");
    });
    const n = x.d.byPath.get(t.path);
    if (n && (n.value || (n.children && n.regions.length) ||
      (!n.children && n.regions.length))) return ownerInfo(x, t.path);
    return [["Value", [{ code: shortKeys(t.path) }, `, ${ids.length} value${
      ids.length === 1 ? "" : "s"} below`]]];
  }
  if (t.bytes) {
    const { row: s, from, to } = t.bytes;
    const ids = [...new Set(Array.from({ length: to - from + 1 }, (_, k) =>
      l.cover.get(byteKey(t.bytes!.location, s, from + k)) ?? []).flat())];
    const range = from === to ? `byte ${from}` : `bytes ${from}–${to}`;
    const nm = slotName(l, s);
    const bytes: Part[] = [`${range} of `, ...(BigInt(s) < PLAIN
      ? [`slot ${BigInt(s)}`] : ["slot ", { code: tail(s) }, ` (${nm})`])];
    const hex: Info = x.pair
      ? [["Before", [{ code: hexAt(x.pair.before.snap, s, from, to) }]],
        ["After", [{ code: hexAt(x.pair.after.snap, s, from, to) }]]]
      : [["Hex", [{ code: hexAt(x.snap, s, from, to) }]]];
    if (!ids.length) {
      return [["Value", ["none shown owns these bytes"]],
        ["Bytes", bytes], ...hex];
    }
    if (ids.length === 1) {
      return [...ownerInfo(x, ids[0]), ["Pointed at", bytes]];
    }
    return [["Values", [{ code: ids.map((id) => shortKeys(
      id.replace(/#length$/, ""))).join(", ") }]], ["Bytes", bytes], ...hex];
  }
  if (t.row) {
    const s = t.row as Hex;
    const nm = slotName(l, s);
    const ref = BigInt(s) < PLAIN ? `slot ${BigInt(s)}` : `slot ${short(s)}`;
    const what = x.pair && x.pair.before.snap?.storage.get(s) !==
      x.pair.after.snap?.storage.get(s) ? "changed" : "unchanged";
    return [["Slot", [{ code: tail(s) }, nm === ref ? "" : ` (${nm})`]],
      ["Address", [{ code: s }]],
      ...(x.pair ? [["Transaction", [what]] as [string, Part[]]] : [])];
  }
  return null;
}

// "where" a selected value is (the rest bar's details): its regions,
// in the side shown
export function whereOf(x: Sides, path: string): Part[] {
  const info = ownerInfo(x, path);
  return info.find(([k]) => k === "Where" || k === "Where after")?.[1]
    ?? [];
}
