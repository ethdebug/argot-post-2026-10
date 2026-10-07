// The parity page: the vanilla page's markup (index.html, from
// bin/copy-vanilla.mjs) with the full-inspector lens in its storage
// section: the dumps go in #dump, the tree in the tree's box. M1: the
// first scene; window.select, window.results and the loader come later.
import "../../../shared/appendix.css";
import "../style.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { fullInspector } from "../lenses/full-inspector";
import { Lens } from "../ui/Lens";

const $ = (id: string) => document.getElementById(id)!;
document.documentElement.classList.add("styled");

const project = await load(fetchIo(import.meta.env.BASE_URL));
const first = project.bookmarks.find((b) =>
  b.id === fullInspector.bookmarks?.[0])!;
// the scene's picker button, intro, and no Before | After at one point
for (const b of $("picker").querySelectorAll<HTMLElement>("button")) {
  b.setAttribute("aria-checked", String(b.dataset.id === first.id));
}
for (const p of $("intros").querySelectorAll<HTMLElement>("[data-scene]")) {
  p.hidden = p.dataset.scene !== first.id;
}
document.querySelector("main")!.toggleAttribute("data-single",
  first.points.length === 1);

// the lens's views take the places of the static #panel and #tree
const tree = $("tree");
const box = tree.parentElement!;
tree.remove();
$("panel").remove();
const host = document.createElement("div");
document.body.append(host);
createRoot(host).render(<Lens spec={fullInspector} project={project}
  mount={{ dump: $("dump"), tree: box }} />);
$("loadbar").hidden = true;
