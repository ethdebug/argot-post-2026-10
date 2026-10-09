// The walkthrough's coverage of the pointer schema: every pointer
// example in ethdebug/format's schemas, and every pointer in our builds
// (solc's storage, the hand-written Vyper rule, bugc's storage and
// locals at -O0 and -O2, at the memory section's pauses), is walked (deref/walk.ts,
// its regions the library's) and folded into steps: without an error,
// each step lighting a region or naming a value, the steps' regions
// together the resolved regions. The table of forms by location is
// test/golden/pointer-coverage.md (UPDATE_GOLDEN=1 writes it; any
// difference fails).
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pointerExamples } from "../../../test/pointer-examples";
import { zeroMachine } from "../../../test/zero-machine";
import { testProject } from "../../../test/project";
import { arcade, runOf } from "../../../test/run";
import { walk as walkGraph } from "../deref/walk";
import { regionsOf, sameAsLibrary } from "../deref/check";
import { dereference, type Pointer } from "../lib";
import { decode, decodeLocals } from "../decode";
import { annotate } from "../run/annotate";
import { compilationOf } from "../run/build";
import { momentPoint } from "../moment";
import { machineState } from "../snapshot";
import { walkthrough, type Walkthrough, type WalkInput } from "./fold";
import type {
  Compilation, Decoded, DerefGraph, ResolvedRegion, Snapshot, ValueNode,
} from "../types";

type Any = any;
const FILE = path.resolve(__dirname, "../../../test/golden/" +
  "pointer-coverage.md");
const LOCATIONS = ["storage", "memory", "stack", "calldata", "returndata",
  "transient", "code"];

// the forms a pointer uses: its constructs and its expressions'
// operators (and those of the templates it references)
function formsOf(p: unknown, templates: Record<string, Any> = {}):
  string[] {
  const done = new Set<string>();
  const out = new Set<string>();
  const expr = (e: Any) => {
    if (typeof e === "number" || (typeof e === "string" && /^0x/i.test(e))) {
      out.add("literal");
    } else if (e === "~wordsize") out.add("~wordsize");
    else if (typeof e === "string") out.add("variable");
    else if (Array.isArray(e)) e.forEach(expr);
    else if (e && typeof e === "object") {
      for (const [op, a] of Object.entries(e)) {
        out.add(/^~sized\d+$/.test(op) ? "~sizedN" : op);
        if (a === "~this") out.add("~this");
        if (op !== "~read" && !op.startsWith(".")) expr(a);
      }
    }
  };
  const go = (q: Any) => {
    if (!q || typeof q !== "object") return;
    if ("location" in q) {
      out.add("region");
      for (const k of ["slot", "offset", "length"]) if (k in q) expr(q[k]);
    } else if ("group" in q) {
      out.add("group");
      q.group.forEach(go);
    } else if ("list" in q) {
      out.add("list");
      expr(q.list.count);
      go(q.list.is);
    } else if ("if" in q) {
      out.add("conditional");
      expr(q.if);
      go(q.then);
      go(q.else);
    } else if ("define" in q) {
      out.add("scope (define/in)");
      Object.values(q.define).forEach(expr);
      go(q.in);
    } else if ("templates" in q) {
      out.add("templates");
      Object.values(q.templates as Any).forEach((t: Any) => go(t.for));
      go(q.in);
    } else if ("template" in q) {
      out.add(q.yields ? "reference (yields)" : "reference");
      if (!done.has(q.template) && templates[q.template]) {
        done.add(q.template);
        go(templates[q.template].for);
      }
    }
  };
  go(p);
  return [...out];
}
const locationsOf = (rs: ResolvedRegion[]) =>
  [...new Set(rs.map((r) => r.location))];

// a state of zeros, as a point's snapshot (what the steps read)
const ZEROS: Snapshot = { storage: new Map(), memory: new Uint8Array(1024),
  stack: Array.from({ length: 16 }, () => "0x00" as const),
  calldata: new Uint8Array(1024), transient: new Map() };
const BARE: Compilation = { id: "example", language: "bug",
  compiler: "none", provenance: "hand-written", sources: [], types: {},
  templates: {}, stateVariables: [] };

