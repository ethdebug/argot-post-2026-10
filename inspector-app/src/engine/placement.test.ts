// The annotated figure's popovers: free places, the one that hides the
// least; never over another popover or out of bounds; deterministic
import { describe, it, expect } from "vitest";
import { place, REACH, roomUnder, type Cell, type Rect } from
  "./placement";

const box = (l: number, t: number, w: number, h: number): Rect =>
  ({ l, r: l + w, t, b: t + h });
// a row of 20 cells, 10px each, 10px tall at y: `spec` a char a cell
// ("." zero, no unit; a digit: that unit's digit; a–j: unit 0–9's zero)
const row = (t: number, spec: string): Cell[] => [...spec.padEnd(20, ".")]
  .map((ch, i) => ({ ...box(i * 10, t, 10, 10), unit: ch === "." ? null
    : /\d/.test(ch) ? +ch : ch.charCodeAt(0) - 97, zero: !/\d/.test(ch) }));
const B = box(0, 0, 200, 200);

describe("place", () => {
  it("never over a value's bytes, its own or another's, nor an address",
    () => {
      // (unit 0's bytes under the only place in bounds: none)
      const cells = row(20, "aaaa0000");
      expect(place([{ units: [0], shapes: [{ w: 60, h: 10 }],
        targets: [{ x: 20, t: 0, b: 10 }] }], cells,
      box(0, 0, 200, 30))).toEqual([null]);
      // (nor the address at the left)
      expect(place([{ units: [0], shapes: [{ w: 60, h: 10 }],
        targets: [{ x: 20, t: 0, b: 10 }] }], [], box(0, 0, 200, 30),
      { forbid: [box(0, 18, 200, 10)] })).toEqual([null]);
    });
  it("roomUnder: what is missing down to the next lit line", () => {
    const lines = [{ t: 100, b: 110, lit: false },
      { t: 110, b: 120, lit: false }, { t: 120, b: 130, lit: true }];
    // (30 free under b 90, a card 20 + reach 8 + 2: fits)
    expect(roomUnder(90, 20, lines, 8)).toBe(0);
    expect(roomUnder(90, 40, lines, 8)).toBe(20);
    // (nothing after: all of it)
    expect(roomUnder(90, 20, [], 8)).toBe(30);
  });
  it("away from another value's digits: below, not over row 1", () => {
    // unit 0's row at y 50; unit 1's digits just above it
    const cells = [...row(30, "11111111111111111111"), ...row(50, "0000")];
    const [s] = place([{ units: [0], shapes: [{ w: 60, h: 10 }],
      targets: [{ x: 20, t: 50, b: 60 }] }], cells, B);
    expect(s).toMatchObject({ way: "under", target: 0 });
    expect(s!.box.t).toBe(60 + REACH);
    // (its arrow on the target, inside the card)
    expect(s!.box.l + s!.ax).toBe(20);
  });
  it("the several-line shape unless the one-line hides less", () => {
    const cells = row(70, "11111111111111111111");
    const [a] = place([{ units: [0], shapes: [{ w: 60, h: 30 },
      { w: 120, h: 10 }], targets: [{ x: 100, t: 50, b: 60 }] }], cells, B);
    // (under, either shape would reach row 70's digits; over has room)
    expect(a).toMatchObject({ shape: 0, way: "over" });
  });
  it("never over another popover; none where nothing fits", () => {
    const ask = { units: [0], shapes: [{ w: 200, h: 90 }],
      targets: [{ x: 100, t: 98, b: 108 }] };
    const [a, b, c] = place([ask, ask, ask], [], box(0, 0, 200, 210));
    // (under first, as the inspector's popovers; then over)
    expect(a!.way).toBe("under");
    expect(b!.way).toBe("over");
    expect(c).toBeNull();
  });
  it("narrow: under the first run, the last shape; else " +
    "another run", () => {
    const [s] = place([{ units: [0], shapes: [{ w: 60, h: 30 },
      { w: 150, h: 10 }], targets: [{ x: 120, t: 20, b: 30 },
      { x: 50, t: 100, b: 110 }] }], [], B, { narrow: true });
    expect(s).toMatchObject({ shape: 1, target: 0, way: "under" });
    const [x, y] = place([{ units: [0], shapes: [{ w: 150, h: 10 }],
      targets: [{ x: 50, t: 20, b: 30 }] }, { units: [1],
      shapes: [{ w: 150, h: 10 }], targets: [{ x: 50, t: 20, b: 30 },
        { x: 50, t: 100, b: 110 }] }], [], B, { narrow: true });
    expect([x!.target, y!.target]).toEqual([0, 1]);
  });
  it("beside: right of its target, the arrow at its middle", () => {
    const [s] = place([{ units: [0], side: "right", shapes: [{ w: 50,
      h: 10 }], targets: [{ x: 20, r: 40, t: 0, b: 20 }] }], [], B,
    { reach: 8 });
    expect(s).toMatchObject({ way: "right", box: { l: 48, r: 98, t: 5,
      b: 15 }, ax: 5 });
  });
  it("deterministic", () => {
    const asks = [{ units: [0], shapes: [{ w: 50, h: 10 }],
      targets: [{ x: 60, t: 40, b: 50 }] }];
    const cells = row(60, "1111");
    expect(place(asks, cells, B)).toEqual(place(asks, cells, B));
  });
});
