import { describe, expect, it } from "vitest";
import { serve } from "./worker";
import { runner } from "./client";
import { digest, runOf } from "./run";
import { arcade, runOf as ranOf } from "../../../test/run";

describe("serve", () => {
  it("posts a run whose rebuild is runScenario's", async () => {
    const s = arcade();
    const { run, transfer } = await serve({ scenario: s, build: "sol" });
    // (as postMessage would: a structured clone, the arrays moved)
    const posted = runOf(structuredClone(run, { transfer }));
    const ran = await ranOf("sol");
    expect(await digest(posted)).toBe(await digest(ran));
    for (const m of [{ tx: 3, step: 569 }, { tx: 12, step: "end" }] as
      const) {
      expect(posted.stateAt(m)).toEqual(ran.stateAt(m));
    }
    expect(transfer.length).toBeGreaterThan(0);
  });
});

describe("runner", () => {
  it("runs in this thread with no worker, once per scenario and build",
    async () => {
      const s = arcade();
      const runIn = runner(null);
      const a = runIn(s, "vy");
      expect(runIn(s, "vy")).toBe(a);
      expect(await digest(await a)).toBe(await digest(await ranOf("vy")));
    });
});
