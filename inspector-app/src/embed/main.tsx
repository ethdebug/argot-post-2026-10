// The embed entry (spec §7): one scene from the scene registry, by the
// hash (embed.html#scene=<id>, ids as in scenes/*.json; the page's
// "raw" is raw-hero), drawn by its lens alone: no page chrome. The
// raw lens's moment line: moment=0 leaves it out. It posts its content
// height to the host page: { type: "ethdebug:height", height }.
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

const hash = new URLSearchParams(location.hash.slice(1));
const ALIAS: Record<string, string> = { raw: "raw-hero" };
const id = ALIAS[hash.get("scene") ?? ""] ?? hash.get("scene") ?? "";
// (every lens a scene may name; the raw lens with or without its moment)
const all = lenses.map((l) => l.id === "raw-hero" && hash.get("moment")
  === "0" ? rawLens({ moment: false }) : l);
const root = document.getElementById("embed")!;

// the content's height, to the host, whenever it changes, with the
// columns its lens lays out side by side (1 or 2: the host's figure
// width; set once the scene is known)
let last = -1;
let columns: 1 | 2 = 1;
const post = () => {
  const height = Math.ceil(root.getBoundingClientRect().height);
  if (height === last) return;
  last = height;
  parent.postMessage({ type: "ethdebug:height", height, columns }, "*");
};
new ResizeObserver(post).observe(root);

const project = await load(fetchIo(import.meta.env.BASE_URL),
  { scenes, builds });
const scene = project.scenes.find((s) => s.id === id);
// (the memory section's lens reads no scenes yet: it opens at the
// scene's build's level, O0 or O2)
const level = scene && project.bookmarks.find((b) =>
  b.decoding === `mem:${scene.run.build.replace(/^bug-/, "")}`);
const only = all.map((l) => scene && level && l.id === scene.lens
  ? { ...l, initial: { ...l.initial, scene: level.id } } : l);
const lens = scene && only.find((l) => l.id === scene.lens);
if (lens) {
  columns = columnsOf(lens);
  last = -1;
  post();
}
createRoot(root).render(scene
  ? <SceneHost scene={scene} project={project} lenses={only}
    mode="reader" />
  : <p className="embed-none" role="alert">No scene “{id}” to embed
    {" "}(scenes: {project.scenes.map((s) => s.id).join(", ")}).</p>);
