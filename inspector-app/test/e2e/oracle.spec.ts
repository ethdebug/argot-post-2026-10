// The walkthroughs against the oracle: the vanilla page at its last
// sync (oracle.sha), captured step by step; frozen since the switch.
// Every step, every field, equal.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { captureAll } from "../oracle/capture.mjs";

const oracle = JSON.parse(fs.readFileSync("test/oracle/vanilla.json",
  "utf8"));
type Step = Record<string, unknown>;

// No normalisation: every field of every step equal, as captured (the
// decided differences of earlier syncs are vanilla's too now).
const port1 = (_w: string, _f: string, v: unknown) => JSON.stringify(v);
const vanilla1 = port1;
const same = (_f: string, a: string, b: string) => a === b;

test("every walkthrough step equals the oracle's", async ({ page,
  browserName }) => {
  test.skip(browserName !== "chromium", "one browser: the oracle's");
  test.setTimeout(240_000);
  await page.goto("./");
  const port = await captureAll(page) as Record<string, Step[] | null>;
  const diffs: string[] = [];
  for (const [w, want] of Object.entries(oracle.walks as Record<string,
    Step[] | null>)) {
    const got = port[w];
    if (!want || !got) {
      if (!want !== !got) diffs.push(`${w}: ${!want ? "no" : ""} walk`);
      continue;
    }
    if (got.length !== want.length) {
      diffs.push(`${w}: ${got.length} steps, vanilla ${want.length}`);
    }
    want.forEach((v, k) => {
      for (const f of Object.keys(v)) {
        const a = vanilla1(w, f, v[f]);
        const b = port1(w, f, got[k]?.[f]);
        if (!same(f, a, b)) {
          diffs.push(`${w} | ${k} | ${f}\n  V ${a}\n  P ${b}`);
        }
      }
    });
  }
  fs.writeFileSync(test.info().outputPath("diffs.txt"), diffs.join("\n"));
  expect(diffs).toEqual([]);
});
