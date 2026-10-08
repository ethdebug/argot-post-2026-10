// A lens's view in the URL hash (vanilla panel.js setHash, main.js keep
// and main): its bookmark, side, selection and "show other state", as
// the legacy keys ex, mode, sel, insets (with the lens's prefix). Other
// keys (another lens's: mopt, mpt, mmode, msel) are not this lens's.
import type { Bookmark, Path } from "./types";

export interface HashLens {
  links: string[]; bookmarks?: string[];
  // (`levels`: bookmark ids "O<level>/<pause>", kept as two keys, opt
  // and pt; the selection only when not the pause's default; no insets:
  // the memory section's, vanilla mem.js keep)
  hash?: { prefix: string; legacy?: boolean; levels?: boolean };
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
  if (lens.hash?.levels) {
    const p = lens.hash.prefix;
    const [opt, pt] = (bm?.id ?? "").split("/");
    return { [`${p}opt`]: bm ? opt.slice(1) : null, [`${p}pt`]: pt ?? null,
      [k.mode]: single ? null : s.side,
      [k.sel]: s.selection === (bm?.select ?? null) ? null
        : s.selection ?? "" };
  }
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
  if (lens.hash?.levels) return levelsFrom(lens, h, bookmarks);
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

// (the memory section's: its level and its pause each as asked, if
// there is one; its mode if it is one; its selection as asked, else the
// pause's default; whether the tree has it is the lens's to check)
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
  const mode = h.get(`${p}mode`);
  const sel = h.get(`${p}sel`);
  return { bookmark: bm?.id,
    side: bm && bm.points.length > 1 && (mode === "before" ||
      mode === "after") ? mode : "after",
    insets: true,
    selection: sel !== null ? sel || null : bm?.select ?? null };
}
