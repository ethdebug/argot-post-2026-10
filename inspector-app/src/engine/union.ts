// A scene's rows over its moments (addendum §4): a dump's rows and a
// tree's rows are the union over the scene's moments, so none appears
// or goes as the moments change. A tree path absent at a moment is kept
// in its place, muted ("not yet").
import type { Decoded, Hex, Layout, ValueNode } from "./types";

// every moment's rows, in address order
export function unionRows(ls: Layout[]): Hex[] {
  const all = new Set(ls.flatMap((l) => l.rows.map((r) => r.address)));
  return [...all].sort((a, b) => BigInt(a) < BigInt(b) ? -1
    : BigInt(a) > BigInt(b) ? 1 : 0);
}

// `d`'s tree with the paths the other moments have and it has not, each
// after its previous sibling there (first, if none), marked absent, with
// no value and no regions
export function unionTree(d: Decoded, all: Decoded[]): Decoded {
  const have = new Set(d.byPath.keys());
  const absent = (n: ValueNode): ValueNode => ({ ...n, absent: true,
    value: undefined, regions: [], reads: undefined, none: undefined,
    ...n.children ? { children: n.children.map(absent) } : {} });
  // (one level: `mine` with `theirs`' missing nodes merged in)
  const merge = (mine: ValueNode[], theirs: ValueNode[]): ValueNode[] => {
    let out = mine.map((n) => {
      const t = theirs.find((x) => x.path === n.path);
      return t?.children && n.children ? { ...n,
        children: merge(n.children, t.children) } : n;
    });
    theirs.forEach((t, k) => {
      if (out.some((n) => n.path === t.path)) return;
      const prev = theirs.slice(0, k).reverse().find((x) =>
        out.some((n) => n.path === x.path));
      const at = prev ? out.findIndex((n) => n.path === prev.path) + 1 : 0;
      out = [...out.slice(0, at), absent(t), ...out.slice(at)];
    });
    return out;
  };
  let tree = d.tree;
  for (const o of all) {
    if (o !== d && [...o.byPath.keys()].some((p) => !have.has(p))) {
      tree = merge(tree, o.tree);
    }
  }
  if (tree === d.tree) return d;
  const byPath = new Map<string, ValueNode>();
  const index = (n: ValueNode) => {
    byPath.set(n.path, n);
    n.children?.forEach(index);
  };
  tree.forEach(index);
  return { ...d, tree, byPath };
}
