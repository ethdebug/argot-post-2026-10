// Where the annotated layer's labels go (pure; the DOM gives only the
// geometry: ui/labels.ts). A label sits in unlit space next to the bytes
// it names, never over another label or a lit byte:
//   1. in its own rows: the largest run of free cells (zero bytes no
//      value owns, or its own unit's zero bytes) that fits it;
//   2. else in the line next to its rows (a "⋯" gap line, or a row of
//      free cells): below them first, then above;
//   3. else in the margin, beside its first row, with a leader line.
// A label has several texts, longest first; each place is tried with
// each text before the next place. Labels are placed in the order
// asked, each taking its room; the same input, the same places.

// one byte cell on a line: its extent, its unit (null: no value's, or
// not lit), and whether its byte is zero
export interface Cell { x0: number; x1: number; unit: number | null;
  zero: boolean }
// a line of the dump, in order: a row's line of cells (a row on a phone
// has two), or a gap line ("⋯"), free from x0 to x1
export type Line = { id: string; kind: "row"; cells: Cell[] }
  | { id: string; kind: "gap"; x0: number; x1: number };
export interface Ask { unit: number; lines: string[]; widths: number[] }
export interface Spot { ask: number; kind: "in" | "next" | "margin";
  line: string; x: number; variant: number }

type Span = [number, number];
const PAD = 4;

// the free spans of a line for a unit: runs of its free cells, less what
// other labels took
function free(line: Line, unit: number, taken: Span[]): Span[] {
  const runs: Span[] = [];
  if (line.kind === "gap") runs.push([line.x0, line.x1]);
  else {
    let run: Span | null = null;
    for (const c of line.cells) {
      const ok = c.zero && (c.unit === null || c.unit === unit);
      if (!ok) {
        run = null;
        continue;
      }
      if (run) run[1] = c.x1;
      else runs.push(run = [c.x0, c.x1]);
    }
  }
  return runs.flatMap((r) => taken.reduce<Span[]>((rs, t) => rs.flatMap(
    ([a, b]) => t[1] <= a || t[0] >= b ? [[a, b] as Span]
      : [...t[0] > a ? [[a, t[0]] as Span] : [],
        ...t[1] < b ? [[t[1], b] as Span] : []]), [r]));
}

// Where in a span a label of width `w` goes: next to the unit's own lit
// bytes when they end or start the span (right-aligned before them,
// left-aligned after them); else at its start
function align(line: Line, s: Span, unit: number, w: number): number {
  if (line.kind === "row") {
    const after = line.cells.find((c) => c.x0 >= s[1] - 0.5);
    if (after && after.unit === unit && !after.zero) return s[1] - PAD - w;
  }
  return s[0] + PAD;
}

// (`margin`: the margin's room; its first text that fits there)
export function place(lines: Line[], asks: Ask[],
  o: { margin?: number } = {}): Spot[] {
  const taken = new Map<string, Span[]>();
  const take = (id: string, s: Span) =>
    taken.set(id, [...taken.get(id) ?? [], s]);
  const byId = new Map(lines.map((l, i) => [l.id, i]));
  const margin = new Set<string>();
  const out: Spot[] = [];
  asks.forEach((a, n) => {
    const own = a.lines.filter((id) => byId.has(id))
      .sort((x, y) => byId.get(x)! - byId.get(y)!);
    if (!own.length) return;
    // 1. its own lines: the largest span that fits (the earlier line, the
    // left one, on a tie)
    const inOwn = (w: number) => {
      let best: { line: Line; s: Span } | null = null;
      for (const id of own) {
        const line = lines[byId.get(id)!];
        for (const s of free(line, a.unit, taken.get(id) ?? [])) {
          if (s[1] - s[0] < w + 2 * PAD) continue;
          if (!best || s[1] - s[0] > best.s[1] - best.s[0] + 0.5) {
            best = { line, s };
          }
        }
      }
      return best;
    };
    // 2. the line after its last, then before its first
    const next = (w: number) => {
      const at = [byId.get(own.at(-1)!)! + 1, byId.get(own[0])! - 1];
      for (const k of at) {
        const line = lines[k];
        if (!line || own.includes(line.id)) continue;
        const s = free(line, -1, taken.get(line.id) ?? []).find((x) =>
          x[1] - x[0] >= w + 2 * PAD);
        if (s) return { line, s };
      }
      return null;
    };
    for (const [kind, find] of [["in", inOwn], ["next", next]] as const) {
      for (const [v, w] of a.widths.entries()) {
        const got = find(w);
        if (!got) continue;
        const x = kind === "in" ? align(got.line, got.s, a.unit, w)
          : got.s[0] + PAD;
        take(got.line.id, [x - PAD, x + w + PAD]);
        out.push({ ask: n, kind, line: got.line.id, x, variant: v });
        return;
      }
    }
    // 3. the margin, beside its first line not yet used there
    const id = own.find((x) => !margin.has(x)) ?? own[0];
    margin.add(id);
    const v = a.widths.findIndex((w) => w <= (o.margin ?? Infinity));
    out.push({ ask: n, kind: "margin", line: id, x: 0,
      variant: v < 0 ? a.widths.length - 1 : v });
  });
  return out;
}
