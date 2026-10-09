import { describe, expect, it } from "vitest";
import { sceneOf } from "./scene";
import { scenes } from "../scenes";
import { lenses } from "../lenses";
import { runOf } from "../../test/run";

describe("the scenes", () => {
  it("are in post order, each once", () => {
    expect(scenes.map((s) => s.id)).toEqual(["raw-hero", "raw-named", "mid", "alice",
      "motd", "vyper", "players-walk", "bug-O0", "bug-O2"]);
  });
  it("name lenses that exist", () => {
    for (const s of scenes) {
      expect(lenses.map((l) => l.id), s.id).toContain(s.lens);
    }
  });
  it("order their moments by (tx, step)", () => {
    const key = (m: { tx: number; step: number | "end" }) =>
      m.tx * 1e6 + (m.step === "end" ? 1e6 - 1 : m.step);
    for (const s of scenes) {
      const ks = s.timeline.map(key);
      expect(ks, s.id).toEqual([...ks].sort((a, b) => a - b));
    }
  });
  it("refer to moments inside their runs", async () => {
    for (const s of scenes) {
      const run = await runOf(s.run.build);
      for (const m of s.timeline) {
        const t = run.txs[m.tx];
        expect(t, `${s.id} ${m.tx}`).toBeDefined();
        if (m.step !== "end") expect(m.step).toBeLessThan(t.steps);
      }
    }
  });
});

describe("sceneOf", () => {
  const ok = scenes[1];
  it("refuses moments out of order, a bad step, unknown controls", () => {
    const m = (tx: number, step: number | "end") => ({ tx, step });
    expect(() => sceneOf({ ...ok, timeline: [m(2, 0), m(1, 0)] }))
      .toThrow(/order/);
    expect(() => sceneOf({ ...ok, timeline: [m(1, -1)] })).toThrow(/step/);
    expect(() => sceneOf({ ...ok, controls: "dial" })).toThrow(/controls/);
    expect(() => sceneOf({ ...ok, timeline: [] })).toThrow(/moment/);
  });
  it("refuses annotations written by hand", () => {
    expect(() => sceneOf({ ...ok, timeline: [{ tx: 1, step: 0, pc: 3 }] }))
      .toThrow(/pc/);
  });
});
