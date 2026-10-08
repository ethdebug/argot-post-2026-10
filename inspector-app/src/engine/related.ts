// The rows related to a selection (the "Related" view's filter): the
// rows that hold its bytes, the rows read to find it (a local's frame
// pointer), and every slot its walkthrough touches: where its keys come
// from (roster[0]), the slots it is declared at (a mapping's root), the
// slots each step hands on (a record's), the regions each step reads.
// One rule for every location; storage's state variables have a
// walkthrough, other values have none.
import type { Decoded, Hex, Location, Path, ValueNode } from "./types";
import { regionBytes } from "./location";
import { within } from "./tree-paths";
import { slotsOf, type Walkthrough } from "./walkthrough/fold";

export function related(d: Decoded, path: Path, w: Walkthrough | null,
  location: Location): Hex[] {
  const n = d.byPath.get(path);
  if (!n) return [];
  const out = new Set<Hex>();
  const visit = (x: ValueNode) => {
    for (const r of [...x.regions, ...x.reads ?? []]) {
      if (r.location !== location) continue;
      for (const [row] of regionBytes(r)) out.add(row);
    }
    x.children?.forEach(visit);
  };
  visit(n);
  if (w && location === "storage") slotsOf(w.steps).forEach((h) => out.add(h));
  return [...out].sort((a, b) => BigInt(a) < BigInt(b) ? -1 : 1);
}

// The values related to a selection, for the tree (Filter.roots): the
// selection, and the values its walkthrough's steps light outside it and
// the groups that hold it (where its keys come from: roster[0])
export function relatedValues(d: Decoded, path: Path,
  w: Walkthrough | null): Path[] {
  const out = new Set<Path>([path]);
  for (const st of w?.steps ?? []) {
    for (const q of st.rows) {
      if (d.byPath.has(q) && !within(d.byPath, q, path) &&
        !within(d.byPath, path, q)) out.add(q);
    }
  }
  return [...out];
}
