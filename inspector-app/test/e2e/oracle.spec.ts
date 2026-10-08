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
// (1) the Vyper scene, read by solc's rule, has no names on chain (its
//     records' names decode to ""): the port names each by its short
//     address (decided 10-07: an empty name is no name), where vanilla
//     shows "". Vanilla's "" read as the records' addresses, in their
//     order (the rows of a table, alice, bob, carol; an entry's own)
const SHORT = ["0x7099…79c8", "0x3c44…93bc", "0x90f7…b906"];
const port1 = (w: string, f: string, v: unknown) => JSON.stringify(v);
const vanilla1 = (w: string, f: string, v: unknown) => {
  let t = JSON.stringify(v);
  // (not a name's own value, "", shown as itself)
  if (!w.startsWith("vyper") || v === '""') return t;
  const q = JSON.stringify('""').slice(1, -1);
  // ("0x7099…79c8 "": the address and its gloss: the address)
  for (const a of SHORT) t = t.split(`${a} ${q}`).join(a);
  const own = SHORT.find((a) => w.includes(`[${a.slice(0, 6)}`)) ??
    SHORT.find((a, k) => w.includes(["0x7099", "0x3c44", "0x90f7"][k]));
  let k = 0;
  return t.split(q).reduce((x, y) => x + (own ?? SHORT[k++ % 3]) + y);
};
// (2) a label's names are cut to fit its box, which scales with the
//     dump: where either is cut ("…"), the how and the facts only
const same = (f: string, a: string, b: string) => {
  if (a === b) return true;
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
