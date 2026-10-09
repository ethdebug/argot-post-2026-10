// The labels' placement: unlit space next to their bytes, then the line
// beside them, then the margin; never over a lit byte or another label
import { describe, it, expect } from "vitest";
import { place, type Cell, type Line } from "./placement";

// a row of 32 cells, 10px each: `spec` a char a cell ("." zero, no unit;
// a digit: that unit's nonzero byte; a letter a–j: unit 0–9's zero byte)
const row = (id: string, spec: string): Line => ({ id, kind: "row",
  cells: [...spec.padEnd(32, ".")].map((ch, i): Cell => ({ x0: i * 10,
    x1: i * 10 + 10, unit: ch === "." ? null : /\d/.test(ch) ? +ch
      : ch.charCodeAt(0) - 97, zero: !/\d/.test(ch) })) });
const gap = (id: string): Line => ({ id, kind: "gap", x0: 0, x1: 320 });

describe("placement", () => {
  it("in its own row: the largest run of free cells, beside its bytes",
    () => {
      // unit 0: its zeros (a) then its byte; zeros no one owns after
      const lines = [row("r0", `${"a".repeat(31)}0`)];
      const [s] = place(lines, [{ unit: 0, lines: ["r0"], widths: [100] }]);
      // (right-aligned before its own lit byte)
      expect(s).toEqual({ ask: 0, kind: "in", line: "r0", x: 206,
        variant: 0 });
    });

  it("never over another unit's bytes, zero or not, nor a label", () => {
    // unit 1's zeros (b) are not free for unit 0
    const lines = [row("r0", `${"b".repeat(16)}${"a".repeat(15)}0`)];
    const ss = place(lines, [{ unit: 0, lines: ["r0"], widths: [100] },
      { unit: 0, lines: ["r0"], widths: [100] }]);
    expect(ss[0].kind).toBe("in");
    expect(ss[0].x).toBeGreaterThanOrEqual(160);
    // (the second: no room left in the row, and no line beside it)
    expect(ss[1].kind).toBe("margin");
  });

  it("a shorter text before another place; the next line, below first",
    () => {
      const lines = [gap("g0"), row("r0", "0".repeat(26) + "aaaaaa"),
        gap("g1")];
      const [a] = place(lines, [{ unit: 0, lines: ["r0"],
        widths: [100, 40] }]);
      expect(a).toMatchObject({ kind: "in", variant: 1 });
      const [b] = place(lines, [{ unit: 0, lines: ["r0"],
        widths: [100, 70] }]);
      expect(b).toMatchObject({ kind: "next", line: "g1", x: 4,
        variant: 0 });
    });

  it("a row of free cells beside it is a next line too; then above", () => {
    const lines = [row("r0", "."), row("r1", "0".repeat(32)),
      row("r2", "1".repeat(32))];
    const [s] = place(lines, [{ unit: 0, lines: ["r1"], widths: [50] }]);
    expect(s).toMatchObject({ kind: "next", line: "r0" });
  });

  it("the margin, by the first line not yet used there; the text that " +
    "fits its room", () => {
    const lines = [row("s0", "0".repeat(32)), row("s1", "1".repeat(32))];
    const ss = place(lines, [{ unit: 0, lines: ["s0"], widths: [200, 90] },
      { unit: 1, lines: ["s1"], widths: [80] }], { margin: 100 });
    expect(ss).toEqual([
      { ask: 0, kind: "margin", line: "s0", x: 0, variant: 1 },
      { ask: 1, kind: "margin", line: "s1", x: 0, variant: 0 }]);
  });

  it("deterministic: the same input, the same places", () => {
    const lines = [gap("g"), row("a", "aaaaaaaaaa0"), row("b", "bbbbbbbb1")];
    const asks = [{ unit: 0, lines: ["a"], widths: [60] },
      { unit: 1, lines: ["b"], widths: [60] }];
    expect(place(lines, asks)).toEqual(place(lines, asks));
  });
});
