// How many columns a lens lays out side by side on a wide page: its
// declared `columns`, else the most areas in one row of its grid (two
// at most). A host sizes the lens's figure by it, never by measuring.
import type { LensSpec } from "./types";

export function columnsOf(l: LensSpec): 1 | 2 {
  if (l.columns) return l.columns;
  const rows = [...l.grid.matchAll(/"([^"]*)"/g)].map((m) =>
    new Set(m[1].split(/\s+/).filter((a) => a && a !== ".")).size);
  return Math.max(1, ...rows) > 1 ? 2 : 1;
}
