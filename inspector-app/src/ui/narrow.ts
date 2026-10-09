// A lens grid in one column (below the one breakpoint, 660px: a phone,
// a narrow frame): its areas one under another, row by row; in a row,
// the dumps before the rest (a tree after the bytes it names); an area
// that spans rows, after the last of them
export function narrowAreas(grid: string,
  classes: Record<string, string | undefined> = {}): string {
  const rows = [...grid.matchAll(/"([^"]*)"/g)].map((m) =>
    m[1].split(/\s+/).filter((a) => a && a !== "."));
  const last = new Map<string, number>();
  rows.forEach((r, i) => r.forEach((a) => last.set(a, i)));
  const dump = (a: string) => /\bdump\b/.test(classes[a] ?? "") ||
    /dump/.test(a);
  const out: string[] = [];
  rows.forEach((r, i) => {
    const here = [...new Set(r)].filter((a) => last.get(a) === i);
    for (const a of [...here.filter(dump), ...here.filter((a) => !dump(a))]) {
      if (!out.includes(a)) out.push(a);
    }
  });
  return out.map((a) => `"${a}"`).join(" ");
}