// the checks every walkthrough passes
function check(w: Walkthrough | null, want: ResolvedRegion[]) {
  expect(w).not.toBeNull();
  const steps = w!.steps;
  expect(steps.length).toBeGreaterThan(0);
  const words = (f: Any): string => JSON.stringify(f);
  for (const st of steps) {
    if (st.phase === "found") continue;
    const lights = st.parts.some((p) => p.regions.length ||
      p.slots?.length || p.wholes?.length) || st.gutters.length > 0;
    const names = words(st.form).length > 30 || st.cap.length > 0;
    expect(lights || names, `${st.id}: lights or names`).toBe(true);
  }
  if (steps.filter((s) => !s.goal).length > 1) {
    expect(steps.at(-1)!.phase).toMatch(/^(found|external)$/);
  }
  // (found: every resolved region, lit by some step)
  const key = (r: ResolvedRegion) => `${r.location}|${r.slot ?? ""}|${
    r.offset}|${r.length}`;
  const lit = new Set(steps.flatMap((s) => s.parts.flatMap((p) =>
    p.regions.map(key))));
  for (const r of want) expect(lit.has(key(r)), key(r)).toBe(true);
}

// a pointer alone, as a value that owns every region it resolves
function exampleInput(g: DerefGraph): WalkInput {
  const regions = regionsOf(g);
  const node: ValueNode = { path: "example", label: "example",
    root: "example", type: "", typeText: "", regions,
    value: { text: "0", hex: "0x00" } };
  const d: Decoded = { decoding: "example", point: "zero", tree: [node],
    byPath: new Map([["example", node]]), graphs: new Map([["example", g]]),
    layouts: {} };
  return { d, c: BARE, snap: ZEROS, keys: { from: "trace" } };
}

// the table: a form by location, walked (how many) or skipped (why)
const table = new Map<string, Map<string, string[]>>();
const skips: string[] = [];
const note = (forms: string[], locs: string[], who: string) => {
  for (const f of forms) {
    if (!table.has(f)) table.set(f, new Map());
    for (const l of locs.length ? locs : ["-"]) {
      const m = table.get(f)!;
      m.set(l, [...m.get(l) ?? [], who]);
    }
  }
};

describe("every pointer example in the format's schemas", () => {
  for (const ex of pointerExamples()) {
    if (!ex.pointer) {
      it.skip(`${ex.where}: ${ex.skip}`, () => {});
      skips.push(`- ${ex.where} (${ex.form}): ${ex.skip}`);
      continue;
    }
    it(`${ex.where} (${ex.form}, ${ex.location}) walks`, async () => {
      const pointer = ex.pointer as Pointer;
      const g = await walkGraph(pointer, { state: zeroMachine,
        templates: {}, inputs: [], root: "example" });
      const view = await (await dereference(pointer, { state: zeroMachine,
        templates: {} })).view(zeroMachine);
      sameAsLibrary(g, [...view.regions]);
      const w = walkthrough(exampleInput(g), "example");
      check(w, regionsOf(g));
      note(formsOf(pointer), locationsOf(regionsOf(g)), "schema");
    });
  }
});

