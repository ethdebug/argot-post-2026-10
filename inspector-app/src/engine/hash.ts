// A lens's view in the URL hash (vanilla panel.js setHash, main.js keep
// and main): its scene and selection, as the legacy keys ex and sel
// (with the lens's prefix); and the related view, rel ("1"; "0", an old
// link's, on too; none: off). Other keys (another lens's: mopt, mpt, msel) are
// not this lens's; the old Before | After and "show other state" keys
// (mode, insets) are read as nothing.
import type { Bookmark, Path } from "./types";

export interface HashLens {
  links: string[]; bookmarks?: string[];
  hash?: { prefix: string; legacy?: boolean };
  // (its own first scene, when not its first bookmark: the shell's
  // #scene=; a hash that asks for none gives it)
  initial?: { scene?: string };
}
export interface HashState {
  bookmark?: string;
  selection: Path | null;   // the first link group's
  related?: number;         // the related view's context (none: off)
}

const keys = (lens: HashLens) => {
  const p = lens.hash?.prefix ?? "";
  return { ex: `${p}ex`, sel: `${p}sel`, rel: `${p}rel`,
    // (the old Before | After and "show other state": written as none)
    gone: { [`${p}mode`]: null, [`${p}insets`]: null } };
};

// The keys to set (null: remove)
export function toHash(lens: HashLens, s: HashState,
  bookmarks: Bookmark[]): Record<string, string | null> {
  const k = keys(lens);
  const bm = bookmarks.find((b) => b.id === s.bookmark);
  const rel = { [k.rel]: s.related === undefined ? null
    : String(s.related), ...k.gone };
  return {
    [k.ex]: bm ? bm.id : null,
    // (a cleared default selection is kept as "sel=")
    [k.sel]: s.selection ?? (bm?.select ? "" : null),
    ...rel,
  };
}

const first = (lens: HashLens) => {
  const ids = lens.bookmarks ?? [];
  const own = lens.initial?.scene;
  return own && ids.includes(own) ? own : ids[0];
};

// The view a hash asks for; a stale one (no such scene) gives the lens's
// first scene (its own, or its first bookmark), with its defaults
export function fromHash(lens: HashLens, h: URLSearchParams,
  bookmarks: Bookmark[]): HashState {
  const k = keys(lens);
  const ids = lens.bookmarks ?? [];
  const rel = h.get(k.rel);
  const related = rel === "0" || rel === "1" ? { related: 1 } : {};
  const asked = ids.includes(h.get(k.ex) ?? "") ? h.get(k.ex)! : undefined;
  const bm = bookmarks.find((b) => b.id === (asked ?? first(lens)));
  return {
    bookmark: bm?.id,
    selection: asked && h.has(k.sel) ? h.get(k.sel) || null
      : bm?.select ?? null,
    ...related,
  };
}
