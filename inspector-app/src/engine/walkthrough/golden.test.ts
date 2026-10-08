// Goldens (spec §7): walkthrough() for every bookmark × variable (and
// alice's entry, roster[1], carol's name) × side, as JSON; a change must
// diff to nothing, or the goldens are written again on purpose
// (bin/goldens.mjs) and the diff reviewed
import { it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { testProject } from "../../../test/project";
import { A, C } from "../../../test/expect";
import { decode } from "../decode";
import { walkthrough } from "./fold";

const DIR = path.join("test", "golden");
const WRITE = process.env.UPDATE_GOLDENS === "1";
const json = (x: unknown) => JSON.stringify(x, (_, v) =>
  typeof v === "bigint" ? `${v}n` : v instanceof Map ? [...v] : v, 2) + "\n";
const file = (bm: string, side: string, p: string) => path.join(DIR,
  `${bm}-${side}-${p.replace(/[^A-Za-z0-9.]+/g, "_")}.json`);

const cases = async () => {
  const p = await testProject();
  const out: [string, string, string, () => Promise<unknown>][] = [];
  for (const b of p.bookmarks) {
    const dc = p.decodings[b.decoding];
    const c = await p.compilation(dc.compilation);
    const t = await p.timeline(b.timeline);
    for (const point of b.points) {
      const side = point.split(":")[1];
      const paths = [...c.stateVariables.map((v) => v.identifier), A,
        "roster[1]", `${C}.name`];
      for (const q of paths) {
        out.push([b.id, side, q, async () => {
          const d = await decode(p, dc, point);
          if (!d.byPath.has(q)) return null;
          return walkthrough({ d, c, snap: t.points.find((x) =>
            x.id === point)!.snapshot, keys: dc.keys }, q);
        }]);
      }
    }
  }
  return out;
};

it("every walkthrough equals its golden", async () => {
  const all = await cases();
  expect(all.length).toBeGreaterThan(20);
  const diffs: string[] = [];
  for (const [bm, side, q, run] of all) {
    const got = json(await run());
    const f = file(bm, side, q);
    if (WRITE) {
      fs.mkdirSync(DIR, { recursive: true });
      fs.writeFileSync(f, got);
    } else if (!fs.existsSync(f) || fs.readFileSync(f, "utf8") !== got) {
      diffs.push(f);
    }
  }
  expect(diffs).toEqual([]);
});
