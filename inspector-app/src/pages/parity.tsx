// The parity page: the vanilla page's markup (index.html, from
// bin/copy-vanilla.mjs) with the full-inspector lens in its storage
// section: its views take the places of the static #picker, #mode,
// #panel and #tree. The page keeps what is its own: the scene's intro
// and summary, main[data-single], and the hooks bin/run.mjs uses
// (window.select, window.results).
import "../../../shared/appendix.css";
import "../style.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { decode } from "../engine/decode";
import type { Decoded } from "../engine/types";
import { fullInspector } from "../lenses/full-inspector";
import { Lens } from "../ui/Lens";
import type { LensContextValue } from "../ui/hooks";

type Results = { done: boolean; usable?: number; errors: string[];
  decoded: Record<string, Record<string, { before?: string;
    after?: string }>> };
declare global {
  interface Window {
    results: Results;
    select(id: string, view?: { mode?: "before" | "after";
      sel?: string | null }): Promise<boolean>;
  }
}

const $ = (id: string) => document.getElementById(id)!;
document.documentElement.classList.add("styled");
// the contract's line count (the source box's summary)
$("contract-box").querySelector(".srclines")!.textContent = String(
  $("contract-src").textContent!.replace(/\n$/, "").split("\n").length);
window.results = { done: false, errors: [], decoded: {} };

// a static element's place, for a view (no box of its own)
const place = (el: Element) => {
  const host = document.createElement("div");
  host.style.display = "contents";
  el.replaceWith(host);
  return host;
};

// each value's text at each side, by path (bin/run.mjs reads them)
function record(id: string, [before, after]: Decoded[]) {
  const text = (d: Decoded, p: string) => {
    const n = d.byPath.get(p)!;
    return n.value?.text ?? (n.children &&
      n.regions.some((r) => r.role === "length") ? n.summary : undefined);
  };
  const flat: Results["decoded"][string] = {};
  for (const p of new Set([...before.byPath.keys(), ...after.byPath.keys()])) {
    flat[p] = { before: before.byPath.has(p) ? text(before, p) : undefined,
      after: after.byPath.has(p) ? text(after, p) : undefined };
  }
  window.results.decoded[id] = flat;
}

try {
  const project = await load(fetchIo(import.meta.env.BASE_URL));
  const mount = { pick: place($("picker")), mode: place($("mode")),
    dump: place($("panel")), tree: place($("tree")) };

  // the scene's intro and summary, and no Before | After at one point
  const scene = (lens: LensContextValue) => {
    const s = lens.store.get();
    const bm = project.bookmarks.find((b) => b.id === s.bookmark);
    if (!bm) return;
    for (const p of $("intros").querySelectorAll<HTMLElement>(
      "[data-scene]")) {
      p.hidden = p.dataset.scene !== bm.id;
    }
    document.querySelector("main")!.toggleAttribute("data-single",
      bm.points.length === 1);
    $("summary").textContent = bm.summary ?? "";
  };

  // (a scene's values are recorded the first time it shows: picked, or
  // selected by window.select)
  const recording = new Map<string, Promise<void>>();
  const recorded = (id: string) => {
    if (!recording.has(id)) {
      const bm = project.bookmarks.find((b) => b.id === id)!;
      const d = project.decodings[bm.decoding];
      recording.set(id, Promise.all(bm.points.map((p) =>
        decode(project, d, p))).then((at) =>
        record(id, [at[0], at[at.length - 1]])));
    }
    return recording.get(id)!;
  };

  const ready = (lens: LensContextValue) => {
    lens.store.subscribe(() => {
      scene(lens);
      const id = lens.store.get().bookmark;
      if (id) void recorded(id);
    });
    window.select = async (id, view) => {
      const ok = await lens.show(id, view);
      if (ok) await recorded(id);
      return ok;
    };
    window.select(fullInspector.bookmarks![0]).then(() => {
      $("loadbar").hidden = true;
      window.results.usable = performance.now();
      window.results.done = true;
    });
  };

  const host = document.createElement("div");
  document.body.append(host);
  createRoot(host).render(<Lens spec={fullInspector} project={project}
    mount={mount} onReady={ready} />);
} catch (e) {
  console.error(e);
  window.results.errors.push(String((e as Error)?.message ?? e));
  window.results.done = true;
}
