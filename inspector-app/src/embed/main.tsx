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
import "./embed.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { SceneHost } from "../ui/SceneHost";
import { columnsOf } from "../ui/columns";
import { lenses } from "../lenses";
import { rawLens } from "../lenses/raw";
import { builds, scenes } from "../scenes";
import { PanelPort, channelName, figurePort } from "../ui/panel-port";
import { setRevealed } from "../ui/reveal";

const hash = new URLSearchParams(location.hash.slice(1));
followTheme(hash);
// (an annotated figure's reveal, from the host's scroll: { type:
// "ethdebug:reveal", on }; ui/reveal.ts)
addEventListener("message", (e) => {
  if (e.data?.type === "ethdebug:reveal") setRevealed(!!e.data.on);
});
const ALIAS: Record<string, string> = { raw: "raw-hero" };
const id = ALIAS[hash.get("scene") ?? ""] ?? hash.get("scene") ?? "";
// (every lens a scene may name; the raw lens with or without its moment)
const all = lenses.map((l) => l.id === "raw-hero" && hash.get("moment")
  === "0" ? rawLens({ moment: false }) : l);
const root = document.getElementById("embed")!;

// The content's height, to the host: { type: "ethdebug:height", height,
// columns, width, reveal? }. (`reveal`: the figure has an annotated
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
  return { height: Math.ceil(root.getBoundingClientRect().height), width };
};
const post = () => {
  if (!ready) return;
  const m = measure();
  const key = `${m.height}|${m.width}`;
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
async function whenDrawn() {
  while (!root.querySelector(".view .wrow, .embed-none, .error")) {
    await frame();
  }
  await document.fonts?.ready;
  for (let k = 0; k < 4; k++) await frame();
  ready = true;
  post();
}

const project = await load(fetchIo(import.meta.env.BASE_URL),
  { scenes, builds });
const scene = project.scenes.find((s) => s.id === id);
// (a scene of groups, the memory section's: its first, SceneHost)
const only = all;
const lens = scene && only.find((l) => l.id === scene.lens);
if (lens) columns = columnsOf(lens);
reveals = !!lens?.views.some((v) => v.kind === "dump" &&
  v.display?.annotate);
void whenDrawn();
const port = hash.get("panel") === "external"
  ? figurePort(channelName(id, hash.get("channel") ?? "")) : null;
createRoot(root).render(scene
  ? <PanelPort.Provider value={port}><SceneHost scene={scene}
    project={project} lenses={only} mode="reader" /></PanelPort.Provider>
  : <p className="embed-none" role="alert">No scene “{id}” to embed
    {" "}(scenes: {project.scenes.map((s) => s.id).join(", ")}).</p>);
