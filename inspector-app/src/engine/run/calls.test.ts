// The call stack on annotated moments (annotate.ts), from bugc -O2's
// invoke and return marks: some step of the run in a real call with an
// inlined one inside it, its call site a range of the source; a step
// with no frame carries none
import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { runOf } from "../../../test/run";
import { annotator } from "./annotate";
import type { Build } from "./types";

it("bugc -O2: a real call's frame, and an inlined one in it with its " +
  "call site", async () => {
  const build = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..",
    "..", "scenarios", "arcade", "builds", "bug-O2", "build.json"),
  "utf8")) as Build;
  const run = await runOf("bug-O2");
  const at = annotator(run, build);
  const seen = { none: false, nested: false };
  for (const [tx, t] of run.txs.entries()) {
    for (let i = 0; i < t.steps; i += 3) {
      const calls = at({ tx, step: i }).calls ?? [];
      if (!calls.length) seen.none = true;
      const k = calls.findIndex((c) => c.inline);
      if (k > 0 && !calls[0].inline && calls[k].site) {
        expect(calls[k].site!.length).toBeGreaterThan(0);
        seen.nested = true;
      }
    }
    if (seen.none && seen.nested) break;
  }
  expect(seen).toEqual({ none: true, nested: true });
}, 120_000);
