// The declaration to mark in the source for a value (vanilla main.js
// declaration): a struct member's struct, from its ethdebug type's
// definition.location; else its variable's, from the program context's
// declaration. A byte range of the source.
import type { Compilation, Decoded, Path } from "./types";
import { parentIn } from "./tree-paths";

type Range = { offset: number; length: number };

export function declarationOf(c: Compilation, d: Decoded, path: Path):
  Range | null {
  const up = parentIn(d.byPath, path);
  const parent = up !== undefined ? d.byPath.get(up) : undefined;
  const t = parent && c.types[parent.type] as { kind?: string;
    definition?: { location?: { range?: Range } } } | undefined;
  if (t?.kind === "struct" && t.definition?.location?.range) {
    return t.definition.location.range;
  }
  const root = d.byPath.get(path)?.root ?? path.split(/[.[]/)[0];
  const v = c.stateVariables.find((x) => x.identifier === root) as
    { declaration?: { range?: Range } } | undefined;
  return v?.declaration?.range ?? null;
}

// a byte range's lines, [first, last], counted from 0
export function linesOf(text: string, r: Range): [number, number] {
  const bytes = new TextEncoder().encode(text);
  const dec = new TextDecoder();
  const before = dec.decode(bytes.slice(0, r.offset));
  const inside = dec.decode(bytes.slice(r.offset, r.offset + r.length));
  const first = before.split("\n").length - 1;
  return [first, first + inside.split("\n").length - 1];
}
