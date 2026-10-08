// The walkthroughs against the oracle: vanilla's page at sync-base,
// captured step by step (bin/oracle.mjs -> test/oracle/vanilla.json).
// Every step, every field, equal, but for the decided differences
// (DECIDED, each normalised here, with its reason).
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { captureAll } from "../oracle/capture.mjs";

const oracle = JSON.parse(fs.readFileSync("test/oracle/vanilla.json",
  "utf8"));
type Step = Record<string, unknown>;

// The decided differences, each normalised away:
// (1) names are the on-chain names, quoted (vanilla: the fixture's
//     labels; decided 10-08): the port's quoted names read as the labels
const LABELS: [string, string][] = [['"alice"', "alice"], ['"bob"', "bob"],
  ['"carol, the unstoppable combo queen"', "carol"]];
// (2) the Vyper scene, read by solc's rule, has no on-chain names: the
//     short address stands for one (vanilla: the labels)
const SHORT: [string, string][] = [["alice", "0x7099…79c8"],
  ["bob", "0x3c44…93bc"], ["carol", "0x90f7…b906"]];
// (not a value: a name shown as itself, the text of a name's value)
const port1 = (w: string, f: string, v: unknown) => {
  let t = JSON.stringify(v);
  if (LABELS.some(([q]) => v === q)) return t;
  for (const [q, l] of LABELS) t = t.split(JSON.stringify(q).slice(1, -1))
    .join(l);
  return t;
};
const vanilla1 = (w: string, f: string, v: unknown) => {
  let t = JSON.stringify(v);
  if (w.startsWith("vyper")) {
    // ("0x7099…79c8 alice": the address and its gloss -> the address)
    for (const [l, a] of SHORT) t = t.split(`${a} ${l}`).join(a)
      .split(l).join(a);
  }
  return t;
};
// (3) the fields step shows the word as a byte strip, the fields over
//     their bytes (vanilla: a list with byte ranges; decided): the same
//     fields in the same order
// (4) a label's names are cut to fit its box, which scales with the
//     dump: where either is cut ("…"), the how and the facts only
const same = (f: string, a: string, b: string) => {
  if (a === b) return true;
  if (f === "form") {
    const names = [...JSON.parse(a).matchAll(/(\w+) \d+–\d+/g)]
      .map((m) => m[1]);
    const m = JSON.parse(b).match(/^[0-9a-f]{64}(.*)$/);
    return names.length > 0 && !!m && m[1] === names.join("");
  }
  if (f === "pops") {
    const cut = (x: string) => (JSON.parse(x) as string[]).map((p) =>
      p.includes("…") && p.includes(" : ")
        ? p.replace(/ : .* · /, " : … · ")
        : p);
    return JSON.stringify(cut(a)) === JSON.stringify(cut(b));
  }
  return false;
};

test("every walkthrough step equals vanilla's at sync-base", async ({ page,
  browserName }) => {
  test.skip(browserName !== "chromium", "one browser: the oracle's");
  test.setTimeout(240_000);
  expect(oracle.sha).toBe(fs.readFileSync("sync-base", "utf8").trim());
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
