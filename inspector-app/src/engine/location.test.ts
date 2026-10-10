// A gap row stands for a hidden run only where it saves room: a run of
// at most two rows, next to the kept ones, is shown instead
import { it, expect } from "vitest";
import { fillGaps } from "./location";
import type { Hex } from "./types";

const h = (n: number) => `0x${n.toString(16).padStart(64, "0")}` as Hex;
const keep = (all: number[], kept: number[]) => [...fillGaps(all.map(h),
  new Set(kept.map(h)), "storage")].map((x) => Number(BigInt(x)))
  .sort((a, b) => a - b);

it("short runs between kept rows, or from slot 0, are kept", () => {
  // (0x00, 0x01 before 0x02: kept; 0x05 alone between: kept)
  expect(keep([0, 1, 2, 3, 4, 5, 6], [2, 3, 4, 6]))
    .toEqual([0, 1, 2, 3, 4, 5, 6]);
});

it("a run of three, or one not next to its neighbours, stays a gap", () => {
  expect(keep([0, 1, 2, 3, 4], [3, 4])).toEqual([3, 4]);
  // (0x10 is not next to 0x02 nor to 0x20)
  expect(keep([2, 16, 32], [2, 32])).toEqual([2, 32]);
  // (a leading run not from slot 0)
  expect(keep([5, 6, 7], [7])).toEqual([7]);
  // (after the last kept row: the dump's own "more", no gap row filled)
  expect(keep([1, 2, 3], [1])).toEqual([1]);
});
