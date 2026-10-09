// The embed entry (spec §7, an early slice of T7.1): one scene's lens,
// alone, the scene by the hash (embed.html#scene=raw; moment=0 leaves
// the raw lens's moment line out). It posts its content height to the
// host page: { type: "ethdebug:height", height }.
import "../../../shared/appendix.css";
import "../style.css";
import "../ui/port.css";
import "../lenses/raw.css";
import "./embed.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { Lens } from "../ui/Lens";
import { rawLens } from "../lenses/raw";
import { builds, scenes } from "../scenes";
import type { LensSpec } from "../ui/types";

const hash = new URLSearchParams(location.hash.slice(1));
const id = hash.get("scene") ?? "raw";
// (the lenses a scene may name; the storage inspector's scenes come
// with the full embed, later)
const raw = () => rawLens({ moment: hash.get("moment") !== "0" });
const byLens: Record<string, () => LensSpec> = { raw, "raw-hero": raw };
const root = document.getElementById("embed")!;

// the content's height, to the host, whenever it changes
let last = -1;
new ResizeObserver(() => {
  const height = Math.ceil(root.getBoundingClientRect().height);
  if (height === last) return;
  last = height;
  parent.postMessage({ type: "ethdebug:height", height }, "*");
}).observe(root);

const project = await load(fetchIo(import.meta.env.BASE_URL),
  { scenes, builds });
// (the page's scenes, as its picker names them, or the scenes' own)
const scene = [...project.page, ...project.scenes].find((s) =>
  s.id === id);
const spec = scene?.lens ? byLens[scene.lens]?.() : undefined;
createRoot(root).render(spec ? <Lens spec={spec} project={project} />
  : <p className="embed-none">No scene “{id}” to embed.</p>);
