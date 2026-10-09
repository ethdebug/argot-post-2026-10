// A developers' harness for the code panel and the variables in scope
// (timeline plan T6.2), until the debugger lens steps (T6.3): bug-O0's
// run, made in the page (dev server only: it reads the scenario and the
// build from the app's files); alice's third hit (transaction 12, the
// memory section's); a moment by its trace step, a plain number (#step=
// in the URL); the code panel, the Variables tree and the memory, stack
// and calldata dumps, linked as the storage section's are.
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project } from "../engine/project";
import type { Compilation, TimelinePoint } from "../engine/types";
import type { Build, Run } from "../engine/run/types";
import { Lens } from "../ui/Lens";
import { panel } from "../ui/Panel";
import type { LensContextValue } from "../ui/hooks";
import type { LensSpec } from "../ui/types";

const BUILD = "bug-O0";
const TX = 12;
const ID = "stepper-dev";
// (memory.json's "mult" pause, after `mult = combo`)
const FIRST = 793;
const at = { decoding: ID, moment: "current" } as const;

const lensOf = (c: Compilation): LensSpec => ({
  id: ID, title: "Code and variables (bug-O0, dev harness)",
  timelines: [ID], links: ["step"],
  decodings: [{ id: ID, compilation: c.id, timeline: ID,
    variables: "locals", keys: { from: "trace" } }],
  grid: '"code vars" "memory memory" "stack calldata"', layout: "stepper",
  views: [
    { id: "code", kind: "code", area: "code", data: at, domId: "scode" },
    { id: "vars", kind: "variables", area: "vars", data: at, link: "step",
      domId: "svars" },
    ...(["memory", "stack", "calldata"] as const).map((l) => ({
      id: l, kind: "dump" as const, area: l, location: l, data: at,
      link: "step", title: l[0].toUpperCase() + l.slice(1),
      filter: { rows: "all" as const } })),
  ],
  wrap: Object.fromEntries((["memory", "stack", "calldata"] as const)
    .map((l) => [l, panel(`s${l}`, "step", l)])),
  areas: { memory: "dump", stack: "dump", calldata: "dump",
    vars: "treebox" },
});

const stepOf = () => Number(new URLSearchParams(location.hash.slice(1))
  .get("step") ?? FIRST);

// (the run's code: loaded on the dev server only, never in a build)
const engine = () => Promise.all([import("../engine/run/scenario"),
  import("../engine/run/client"), import("../engine/run/annotate"),
  import("../engine/run/build"), import("../engine/moment")])
  .then(([s, c, a, b, m]) => ({ ...s, ...c, ...a, ...b, ...m }));
type Engine = Awaited<ReturnType<typeof engine>>;
type Got = { run: Run; build: Build; c: Compilation; e: Engine }
  | { error: string };

// the run, made once in the page
function useRun(): Got | undefined {
  const [got, setGot] = useState<Got>();
  useEffect(() => {
    if (!import.meta.env.DEV) {
      setGot({ error: "this harness runs on the dev server only" });
      return;
    }
    let live = true;
    const file = (p: string) => fetch(`${import.meta.env.BASE_URL}` +
      `scenarios/arcade/${p}`).then((r) => r.ok ? r.json()
      : Promise.reject(new Error(`${p}: ${r.status}`)));
    (async () => {
      const [scenario, build] = await Promise.all([file("scenario.json"),
        file(`builds/${BUILD}/build.json`)]);
      const e = await engine();
      const s = e.scenarioOf({ ...scenario, builds: { [BUILD]: build } });
      const run = await e.runner(null)(s, BUILD);
      if (live) {
        setGot({ run, build: s.builds[BUILD],
          c: e.compilationOf(s.builds[BUILD]), e });
      }
    })().catch((e) => live && setGot({ error: String(e) }));
    return () => {
      live = false;
    };
  }, []);
  return got;
}

export function StepperHarness({ project: base }: { spec: LensSpec;
  project: Project }) {
  const got = useRun();
  const [step, setStep] = useState(stepOf);
  const [lens, setLens] = useState<LensContextValue>();
  const onReady = useCallback((l: LensContextValue) => setLens(l), []);
  // the project, with this run's moments as points, made as asked
  const made = useMemo(() => {
    if (!got || "error" in got) return undefined;
    const { run, build, c, e } = got;
    const points = new Map<string, TimelinePoint>();
    const steps = run.txs[TX].steps;
    // (the run's trace steps as one scene's moments)
    const project: Project = { ...base, memo: new Map(),
      bookmarks: [...base.bookmarks, { id: ID, title: ID, timeline: ID,
        decoding: ID, points: Array.from({ length: steps }, (_, i) =>
          `${TX}:${i}`) as [string] }],
      timeline: async (id) => id !== ID ? base.timeline(id)
        : { id, contract: { address: run.address, compilation: c.id },
          points: [...points.values()], bookmarks: [] },
      compilation: async (id) => id === c.id ? c : base.compilation(id) };
    const pointAt = (i: number) => {
      const id = `${TX}:${i}`;
      if (!points.has(id)) {
        const m = e.annotate(run, build, { tx: TX, step: i });
        points.set(id, e.momentPoint(id, m, run.stateAt(m), { build,
          steps: run.txs[TX].steps, last: e.lastRange(run, build, m) }));
      }
      return points.get(id)!;
    };
    return { project, pointAt, spec: lensOf(c), steps: run.txs[TX].steps,
      label: run.txs[TX].label };
  }, [got, base]);
  const n = made ? Math.max(0, Math.min(made.steps - 1, step)) : step;
  const point = made?.pointAt(n);
  useEffect(() => {
    if (!lens || !point) return;
    lens.store.set((s) => ({ ...s, scene: ID, moment: n }));
    const q = new URLSearchParams(location.hash.slice(1));
    q.set("lens", ID);
    q.set("step", String(n));
    history.replaceState(null, "", `#${q}`);
  }, [lens, point, n]);
  if (!got) return <p className="muted">Running {BUILD}…</p>;
  if ("error" in got) return <p className="muted">{got.error}</p>;
  return <>
    <p className="stepperbar"><label>trace step <input type="number"
      data-stepper-step min={0} max={made!.steps - 1} value={n}
      onChange={(e) => setStep(Number(e.currentTarget.value))} /></label>
      <span>of {made!.steps} in transaction {TX},{" "}
        <code>{made!.label}</code></span>
      <span className="op">{point?.paused?.op}</span></p>
    <Lens spec={made!.spec} project={made!.project} onReady={onReady} />
  </>;
}

export const stepperDev: LensSpec = {
  id: ID, title: "Code and variables (bug-O0, dev harness)", dev: true,
  timelines: [], decodings: [], grid: "", views: [], links: [],
  page: StepperHarness,
};
