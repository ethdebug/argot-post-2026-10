import { describe, expect, it } from "vitest";
import { move } from "./moves";
import { testProject } from "../../test/project";

const src = async () => (await testProject()).source("run:stepper-O0");
// alice's third hit (transaction 12)
const start = (s: Awaited<ReturnType<typeof src>>) =>
  s.moments.findIndex((m) => m.tx === 12);

describe("move, over the bug-O0 build's run", () => {
  it("steps by one, and to a transaction's ends", async () => {
    const s = await src();
    const i = start(s);
    expect(s.moments[i]).toMatchObject({ tx: 12, step: 0 });
    expect(s.moments[move(s, i, "next")]).toMatchObject({ tx: 12, step: 1 });
    expect(move(s, i, "prev")).toBe(i - 1);
    expect(s.moments[move(s, i + 9, "tx-first")].step).toBe(0);
    expect(s.moments[move(s, i, "tx-last")]).toMatchObject({ tx: 12,
      step: "end" });
    expect(s.moments[move(s, i, { tx: 3 })]).toMatchObject({ tx: 3,
      step: 0 });
    expect(move(s, 0, "prev")).toBe(0);
    expect(move(s, s.moments.length - 1, "next"))
      .toBe(s.moments.length - 1);
  });
  it("by range changes: each move a new range; the steps between keep " +
    "the range or have none; back undoes forth", async () => {
    const s = await src();
    let i = start(s);
    const seen: number[] = [i];
    for (let k = 0; k < 25; k++) {
      const j = move(s, i, "next-range");
      if (j === i) break;
      expect(s.moment(j).range, `${j}`).toBeDefined();
      expect(s.moment(j).range).not.toEqual(s.last(i));
      for (let x = i + 1; x < j; x++) {
        const r = s.moment(x).range;
        if (r) expect(r).toEqual(s.last(i));
      }
      seen.push(j);
      i = j;
    }
    expect(seen.length).toBe(26);
    for (let k = seen.length - 1; k > 1; k--) {
      expect(s.last(move(s, seen[k], "prev-range")))
        .toEqual(s.last(seen[k - 1]));
    }
  });
});
