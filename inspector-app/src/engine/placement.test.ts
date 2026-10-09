// The popovers' places: the one that hides the fewest bytes (a byte that
// is not zero, the worst), never over another popover or out of bounds
import { describe, it, expect } from "vitest";
import { choose, type Cell, type Rect } from "./placement";

const box = (l: number, t: number, w = 100, h = 10): Rect =>
  ({ l, r: l + w, t, b: t + h });
// a row of 10 cells, 10px each, at y: `spec` a char a cell ("." zero,
// no unit; a digit: that unit's nonzero byte; a–j: unit 0–9's zero)
const row = (t: number, spec: string): Cell[] => [...spec.padEnd(10, ".")]
  .map((ch, i) => ({ ...box(i * 10, t, 10), unit: ch === "." ? null
    : /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 97, zero: !/\d/.test(ch) }));

describe("choose", () => {
  it("the place over a gap rather than over bytes", () => {
    const cells = [...row(0, "000"), ...row(10, "aaa111")];
    // (under row 0: over row 1; over row 0, at y -10: nothing there)
    expect(choose([{ units: [0], places: [box(0, 10), box(0, -10)] }],
      cells)).toEqual([1]);
  });
  it("zeros before digits; the first on a tie", () => {
    const cells = [...row(10, "bbbbbbbbbb"), ...row(30, "1")];
    expect(choose([{ units: [0], places: [box(0, 30), box(0, 10)] }],
      cells)).toEqual([1]);
    expect(choose([{ units: [0], places: [box(0, 50), box(0, 60)] }],
      cells)).toEqual([0]);
  });
  it("never over another popover, nor out of bounds", () => {
    const asks = [{ units: [0], places: [box(0, 0)] },
      { units: [1], places: [box(50, 5), box(0, 40), box(0, 200)] }];
    expect(choose(asks, [], box(0, 0, 400, 100))).toEqual([0, 1]);
    expect(choose([{ units: [0], places: [box(0, 200)] }], [],
      box(0, 0, 400, 100))).toEqual([-1]);
  });
  it("deterministic", () => {
    const asks = [{ units: [0], places: [box(0, 0), box(0, 20)] }];
    const cells = row(5, "1111");
    expect(choose(asks, cells)).toEqual(choose(asks, cells));
  });
});