// every walkthrough of a decoding's values at a point
async function walkAll(x: WalkInput, who: string) {
  let n = 0;
  for (const [sel, v] of x.d.byPath) {
    const g = x.d.graphs.get(sel.split(/[.[]/)[0]);
    if (!g) continue;
    const w = walkthrough(x, sel);
    if (!w) continue;
    const own: ResolvedRegion[] = [];
    const visit = (q: ValueNode) => {
      own.push(...q.regions);
      q.children?.forEach(visit);
    };
    visit(v);
    check(w, own);
    if (sel === g.root) {
      note(formsOf(g.pointer, x.c.templates as Any),
        locationsOf(regionsOf(g)), who);
    }
    n++;
  }
  return n;
}

describe("every pointer in our builds", async () => {
  const p = await testProject();
  for (const [scene, who] of [["mid", "solc"], ["vyper", "solc"],
    ["vyper/rule", "vyper rule"]] as const) {
    it(`${who}: ${scene}'s values walk`, async () => {
      const dc = p.decodings[scene];
      const t = await p.timeline(dc.timeline);
      const c = await p.compilation(dc.compilation);
      const pt = t.points.at(-1)!;
      const d = await decode(p, dc, pt.id);
      expect(await walkAll({ d, c, snap: pt.snapshot, keys: dc.keys },
        who)).toBeGreaterThan(0);
    });
  }
  for (const o of ["O0", "O2"]) {
    it(`bugc -${o}: the memory section's scope walks`, async () => {
      const dc = p.decodings[`bug-${o}/scope`];
      const t = await p.timeline(dc.timeline);
      const c = await p.compilation(dc.compilation);
      let n = 0;
      for (const pt of t.points) {
        const d = await decode(p, dc, pt.id);
        n += await walkAll({ d, c, snap: pt.snapshot, keys: dc.keys },
          `bugc ${o} scope`);
      }
      expect(n).toBeGreaterThan(0);
    });
    // (bugc's state variables: the page decodes none of them, their
    // types inline; each pointer alone, against the state at the end)
    it(`bugc -${o}: its state variables' pointers walk`, async () => {
      const build = arcade().builds[`bug-${o}`];
      const run = await runOf(`bug-${o}`);
      const end = { tx: run.txs.length - 1, step: "end" as const };
      const state = machineState(run.stateAt(end));
      const vars = ((build.programs?.runtime.context as Any)?.variables ??
        []) as { identifier: string; pointer?: Pointer }[];
      let n = 0;
      for (const v of vars.filter((y) => y.pointer)) {
        const g = await walkGraph(v.pointer!, { state, templates: {},
          inputs: [], root: "example" });
        const view = await (await dereference(v.pointer!, { state,
          templates: {} })).view(state);
        sameAsLibrary(g, [...view.regions]);
        const x = exampleInput(g);
        check(walkthrough({ ...x, snap: run.stateAt(end) }, "example"),
          regionsOf(g));
        note(formsOf(v.pointer), locationsOf(regionsOf(g)),
          `bugc ${o} state`);
        n++;
      }
      expect(n).toBeGreaterThan(0);
    });
    // (each pointer bugc gives a local in the run, of each shape (its
    // numbers aside), at the first trace step that gives it: on the
    // stack, in memory)
    it(`bugc -${o}: every local pointer of a run walks`, async () => {
      const s = arcade();
      const build = s.builds[`bug-${o}`];
      const c = compilationOf(build);
      const run = await runOf(`bug-${o}`);
      const seen = new Set<string>();
      const shape = (v: { identifier: string; pointer?: unknown }) =>
        `${v.identifier} ${JSON.stringify(v.pointer).replace(/\d+/g, "N")}`;
      let n = 0;
      for (let tx = 0; tx < run.txs.length; tx++)
      for (let k = 0; k < run.txs[tx].steps; k++) {
        const m = annotate(run, build, { tx, step: k });
        if (!m.context) continue;
        const point = momentPoint(`${o}:${tx}:${k}`, m, run.stateAt(m),
          { build });
        const fresh = (point.locals ?? []).filter((v) => v.pointer &&
          !seen.has(shape(v)));
        if (!fresh.length) continue;
        fresh.forEach((v) => seen.add(shape(v)));
        const d = await decodeLocals(c, point);
        for (const v of fresh) {
          const node = d.byPath.get(v.identifier);
          if (!node || node.note || node.none) continue;
          const w = walkthrough({ d, c, snap: point.snapshot,
            keys: { from: "trace" } }, v.identifier);
          check(w, [...node.regions, ...node.reads ?? []]);
          const g = d.graphs.get(v.identifier)!;
          note(formsOf(g.pointer), locationsOf(regionsOf(g)),
            `bugc ${o} scope`);
          n++;
        }
      }
      expect(n).toBeGreaterThan(0);
    }, 120_000);
  }
});

describe("the coverage table", () => {
  it("is as recorded", () => {
    const cols = [...LOCATIONS, "-"].filter((l) => [...table.values()]
      .some((m) => m.has(l)));
    const cell = (xs?: string[]) => {
      if (!xs) return "";
      const by = new Map<string, number>();
      xs.forEach((x) => by.set(x, (by.get(x) ?? 0) + 1));
      return `walks: ${[...by].map(([k, v]) => `${k} ${v}`).join(", ")}`;
    };
    const rows = [...table.keys()].sort().map((f) => `| ${f} | ${cols.map(
      (l) => cell(table.get(f)!.get(l))).join(" | ")} |`);
    const md = ["# Pointer forms the walkthrough walks, by location", "",
      "Made by src/engine/walkthrough/coverage.test.ts (UPDATE_GOLDEN=1).",
      "Each cell counts the pointers that walk and fold into steps: the",
      "format's schema examples (`schema`) and our builds' pointers. A",
      "blank cell: no pointer of that form in that location. A form counts",
      "in each location its pointer's regions are in.", "",
      `| form | ${cols.join(" | ")} |`, `|---|${cols.map(() => "---")
        .join("|")}|`, ...rows, "", "## Skipped", "", ...skips.sort(),
      ""].join("\n");
    if (process.env.UPDATE_GOLDEN) fs.writeFileSync(FILE, md);
    expect(md).toEqual(fs.readFileSync(FILE, "utf8"));
  });
});
