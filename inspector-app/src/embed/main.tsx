// The embed entry (spec §7): one scene from the scene registry, by the
// hash (embed.html#scene=<id>, ids as in scenes/*.json; the page's
// "raw" is raw-hero), drawn by its lens alone: no page chrome. The
// raw lens's moment line: moment=0 leaves it out. It posts its content
// height to the host page (below: ethdebug:height), and takes the host's
// theme (theme=, ethdebug:theme).
// panel=external (with channel=<id>): the walkthrough's panel is not
// drawn here but in a frame of its own (embed-panel.html, the same
// scene and channel), sticky on the host's page; this frame sends it
// the panel's model and acts on its intents (ui/panel-port.ts), and asks
// the host to bring a step's lit rows into view: { type:
// "ethdebug:scroll-to", y, bottom } (their top and bottom in this frame).
import { followTheme } from "./theme";
import "../../../shared/appendix.css";
import "../style.css";
import "../ui/port.css";
import "../lenses/raw.css";
import "../ui/code.css";
import "../lenses/debugger.css";
import "./embed.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { SceneHost } from "../ui/SceneHost";
import { columnsOf } from "../ui/columns";
import { lenses } from "../lenses";
import { rawLens } from "../lenses/raw";
import { builds, page, scenes } from "../scenes";
import { PanelPort, channelName, figurePort } from "../ui/panel-port";
import { setProgress, setRevealed } from "../ui/reveal";

const hash = new URLSearchParams(location.hash.slice(1));
followTheme(hash);
// (an annotated figure's reveal, from the host's scroll: { type:
// "ethdebug:reveal", on, progress }: the progress, 0 to 1, each frame;
// an older host's `on` alone, run there; ui/reveal.ts)
addEventListener("message", (e) => {
  if (e.data?.type !== "ethdebug:reveal") return;
  if (typeof e.data.progress === "number") setProgress(e.data.progress);
  else setRevealed(!!e.data.on);
});
// (and the memory section's old scenes, the post's figure until it
// names the stepper's: the stepper, at the same level)
const ALIAS: Record<string, string> = { raw: "raw-hero",
  "bug-O0": "stepper-O0", "bug-O2": "stepper-O2" };
const id = ALIAS[hash.get("scene") ?? ""] ?? hash.get("scene") ?? "";
// (every lens a scene may name; the raw lens with or without its moment)
const all = lenses.map((l) => l.id === "raw-hero" && hash.get("moment")
  === "0" ? rawLens({ moment: false }) : l);
const root = document.getElementById("embed")!;

