// A lens's view in the URL hash (vanilla panel.js setHash, main.js keep
// and main): its bookmark, side, selection and "show other state", as
// the legacy keys ex, mode, sel, insets (with the lens's prefix). Other
// keys (another lens's: mopt, mpt, mmode, msel) are not this lens's.
import type { Bookmark, Path } from "./types";

export interface HashLens {
  links: string[]; bookmarks?: string[];
  hash?: { prefix: string; legacy?: boolean };
}
export interface HashState {
  bookmark?: string; side: "before" | "after"; insets: boolean;
  selection: Path | null;   // the first link group's
}

const keys = (lens: HashLens) => {
  const p = lens.hash?.prefix ?? "";
  return { ex: `${p}ex`, mode: `${p}mode`, sel: `${p}sel`,
    insets: `${p}insets` };
};

// The keys to set (null: remove)
export function toHash(lens: HashLens, s: HashState,
  bookmarks: Bookmark[]): Record<string, string | null> {
  const k = keys(lens);
  const bm = bookmarks.find((b) => b.id === s.bookmark);
  const single = !bm || bm.points.length === 1;
  return {
    [k.ex]: bm ? bm.id : null,
    [k.mode]: single ? null : s.side,
    // (a cleared default selection is kept as "sel=")
    [k.sel]: s.selection ?? (bm?.select ? "" : null),
    [k.insets]: s.insets || single ? null : "0",
  };
}

// The view a hash asks for; a stale one (no such bookmark) gives the
// first bookmark, with its defaults
export function fromHash(lens: HashLens, h: URLSearchParams,
  bookmarks: Bookmark[]): HashState {
  const k = keys(lens);
  const ids = lens.bookmarks ?? [];
  const asked = ids.includes(h.get(k.ex) ?? "") ? h.get(k.ex)! : undefined;
  const bm = bookmarks.find((b) => b.id === (asked ?? ids[0]));
  const single = !bm || bm.points.length === 1;
  const mode = h.get(k.mode);
  const side = !single && asked && (mode === "before" || mode === "after")
    ? mode : single ? "after" : (bm as { side?: "before" | "after" })
      ?.side ?? "after";
  return {
    bookmark: bm?.id, side,
    insets: h.get(k.insets) !== "0",
    selection: asked && h.has(k.sel) ? h.get(k.sel) || null
      : bm?.select ?? null,
  };
}
