import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { annotate, locals } from "./annotate";
import { arcade, runOf } from "../../../test/run";

const fixture = (id: string) => JSON.parse(fs.readFileSync(path.join(
  __dirname, "..", "..", "..", "..", "demos", "inspector", "fixtures",
  `${id}.json`), "utf8"));
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
  it("bug-O0 at memory.json's paused steps: its range and locals",
    async () => {
      const level = fixture("memory").levels[0];
      const run = await runOf("bug-O0");
      for (const p of level.points) {
        for (const at of p.steps) {
          // (memory.json's state is after its trace step: the next one,
          // with that step's instruction's context)
          const m = annotate(run, s.builds["bug-O0"],
            { tx: 12, step: at.step + 1 });
          const what = `${p.id} ${at.step}`;
          expect(m.range && { offset: m.range.offset,
            length: m.range.length }, what).toEqual(at.range);
          const names = locals(m.context!, s.builds["bug-O0"])
            .map((v) => v.identifier);
          expect(names, what)
            .toEqual(at.variables.map((v: { identifier: string }) =>
              v.identifier));
        }
      }
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
