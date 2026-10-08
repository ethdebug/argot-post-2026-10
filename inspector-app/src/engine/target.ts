// What the pointer (or a finger) is on, as a target (vanilla main.js
// target, blockOfPointer, baseRow; panel.js locked): "targets follow
// the blocks" (spec §4.1)
import type { Layout, Path, Target, ValueNode } from "./types";
import { byteKey } from "./hex";
import { parentIn, within } from "./tree-paths";

type Tree = ReadonlyMap<Path, ValueNode>;

// With a composite selected, the selection's immediate child whose
// block holds `path`; else `path`
export function blockOf(path: Path, selection: Path | null,
  tree: Tree): Path {
  if (!selection || path === selection) return path;
  for (let q: Path | undefined = path; q !== undefined;) {
    const up = parentIn(tree, q);
    if (up === selection) return q;
    q = up;
  }
  return path;
}

// The variable whose own slot (holding none of its data) a row is
const ownOf = (l: Layout, row: string) => l.rows.find((r) =>
  r.address === row && r.role === "own-slot")?.what[0]?.path;

// A hit (a run of bytes, a gutter address, a tree row) as a target: a
// variable's own slot is that variable; a run of bytes is its owner's
// block (with the run, when that is the owner itself); a row's address
// is the row; a tree row is its block
export function resolveTarget(hit: Target, selection: Path | null,
  tree: ReadonlyMap<Path, ValueNode>, l: Layout): Target {
  const row = hit.row ?? hit.bytes?.row;
  const own = row !== undefined ? ownOf(l, row) : undefined;
  if (own) return { path: own };
  if (hit.row !== undefined) return { row: hit.row };
  if (hit.bytes) {
    const b = hit.bytes;
    const id = l.cover.get(byteKey(b.location, b.row, b.from))?.[0];
    const owner = id?.replace(/#length$/, "");
    if (!owner || !tree.has(owner)) return { bytes: b };
    const block = blockOf(owner, selection, tree);
    return block !== owner ? { path: block } : { path: owner, bytes: b };
  }
  return hit.path ? { path: blockOf(hit.path, selection, tree) } : {};
}

// While a value is selected, the view stays on it: a hover on its own
// parts is kept (it focuses that part); any other hover is ignored
// (null). With nothing selected, the hover as it is.
export function locked(hover: Target | null, selection: Path | null,
  tree: ReadonlyMap<Path, ValueNode>): Target | null {
  if (!selection || !hover) return hover;
  const p = hover.path;
  if (!p || !tree.has(p)) return null;
  return within(tree, p, selection) ? hover : null;
}
