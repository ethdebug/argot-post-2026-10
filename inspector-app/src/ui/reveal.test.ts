import { it, expect } from "vitest";
import { REVEAL, entrance, stage } from "./reveal";

// every scored value, and a panel not scored
const values = [
  ...Object.entries(REVEAL.score).flatMap(([loc, s]) =>
    s.map((_, r) => [loc, r, s.length] as const)),
  ["other", 0, 3], ["other", 2, 3]] as const;
const steps = Array.from({ length: 401 }, (_, i) => i / 400);

it("each value: off at 0, fully on at 1, rising with the progress", () => {
  for (const [loc, r, n] of values) {
    expect(stage(loc, r, n, 0)).toEqual({ f: 0, p: 0 });
    expect(stage(loc, r, n, 1)).toEqual({ f: 1, p: 1 });
    let was = { f: 0, p: 0 };
    for (const p of steps) {
      const g = stage(loc, r, n, p);
      expect(g.f).toBeGreaterThanOrEqual(was.f);
      expect(g.p).toBeGreaterThanOrEqual(was.p);
      // (its card after its bytes begin)
      if (g.p > 0) expect(g.f).toBeGreaterThan(0.2);
      was = g;
    }
  }
});

it("scrubs back the same way it came", () => {
  for (const [loc, r, n] of values) {
    const up = steps.map((p) => stage(loc, r, n, p));
    const down = [...steps].reverse().map((p) => stage(loc, r, n, p));
    expect(down.reverse()).toEqual(up);
  }
});

it("one voice, then another, then more: the entrances quicken", () => {
  const starts = [...new Set(Object.values(REVEAL.score).flat()
    .map(([s]) => s))].sort((a, b) => a - b);
  const gaps = starts.slice(1).map((s, i) => s - starts[i]);
  // (the theme alone, then its answer, longest)
  expect(gaps[0]).toBe(Math.max(...gaps));
  expect(gaps[0]).toBeGreaterThan(gaps.at(-1)! * 3);
  // (and done before the progress is)
  for (const [loc, s] of Object.entries(REVEAL.score)) {
    s.forEach((_, r) => {
      const [a, len] = entrance(loc, r, s.length);
      expect(a + len).toBeLessThanOrEqual(1);
    });
  }
});