// The content's height, to the host: { type: "ethdebug:height", height,
// columns, width, row?, reveal? }. (`row`: the storage dump's row pitch
// in CSS px, for a host that measures in rows; no storage dump, none.) (`reveal`: the figure has an annotated
// layer, raw until the host says { type: "ethdebug:reveal", on: true }
// as the reader scrolls to it, and again whenever this reports ready.) Only once the scene is drawn (its data in, its
// dumps laid out, the fonts in: `ready: true` on that first one), then
// on each real change. `columns`: how many its lens lays out side by
// side (1 or 2: the host's figure width); `width`: what its content
// spans, the composition centred in the frame.
let last = "";
let columns: 1 | 2 = 1;
let reveals = false;
let ready = false;
const measure = () => {
  const lens = root.querySelector<HTMLElement>(".lens");
  const kids = lens ? [...lens.children] as HTMLElement[] : [];
  const boxes = kids.map((k) => k.getBoundingClientRect())
    .filter((r) => r.width && r.height);
  // (and the root's side padding: the room for what reaches out of a
  // column, embed.css)
  const pad = parseFloat(getComputedStyle(root).paddingLeft) +
    parseFloat(getComputedStyle(root).paddingRight);
  const width = boxes.length ? Math.ceil(Math.max(...boxes.map((r) =>
    r.right)) - Math.min(...boxes.map((r) => r.left)) + pad) : 0;
  return { height: Math.ceil(root.getBoundingClientRect().height), width,
    ...rowPitch() };
};
// (`row`: the first storage dump's row pitch, one row's top to the
// next's, in CSS px at this width: the nearest two rows' distance, or
// with one row its height and the rows' gap; no storage dump, none)
const rowPitch = (): { row?: number } => {
  const dump = root.querySelector<HTMLElement>(
    '.view[data-location="storage"]:not([hidden])');
  const rows = dump ? [...dump.querySelectorAll<HTMLElement>(
    ".rows .wrow[data-slot]")].map((r) => r.getBoundingClientRect()) : [];
  if (!rows.length) return {};
  const steps = rows.slice(1).map((r, k) => r.top - rows[k].top)
    .filter((d) => d > 0);
  const gap = parseFloat(getComputedStyle(dump!.querySelector(".rows")!)
    .rowGap) || 0;
  const row = steps.length ? Math.min(...steps) : rows[0].height + gap;
  return { row: Math.round(row * 100) / 100 };
};
const post = () => {
  if (!ready) return;
  const m = measure();
  const key = `${m.height}|${m.width}|${m.row}`;
  if (key === last) return;
  const first = !last;
  last = key;
  parent.postMessage({ type: "ethdebug:height", ...m, columns,
    ...first ? { ready: true } : {}, ...reveals ? { reveal: true } : {} },
  "*");
};
new ResizeObserver(post).observe(root);
// (drawn: a dump's rows, or the scene's error; then the fonts, and the
// frames the views take to fit and line up)
// (timers, not animation frames: a frame out of view, as a host's
// figures below the fold, gets no animation frames in some browsers)
const frame = () => new Promise((r) => setTimeout(r, 20));
// Drawn: every view of the lens has its rows (each dump its lines, each
// tree its values; a hidden one aside), the fonts are in, and the
// height has held still for STILL checks in a row (the fit pass and the
// trees' alignment run on timers, and change it). An error, or no
// scene, is drawn as it is. (After WAIT_ROWS ms, a view with no rows at
// all is taken as empty, and only the height must hold.)
const STILL = 6, WAIT_ROWS = 8000;
const filled = () => {
  const lens = root.querySelector(".lens");
  if (!lens) return false;
  return [...lens.querySelectorAll<HTMLElement>("[data-view]")]
    .filter((v) => !v.closest("[hidden]"))
    .every((v) => v.matches(".tree") ? !!v.querySelector("li[data-path]")
      : !v.querySelector(".rows") || !!v.querySelector(".rows .wrow"));
};
async function whenDrawn() {
  const t0 = performance.now();
  while (!root.querySelector(".embed-none, .error") &&
    !(filled() || performance.now() - t0 > WAIT_ROWS)) {
    await frame();
  }
  await document.fonts?.ready;
  let h = -1, still = 0;
  while (still < STILL) {
    await frame();
    const now = Math.ceil(root.getBoundingClientRect().height);
    still = now === h && (filled() || performance.now() - t0 > WAIT_ROWS)
      ? still + 1 : 0;
    h = now;
  }
  ready = true;
  post();
}

const project = await load(fetchIo(import.meta.env.BASE_URL),
  { scenes, builds, page });
const scene = project.scenes.find((s) => s.id === id);
const lens = scene && all.find((l) => l.id === scene.lens);
if (lens) columns = columnsOf(lens);
reveals = !!lens?.views.some((v) => v.kind === "dump" &&
  v.display?.annotate);
void whenDrawn();
const port = hash.get("panel") === "external"
  ? figurePort(channelName(id, hash.get("channel") ?? "")) : null;
createRoot(root).render(scene
  ? <PanelPort.Provider value={port}><SceneHost scene={scene}
    project={project} lenses={all} mode="reader" /></PanelPort.Provider>
  : <p className="embed-none" role="alert">No scene “{id}” to embed
    {" "}(scenes: {project.scenes.map((s) => s.id).join(", ")}).</p>);
