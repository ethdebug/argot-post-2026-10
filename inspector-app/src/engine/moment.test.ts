// A moment of a run as the engine's point (addendum §6): bug-O0 and
// bug-O2 at the memory section's paused trace steps give memory.json's
// source ranges, and its locals with the values the section decodes
// from memory.json today
import { describe, expect, it } from "vitest";
import { annotate } from "./run/annotate";
import { compilationOf } from "./run/build";
import { decode, decodeLocals } from "./decode";
import { lastRange, momentPoint } from "./moment";
import type { Decoded, ValueNode } from "./types";
import { arcade, runOf } from "../../test/run";
import { testProject } from "../../test/project";
import { fixture } from "../../test/io";

const s = arcade();
const memory = fixture("memory");
// (alice's third hit: memory.json's transaction, in the runs)
const TX = 12;

// a local: its value (or "none": no location), and the bytes it owns
// and reads
const local = (n?: ValueNode) => n && { value: n.none ? "none"
  : n.value?.text, bytes: [...n.regions, ...n.reads ?? []].map((r) =>
  [r.location, r.name, r.offset, r.length]) };
const locals = (d: Decoded, names: string[]) =>
  Object.fromEntries(names.map((x) => [x, local(d.byPath.get(x))]));

describe("bug runs at memory.json's paused trace steps", async () => {
  const project = await testProject();
  for (const level of memory.levels) {
    const o = `O${level.optimize}`;
    const build = s.builds[`bug-${o}`];
    const c = compilationOf(build);
    for (const p of level.points) {
      p.steps.forEach((at: { step: number; range?: object;
        variables: { identifier: string }[] }, k: number) => {
        const id = p.steps.length === 1 ? `${o}/${p.id}` : `${o}/${p.id}:${k}`;
        it(`${id}: its range and its locals' values`, async () => {
          const run = await runOf(`bug-${o}`);
          // (memory.json's state is after its trace step: the next one)
          const m = annotate(run, build, { tx: TX, step: at.step + 1 });
          const point = momentPoint(id, m, run.stateAt(m),
            { build, steps: run.txs[TX].steps });
          const r = point.paused?.range;
          expect(point.paused?.last ? undefined : r && { offset: r.offset,
            length: r.length }).toEqual(at.range);
          const names = at.variables.map((v) => v.identifier);
          expect(point.locals!.map((v) => v.identifier)).toEqual(names);
          const want = await decode(project, project.decodings[`mem:${o}`],
            id);
          const got = await decodeLocals(c, point);
          expect(locals(got, names)).toEqual(locals(want, names));
        });
      });
    }
  }
});

describe("a trace step with no range of its own", () => {
  it("shows the last range before it, muted", async () => {
    const run = await runOf("bug-O0");
    const build = s.builds["bug-O0"];
    // (memory.json's "mult" pause: its JUMPDEST's context has no code)
    const at = memory.levels[0].points.find((p: { id: string }) =>
      p.id === "mult").steps[0].step + 1;
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
