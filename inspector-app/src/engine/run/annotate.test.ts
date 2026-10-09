import { describe, expect, it } from "vitest";
import { annotate, locals } from "./annotate";
import { arcade, runOf } from "../../../test/run";
import { PAUSE_STEPS, PAUSE_TX, pauses } from "../../../test/expect";

const s = arcade();
// a byte offset's line (the source has multi-byte characters)
const lineOf = (text: string, offset: number) => Buffer.from(text, "utf8")
  .subarray(0, offset).toString("utf8").split("\n").length;

describe("annotate", () => {
  it("the raw moment: pc 2908, ADD, lines 4-46 (README)", async () => {
    const build = s.builds.sol;
    const m = annotate(await runOf("sol"), build, { tx: 3, step: 569 });
    expect([m.pc, m.op, m.depth]).toEqual([2908, "ADD", 0]);
    const text = build.sources[0].text;
    expect(m.range!.source).toBe("0");
    expect([lineOf(text, m.range!.offset),
      lineOf(text, m.range!.offset + m.range!.length)]).toEqual([4, 46]);
  });
  it.each(["O0", "O2"] as const)("bug-%s at alice's third hit's pauses: " +
    "its range and locals (test/expect.ts)", async (o) => {
    const b = `bug-${o}`;
    const run = await runOf(b);
    const build = s.builds[b];
    const text = Buffer.from(build.sources[0].text, "utf8");
    PAUSE_STEPS[o].forEach((step, k) => {
      const m = annotate(run, build, { tx: PAUSE_TX, step });
      const r = m.range;
      expect(r && text.subarray(r.offset, r.offset + r.length).toString(),
        `${k}`).toBe(pauses[k].range);
      expect(locals(m.context!, build).map((v) => v.identifier), `${k}`)
        .toEqual(pauses[k].locals);
    });
  });
  it("trace step 0: the program's context; end: no instruction",
    async () => {
      const run = await runOf("sol");
      const build = s.builds.sol;
      expect(annotate(run, build, { tx: 5, step: 0 }).context)
        .toBe(build.programs!.runtime.context);
      expect(annotate(run, build, { tx: 0, step: 0 }).context)
        .toBe(build.programs!.create!.context);
      const end = annotate(run, build, { tx: 5, step: "end", label: "x" });
      expect(end).toEqual({ tx: 5, step: "end", label: "x" });
    });
  it("vy: pc and op, no context or range", async () => {
    const m = annotate(await runOf("vy"), s.builds.vy, { tx: 4, step: 10 });
    expect(typeof m.pc).toBe("number");
    expect(m.context).toBeUndefined();
    expect(m.range).toBeUndefined();
  });
});
