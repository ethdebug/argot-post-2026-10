// A moment of a run as the engine's point (addendum §6): a trace step's
// range, or the last one before it, muted; a local on the stack
import { describe, expect, it } from "vitest";
import { annotate } from "./run/annotate";
import { compilationOf } from "./run/build";
import { decodeLocals } from "./decode";
import { lastRange, momentPoint } from "./moment";
import { arcade, runOf } from "../../test/run";

const s = arcade();
// (alice's third hit: the bug scenes' transaction)
const TX = 12;

describe("a trace step with no range of its own", () => {
  it("shows the last range before it, muted", async () => {
    const run = await runOf("bug-O0");
    const build = s.builds["bug-O0"];
    // (the bug-O0 scene's "mult" pause, its first moment: its JUMPDEST's
    // context has no code)
    const at = 792;
    const m = annotate(run, build, { tx: TX, step: at });
    expect(m.range).toBeUndefined();
    const last = lastRange(run, build, m)!;
    // (the nearest earlier trace step with a range has it)
    let k = at - 1;
    while (!annotate(run, build, { tx: TX, step: k }).range) k--;
    expect(last).toEqual(annotate(run, build, { tx: TX, step: k }).range);
    const point = momentPoint("x", m, run.stateAt(m), { build, last });
    expect(point.paused).toMatchObject({ range: last, last: true });
  });
  it("a moment with a range is not muted", async () => {
    const run = await runOf("bug-O0");
    const build = s.builds["bug-O0"];
    const m = annotate(run, build, { tx: TX, step: 400 });
    expect(lastRange(run, build, m)).toEqual(m.range);
    const point = momentPoint("x", m, run.stateAt(m), { build,
      last: lastRange(run, build, m) });
    expect(point.paused?.last).toBeUndefined();
  });
});

describe("a local on the stack", () => {
  it("join's len: read from the stack at the moment", async () => {
    const run = await runOf("bug-O0");
    const build = s.builds["bug-O0"];
    // (bob's join: the first trace step whose context gives len a
    // stack slot)
    const tx = s.transactions.findIndex((t) => t.label.startsWith("join"));
    const at = (i: number) => {
      const m = annotate(run, build, { tx, step: i });
      return momentPoint("x", m, run.stateAt(m), { build });
    };
    let k = 1;
    while (!at(k).locals!.some((v) => v.identifier === "len" &&
      JSON.stringify(v.pointer ?? {}).includes("stack"))) k++;
    const point = at(k);
    const d = await decodeLocals(compilationOf(build), point);
    const len = d.byPath.get("len")!;
    expect(len.regions[0].location).toBe("stack");
    // (its value: the stack item its region names)
    const st = point.snapshot.stack!;
    const item = st[st.length - 1 - Number(len.regions[0].slot)];
    expect(BigInt(len.value!.hex)).toBe(BigInt(item));
  });
});
