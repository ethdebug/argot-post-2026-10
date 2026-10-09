import { describe, expect, it } from "vitest";
import { storageAt } from "./journal";
import type { Frame, Journal } from "./types";
import type { Hex } from "../types";

const frame = (depth: number, first: number, last: number,
  reverted = false): Frame => ({ depth, address: "0xc", codeAddress: "0xc",
  caller: "0xa", calldata: new Uint8Array(), first, last, reverted });
const s = (n: number): Hex => `0x${n}`;

describe("storageAt", () => {
  // frame 0: steps 0-9; frame 1 (reverted): 2-5, frame 2 inside it: 3-4
  const frames = [frame(0, 0, 9), frame(1, 2, 5, true), frame(2, 3, 4)];
  const j: Journal = [
    { step: 1, frame: 0, slot: s(1), value: s(10) },
    { step: 2, frame: 1, slot: s(2), value: s(20) },
    { step: 3, frame: 2, slot: s(3), value: s(30) },
    { step: 7, frame: 0, slot: s(1), value: s(11) },
  ];
  const before = new Map<Hex, Hex>([[s(1), s(0)], [s(4), s(40)]]);
  it("applies the writes before the trace step", () => {
    expect(storageAt(j, frames, 1, before).get(s(1))).toBe(s(0));
    expect(storageAt(j, frames, 2, before).get(s(1))).toBe(s(10));
    expect(storageAt(j, frames, 8, before).get(s(1))).toBe(s(11));
    expect(storageAt(j, frames, 8, before).get(s(4))).toBe(s(40));
  });
  it("keeps a reverting frame's writes until it reverts", () => {
    const at4 = storageAt(j, frames, 4, before);
    expect([at4.get(s(2)), at4.get(s(3))]).toEqual([s(20), s(30)]);
    const at6 = storageAt(j, frames, 6, before);
    expect([at6.has(s(2)), at6.has(s(3))]).toEqual([false, false]);
  });
  it("does not change `before`", () => {
    storageAt(j, frames, 9, before);
    expect(before.get(s(1))).toBe(s(0));
  });
});
