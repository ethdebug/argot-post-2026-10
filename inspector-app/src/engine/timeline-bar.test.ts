// The timeline bar's geometry and words (addendum §5), pure
import { describe, expect, it } from "vitest";
import {
  cutMiddle, lineOf, nearest, placeOf, segments,
} from "./timeline-bar";

const TXS = [{ label: "deploy", steps: 100 },
  { label: 'join("carol, the unstoppable combo queen")', steps: 400 },
  { label: "play()", steps: 200 }];

describe("segments", () => {
  it("equal widths, in order, labelled", () => {
    expect(segments(TXS)).toEqual([
      { x0: 0, x1: 1 / 3, label: "deploy" },
      { x0: 1 / 3, x1: 2 / 3, label: TXS[1].label },
      { x0: 2 / 3, x1: 1, label: "play()" }]);
    expect(segments([])).toEqual([]);
  });
});

describe("placeOf", () => {
  it("within its transaction's segment, by trace step; the end, its end",
    () => {
      const steps = TXS.map((t) => t.steps);
      expect(placeOf({ tx: 0, step: 0 }, steps)).toBe(0);
      expect(placeOf({ tx: 1, step: 200 }, steps)).toBeCloseTo(0.5);
      expect(placeOf({ tx: 2, step: "end" }, steps)).toBe(1);
      expect(placeOf({ tx: 1, step: "end" }, steps)).toBeCloseTo(2 / 3);
    });
});

describe("nearest", () => {
  it("the mark nearest a place (a drag snaps to it)", () => {
    expect(nearest([0.1, 0.5, 0.9], 0.62)).toBe(1);
    expect(nearest([0.1, 0.5, 0.9], 0.95)).toBe(2);
    expect(nearest([], 0.5)).toBe(-1);
  });
});

describe("cutMiddle", () => {
  it("a call's argument cut at its end, its closing kept", () => {
    expect(cutMiddle(TXS[1].label, 16)).toBe('join("carol, …")');
    expect(cutMiddle('join("abcdefghijkl")', 14)).toBe('join("abcd …")');
  });
  it("other text cut in the middle; short text whole", () => {
    expect(cutMiddle("abcdefghij", 7)).toBe("abc…hij");
    expect(cutMiddle("play()", 15)).toBe("play()");
  });
});

describe("lineOf", () => {
  it("the moment's label; else its transaction, trace step, op", () => {
    expect(lineOf({ tx: 1, step: 3, label: "while carol joins" },
      TXS[1].label)).toBe("while carol joins");
    expect(lineOf({ tx: 1, step: 412, op: "SSTORE" }, TXS[1].label))
      .toBe('join("carol, …") · trace step 412 · SSTORE');
    expect(lineOf({ tx: 2, step: "end" }, "play()"))
      .toBe("play() · after the transaction");
  });
});
