// The parity page: the vanilla page's markup (index.html, from
// bin/copy-vanilla.mjs) with the full-inspector lens in its storage
// section: its views take the places of the static #picker, #mode,
// #panel and #tree. The page keeps what is its own: the scene's intro
// and summary, main[data-single], and the hooks bin/run.mjs uses
// (window.select, window.results).
import "../../../shared/appendix.css";
import "../style.css";
import "../ui/port.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { decode } from "../engine/decode";
import type { Decoded } from "../engine/types";
import { fullInspector } from "../lenses/full-inspector";
import { insideOnePlay } from "../lenses/inside-one-play";
import type { ValueNode } from "../engine/types";
import { Lens } from "../ui/Lens";
import type { LensContextValue } from "../ui/hooks";

type Results = { done: boolean; usable?: number; errors: string[];
  decoded: Record<string, Record<string, { before?: string;
    after?: string }>> };
declare global {
  interface Window {
    results: Results;
    // the memory section's: every pause's locals, decoded (run.mjs)
    memResults: { done: boolean; errors: string[];
      decoded: Record<string, Record<string, { values: Record<string,
        string>; none: string[] }[]>> };
    select(id: string, view?: { mode?: "before" | "after";
      sel?: string | null }): Promise<boolean>;
  }
}

const $ = (id: string) => document.getElementById(id)!;
document.documentElement.classList.add("styled");
// (bin/run.mjs: fit the dumps' fonts again, after a layout change; each
// dump fits on resize)
(window as unknown as { fitDumps(): void }).fitDumps = () =>
  dispatchEvent(new Event("resize"));
// the contract's line count (the source box's summary)
$("contract-box").querySelector(".srclines")!.textContent = String(
  $("contract-src").textContent!.replace(/\n$/, "").split("\n").length);
window.results = { done: false, errors: [], decoded: {} };
window.memResults = { done: false, errors: [], decoded: {} };

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
    dump: place($("panel")), tree: place($("tree")),
    bar: place($("details")), cd: place($("calldata")) };
  // (the walkthrough panel draws the details under its bar)
  $("dwrap").remove();
  // (the tree view draws its own edge buttons)
  $("edge-up").remove();
  $("edge-down").remove();

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
    // the locked state: what the view is on, and the way out (it keeps
    // its room)
    const sel = s.links.storage?.selection;
    $("viewing").style.visibility = sel ? "visible" : "hidden";
    $("viewing").textContent = sel ? `viewing ${sel.replace(
      /\[(0x[0-9a-fA-F]{16,})\]/g, (_, h: string) => {
        const x = "0x" + (h.replace(/^0x0*/, "") || "0");
        return `[${x.slice(0, 6)}…${x.slice(-4)}]`;
      })} · Esc to clear` : "\u00a0";
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

  // The memory section, "Inside one play": its own lens in its own
  // elements; every pause decoded once for the checks (vanilla mem.js)
  const memMount = Object.fromEntries(Object.entries({ meta: "mmeta",
    level: "mlevel", point: "mpoint", mode: "mmoderow", viewing: "mviewing",
    note: "mnote", dump: "mpanel", tree: "mtree", details: "mdetails",
    how: "mhow", legend: "msrclegend", src: "msrc" })
    .map(([a, id]) => [a, place($(id)!)]));
  const memReady = (_: LensContextValue, shown: Promise<boolean>) => {
    const flat = (ns: ValueNode[]): ValueNode[] => ns.flatMap((n) =>
      n.kind === "group" ? flat(n.children ?? []) : n.kind ? [] : [n]);
    void shown.then(async () => {
      for (const id of ["mem:O0", "mem:O2"]) {
        const d = project.decodings[id];
        const out: typeof window.memResults.decoded[string] = {};
        for (const b of project.bookmarks.filter((x) =>
          x.decoding === id)) {
          out[b.id.split("/")[1]] = await Promise.all(b.points.map(
            async (pt) => {
              const ns = flat((await decode(project, d, pt)).tree);
              return { values: Object.fromEntries(ns.filter((n) => !n.none)
                .map((n) => [n.path, n.value?.text ?? ""])),
              none: ns.filter((n) => n.none).map((n) => n.path) };
            }));
        }
        window.memResults.decoded[id.slice(5)] = out;
      }
    }).catch((e) => {
      console.error(e);
      window.memResults.errors.push(String((e as Error)?.message ?? e));
    }).finally(() => {
      window.memResults.done = true;
    });
  };

  const ready = (lens: LensContextValue, shown: Promise<boolean>) => {
    // "show other state": the cards in the dump and by the tree's rows
    const box = $("insets") as HTMLInputElement;
    box.checked = lens.store.get().insets;
    box.addEventListener("change", () => lens.store.set((s) =>
      ({ ...s, insets: box.checked })));
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
    // (the view the hash asks for, or the first scene: the lens shows it)
    shown.then(() => recorded(lens.store.get().bookmark!)).then(() => {
      $("loadbar").hidden = true;
      window.results.usable = performance.now();
      window.results.done = true;
    });
  };

  const host = document.createElement("div");
  document.body.append(host);
  createRoot(host).render(<>
    <Lens spec={fullInspector} project={project} mount={mount}
      onReady={ready} hash />
    <Lens spec={insideOnePlay} project={project} mount={memMount}
      onReady={memReady} hash /></>);
} catch (e) {
  console.error(e);
  window.results.errors.push(String((e as Error)?.message ?? e));
  window.results.done = true;
}
