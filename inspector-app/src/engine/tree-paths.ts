// A value's place in its tree, by the tree's own structure: its parent
// node, not its path's syntax (a function's locals are under the
// function's node with paths of their own: "points", not
// "multiplied.points")
import type { Path, ValueNode } from "./types";

type Tree = ReadonlyMap<Path, ValueNode>;
const cache = new WeakMap<Tree, Map<Path, Path>>();

function parents(t: Tree): Map<Path, Path> {
  let m = cache.get(t);
  if (!m) {
    m = new Map();
    for (const n of t.values()) {
      for (const c of n.children ?? []) m.set(c.path, n.path);
    }
    cache.set(t, m);
  }
  return m;
}

// (a path the tree does not hold: by its syntax, "a[1].b" -> "a[1]")
export const parentIn = (t: Tree, p: Path): Path | undefined =>
  parents(t).get(p) ?? (p.match(/^(.+?)(\.[^.[\]]+|\[[^\]]*\])$/)?.[1]);

// `p` is `root` or under it
export function within(t: Tree, p: Path, root: Path): boolean {
  for (let q: Path | undefined = p; q !== undefined; q = parentIn(t, q)) {
    if (q === root) return true;
  }
  return false;
}
