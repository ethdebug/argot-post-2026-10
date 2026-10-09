// A scene (addendum §1.5): a timeline of moments in one run, the lens
// that draws it, its caption and its reader controls. Scene files are
// data (scenes/<id>.json); their moments carry no annotations (the run
// or the snapshot fills those).
import type { Hex, Path } from "./types";
import type { BuildId, MomentRef, ScenarioId, Timeline }
  from "./run/types";

export type SceneId = string;
export type LensId = string;
export interface Scene {
  id: SceneId; title: string;
  caption?: string;                // the figcaption (embed) text
  run: { scenario: ScenarioId; build: BuildId };
  lens: LensId;                    // the composition it draws
  timeline: Timeline;              // 1 moment = a static figure
  controls: "none" | "prev-next" | "scrub";   // reader mode (§3)
  initial?: { moment?: number; select?: Path;
              walk?: { step: number; focus?: Hex } };
}

const CONTROLS = ["none", "prev-next", "scrub"];
const ANNOTATIONS = ["pc", "op", "depth", "range", "context"];

// (tx, step) as one number: "end" after every trace step
export const order = (m: MomentRef) =>
  m.tx * 2 ** 24 + (m.step === "end" ? 2 ** 24 - 1 : m.step);

export function sceneOf(json: unknown): Scene {
  const j = json as Partial<Scene> & Record<string, unknown>;
  const no = (what: string): never => {
    throw new Error(`scene ${j.id ?? "?"}: ${what}`);
  };
  for (const k of ["id", "title", "lens"] as const) {
    if (typeof j[k] !== "string") no(`no ${k}`);
  }
  if (typeof j.run?.scenario !== "string" ||
    typeof j.run?.build !== "string") no("no run");
  if (!CONTROLS.includes(j.controls as string)) {
    no(`controls ${j.controls}`);
  }
  if (!Array.isArray(j.timeline) || !j.timeline.length) no("no moment");
  const timeline = j.timeline!.map((m) => {
    if (!Number.isInteger(m.tx) || m.tx < 0) no(`tx ${m.tx}`);
    if (m.step !== "end" && !(Number.isInteger(m.step) && m.step >= 0)) {
      no(`step ${m.step}`);
    }
    const hand = ANNOTATIONS.find((k) => k in m);
    if (hand) no(`${hand} is filled from the run, not written`);
    return { tx: m.tx, step: m.step,
      ...(m.label !== undefined ? { label: m.label } : {}) };
  });
  timeline.forEach((m, k) => {
    if (k && order(timeline[k - 1]) >= order(m)) no("moments out of order");
  });
  const n = j.initial?.moment;
  if (n !== undefined && !(n >= 0 && n < timeline.length)) {
    no(`initial moment ${n}`);
  }
  return { ...(j as Scene), timeline };
}
