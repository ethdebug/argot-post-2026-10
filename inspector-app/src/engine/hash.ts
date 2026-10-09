// A lens's view in the URL hash (vanilla panel.js setHash, main.js keep
// and main): its scene and selection, as the legacy keys ex and sel
// (with the lens's prefix); and the related view, rel (its context rows:
// "0", "1"; none: off). Other keys (another lens's: mopt, mpt, msel) are
// not this lens's; the old Before | After and "show other state" keys
// (mode, insets) are read as nothing.
import type { Bookmark, Path } from "./types";

export interface HashLens {
  links: string[]; bookmarks?: string[];
  // (`levels`: scene ids "O<level>/<pause>", kept as two keys, opt and
  // pt; the selection only when not the pause's default: the memory
  // section's, vanilla mem.js keep)
  hash?: { prefix: string; legacy?: boolean; levels?: boolean };
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
  if (lens.hash?.levels) {
    const p = lens.hash.prefix;
    const [opt, pt] = (bm?.id ?? "").split("/");
    return { [`${p}opt`]: bm ? opt.slice(1) : null, [`${p}pt`]: pt ?? null,
      [k.sel]: s.selection === (bm?.select ?? null) ? null
        : s.selection ?? "", ...rel };
  }
  return {
    [k.ex]: bm ? bm.id : null,
    // (a cleared default selection is kept as "sel=")
    [k.sel]: s.selection ?? (bm?.select ? "" : null),
    ...rel,
  };
}

// The view a hash asks for; a stale one (no such scene) gives the first
// scene, with its defaults
export function fromHash(lens: HashLens, h: URLSearchParams,
  bookmarks: Bookmark[]): HashState {
  const k = keys(lens);
  const ids = lens.bookmarks ?? [];
  const rel = h.get(k.rel);
  const related = rel === "0" || rel === "1" ? { related: +rel } : {};
  if (lens.hash?.levels) {
    return { ...levelsFrom(lens, h, bookmarks), ...related };
  }
  const asked = ids.includes(h.get(k.ex) ?? "") ? h.get(k.ex)! : undefined;
  const bm = bookmarks.find((b) => b.id === (asked ?? ids[0]));
  return {
    bookmark: bm?.id,
    selection: asked && h.has(k.sel) ? h.get(k.sel) || null
      : bm?.select ?? null,
    ...related,
  };
}

// (the memory section's: its level and its pause each as asked, if
// there is one; its selection as asked, else the pause's default;
// whether the tree has it is the lens's to check)
function levelsFrom(lens: HashLens, h: URLSearchParams,
  bookmarks: Bookmark[]): HashState {
  const p = lens.hash!.prefix;
  const ids = lens.bookmarks ?? [];
  const [opt0, pt0] = (ids[0] ?? "").split("/");
  const opt = ids.some((i) => i.startsWith(`O${h.get(`${p}opt`)}/`))
    ? `O${h.get(`${p}opt`)}` : opt0;
  const pt = ids.includes(`${opt}/${h.get(`${p}pt`)}`) ? h.get(`${p}pt`)!
    : pt0;
  const bm = bookmarks.find((b) => b.id === `${opt}/${pt}`);
  const sel = h.get(`${p}sel`);
  return { bookmark: bm?.id,
    selection: sel !== null ? sel || null : bm?.select ?? null };
}
