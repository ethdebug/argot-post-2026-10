// The storage walkthroughs, exactly as they are: every scene's every
// value with a walkthrough (and each focus a mapping offers), every step
// whole (its identity, caption, form, construct, source, band, parts,
// rows, gutters, notes) and what it lights in the dump (bytes and their
// colours, rows, gutters, the rows found so far). The record is
// test/golden/walkthroughs.json, made by `npm run golden` from the
// engine as it is; this test fails on any difference. A change to the
// curated storage steps is a decision: capture again, and review the
// diff.
import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { testProject } from "../../../test/project";
import { decode } from "../decode";
import { layout } from "../layout";
import { forStep } from "../light";
import { walkthrough } from "./fold";
import type { WalkInput } from "./fold";

// (the curated storage scenes)
export const SCENES = ["mid", "alice", "motd", "vyper"];
const FILE = path.resolve(__dirname, "../../../test/golden/walkthroughs.json");
const big = (_: string, v: unknown) => typeof v === "bigint" ? String(v)
  : v instanceof Map ? Object.fromEntries([...v].map(([k, x]) =>
    [String(k), x]))
    : v instanceof Set ? [...v].map(String).sort() : v;

async function record() {
  const p = await testProject();
  const out: Record<string, unknown> = {};
  for (const b of p.bookmarks.filter((x) => SCENES.includes(x.id))) {
    const dc = p.decodings[b.decoding];
    if (dc?.variables !== "state") continue;
    const t = await p.timeline(b.timeline);
    const c = await p.compilation(dc.compilation);
    for (const [k, pt] of b.points.entries()) {
      const d = await decode(p, dc, pt);
      const point = t.points.find((x) => x.id === pt)!;
      const cd = dc.foreign ? await decode(p, p.decodings[dc.foreign.rule],
        pt) : undefined;
      const x: WalkInput = { d, c, snap: point.snapshot, keys: dc.keys,
        ...(b.points.length > 1 ? { when: point.label } : {}),
        ...(cd ? { contrast: { d: cd, language: dc.foreign!.language } }
          : {}) };
      const l = layout(d, "storage", {}, { point });
      for (const sel of [...d.byPath.keys()].sort()) {
        const w0 = walkthrough(x, sel);
        if (!w0) continue;
        for (const focus of [undefined, ...(w0.recs ?? []).map((r) =>
          r.path)]) {
          const w = focus ? walkthrough(x, sel, focus)! : w0;
          out[`${b.id} ${k ? "after" : "before"} ${sel}${focus
            ? ` focus=${focus}` : ""}`] = JSON.parse(JSON.stringify({
            recs: w.recs, focus: w.focus, name: w.name, span: w.span,
            steps: w.steps.map((s, i) => {
              const lt = forStep(d, l, w.steps, i, w);
              // (runs of lit bytes in a row, with their own colour and
              // whether they echo: "storage|0x…03 0-31 k=1 dim")
              const by = new Map<string, string[]>();
              for (const key of [...lt.bytes]) {
                const [loc, row, i] = key.split("|");
                // (its colour as the dump draws it: its own, else its
                // first owner's with one)
                const k = lt.byteColours?.get(key) ?? (l.cover.get(key) ?? [])
                  .map((o) => lt.colours.get(o.replace(/#[a-z]+$/, "")))
                  .find((c) => c !== undefined);
                const tag = `k=${k ?? ""}${lt.dim?.has(key) ? " dim" : ""}`;
                const list = by.get(`${loc}|${row}`) ?? [];
                list[+i] = tag;
                by.set(`${loc}|${row}`, list);
              }
              const lit = [...by].sort().flatMap(([row, list]) => {
                const runs: string[] = [];
                let a = -1;
                for (let i = 0; i <= list.length; i++) {
                  const same = a >= 0 && i < list.length &&
                    list[i] !== undefined && list[i] === list[a];
                  if (same) continue;
                  if (a >= 0) runs.push(`${row} ${a}-${i - 1} ${list[a]}`);
                  a = i < list.length && list[i] !== undefined ? i : -1;
                }
                return runs;
              });
              // (colours: those of the rows lit, as the tree draws them)
              const only = (m: ReadonlyMap<string, unknown> | undefined,
                keep: Iterable<string>) => m && Object.fromEntries(
                [...keep].filter((r) => m.has(r)).sort().map((r) =>
                  [r, m.get(r)]));
              return { ...s, parts: s.parts.map((q) => ({ ...q,
                colours: only(q.colours, q.rows) })),
              light: { lit, rows: lt.rows, colours: only(lt.colours, lt.rows),
                dimRows: lt.dimRows, gutters: lt.gutters, known: lt.known,
                ruler: lt.ruler, quiet: lt.quiet } };
            }) }, big));
        }
      }
    }
  }
  return out;
}

it("every storage walkthrough, exactly as recorded", async () => {
  const got = await record();
  if (process.env.UPDATE_GOLDEN) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    // (one walkthrough a line: a diff names it)
    fs.writeFileSync(FILE, `{\n${Object.keys(got).sort().map((k) =>
      `${JSON.stringify(k)}: ${JSON.stringify(got[k])}`).join(",\n")}\n}\n`);
  }
  const want = JSON.parse(fs.readFileSync(FILE, "utf8"));
  expect(Object.keys(got).sort()).toEqual(Object.keys(want).sort());
  for (const k of Object.keys(want)) expect(got[k], k).toEqual(want[k]);
}, 120_000);
