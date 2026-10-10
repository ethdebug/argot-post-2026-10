// A replay's rows and changes (scene `replay`; ui/TimelineBar.tsx plays
// it): every row a location has at any of the replay's points, so its
// dump keeps them all from the start (mute, don't move: memory to its
// highest word, the stack to its deepest, storage every slot that holds
// something); and the bytes each step changed, a location's row and
// byte, for the play's flash
import type { Hex, Location, Snapshot } from "./types";
import { allRows, rowBytes } from "./location";

const order = (a: Hex, b: Hex) => BigInt(a) < BigInt(b) ? -1
  : BigInt(a) > BigInt(b) ? 1 : 0;

// every row `l` has at any of `snaps` (storage: the slots that hold
// something at one of them)
export function unionRows(snaps: Snapshot[], l: Location): Hex[] {
  const out = new Set<Hex>();
  for (const s of snaps) {
    for (const r of allRows(s, l)) {
      if (l !== "storage" || !/^0x0*$/.test(s.storage.get(r) ?? "0x")) {
        out.add(r);
      }
    }
  }
  return [...out].sort(order);
}

// the bytes of `rows` that differ from `a` to `b`, as "row|byte" keys
// (a byte past the end is a zero: memory growing changes none of the
// bytes it adds, a stack's pop none of the words it leaves)
export function changed(a: Snapshot, b: Snapshot, l: Location,
  rows: Hex[]): Set<string> {
  const out = new Set<string>();
  for (const r of rows) {
    const [x, y] = [rowBytes(a, l, r), rowBytes(b, l, r)];
    for (let i = 0; i < y.length; i++) {
      if (y[i] !== undefined && (x[i] ?? "00") !== y[i]) {
        out.add(`${r}|${i}`);
      }
    }
  }
  return out;
}
