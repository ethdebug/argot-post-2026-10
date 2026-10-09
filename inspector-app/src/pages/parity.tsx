// The parity page: the vanilla page's markup (index.html, copied
// from it at the switch) with the full-inspector lens in its storage
// section: its views take the places of the static #picker, #mode,
// #panel and #tree. The page keeps what is its own: the scene's intro
// and summary, main[data-single], and the hooks the tests use
// (window.select, window.results).
import "../../../shared/appendix.css";
import "../style.css";
import "../ui/port.css";
import "../lenses/raw.css";
import { createRoot } from "react-dom/client";
import { createPortal } from "react-dom";
import { useLayoutEffect, useMemo, useState, type ReactElement }
  from "react";
import { rawLenses } from "../lenses/raw";
import { readHash, writeHash, type Pending } from "../ui/hash";
import { fetchIo, type Io } from "../engine/io";
import { load } from "../engine/project";
import { builds, scenes } from "../scenes";
import { decode } from "../engine/decode";
import type { Decoded } from "../engine/types";
import { calldataShown, fullInspector } from "../lenses/full-inspector";
import { insideOnePlay } from "../lenses/inside-one-play";
import type { ValueNode } from "../engine/types";
import { Lens } from "../ui/Lens";
import { ContractSource } from "../ui/ContractSource";
import { OtherScenes, type LensContextValue } from "../ui/hooks";

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
    select(id: string, view?: { moment?: number;
      sel?: string | null }): Promise<boolean>;
  }
}

const $ = (id: string) => document.getElementById(id)!;
// (the built page shows itself once its stylesheets are in: index.html's
// styled(); the dev server's are in once this runs)
if (!document.querySelector("link[data-css]")) {
  document.documentElement.classList.add("styled");
}

// The loader's (src/pages/loader.js, inlined in the page): the data with
// progress, a failure with Retry
interface Loading { load(url: string, o?: { label?: string;
  quiet?: boolean }): Promise<unknown>; fail(e: unknown,
  again: () => void): void; retry(): void; busy(): boolean }
const loading = (window as unknown as { loading?: Loading }).loading;
// a scene's snapshot's label: its scene's title, as the picker has it
const labelOf = (p: string) => {
  const id = p.replace(/^snapshots\/|\.json$/g, "");
  const b = document.querySelector<HTMLElement>(
    `#picker button[data-snapshot="${id}"]`);
  return b ? `“${b.textContent!.replace(/\s+/g, " ").trim()}”` : undefined;
};
const io: Io = loading ? {
  json: <T,>(p: string) => loading.load(p, { label: labelOf(p) }) as
    Promise<T>,
  text: (p) => fetchIo(import.meta.env.BASE_URL).text(p),
  bytes: (p) => fetchIo(import.meta.env.BASE_URL).bytes(p),
} : fetchIo(import.meta.env.BASE_URL);
// After the page is usable, the other scenes' data, one at a time, while
// the browser is idle and nothing else is loading (vanilla prefetch)
function prefetch(files: string[]) {
  const idle = (f: () => void) => (window.requestIdleCallback ??
    ((g: () => void) => setTimeout(g, 200)))(f);
  const next = () => idle(() => {
    if (!files.length || !loading) return;
    if (loading.busy()) return void setTimeout(next, 500);
    loading.load(`snapshots/${files.shift()}.json`, { quiet: true })
      .catch(() => {}).then(next);
  });
  next();
}
// a load that failed: the loader's bar, with Retry
const onFail = (e: unknown, again: () => void) => loading
  ? loading.fail(e, again) : console.error(e);
// (bin/run.mjs: fit the dumps' fonts again, after a layout change; each
// dump fits on resize)
(window as unknown as { fitDumps(): void }).fitDumps = () =>
  dispatchEvent(new Event("resize"));
window.results = { done: false, errors: [], decoded: {} };
window.memResults = { done: false, errors: [], decoded: {} };

function Drawn() {
  useLayoutEffect(() => {
    for (const el of statics.splice(0)) el.remove();
  }, []);
  return null;
}

// a static element's place, for a view (no box of its own)
// (the static element stays until the views first draw, then goes in
// the same frame: nothing moves)
const statics: Element[] = [];
const place = (el: Element) => {
  const host = document.createElement("div");
  host.style.display = "contents";
  el.before(host);
  statics.push(el);
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


// The page's scenes of other lenses (fixtures/index.json's `lens`):
// "Raw bytes" shows the raw lens (its compositions by a toggle, when
// there are several), in place of the storage inspector; the hash
// keeps it (scene=, raw=)
const RAW = Object.fromEntries(rawLenses.map((l) =>
  [l.id.replace(/^raw-/, ""), l]));
const hashed: Pending = {};
function Page(p: { project: Awaited<ReturnType<typeof load>>;
  rawBox: Element; memory: ReactElement; storage: ReactElement }) {
  const [scene, setScene] = useState<string | null>(() => {
    const s = readHash().get("scene");
    return p.project.page.some((x) => x.id === s && x.lens !== "inspector")
      ? s : null;
  });
  const [variant, setVariant] = useState(() =>
    RAW[readHash().get("raw") ?? ""] ? readHash().get("raw")! : "hero");
  useLayoutEffect(() => {
    document.querySelector("main")!.toggleAttribute("data-lens", !!scene);
    writeHash({ scene, raw: scene ? variant : null }, hashed);
  }, [scene, variant]);
  const other = useMemo(() => ({ scene, go: setScene }), [scene]);
  return <><Drawn />
    <OtherScenes.Provider value={other}>{p.storage}</OtherScenes.Provider>
    {p.memory}
    {scene && createPortal(<>
      {Object.keys(RAW).length > 1 && <div className="picker rawpick"
        role="radiogroup"
        aria-label="Composition">
        {Object.entries(RAW).map(([k, l]) => <button key={k} role="radio"
          data-raw={k} aria-checked={k === variant ? "true" : "false"}
          title={l.title} onClick={() => setVariant(k)}>
          {k[0].toUpperCase() + k.slice(1)}</button>)}
      </div>}
      <Lens key={variant} spec={RAW[variant]} project={p.project} />
    </>, p.rawBox)}</>;
}

try {
  const project = await load(io, { scenes, builds });
  // (the contract at the top: the page's own, shown as it is)
  const contract = { file: $("contract-box").querySelector(".srcfile")
    ?.textContent ?? undefined, text: $("contract-src").textContent! };
  const mount = { pick: place($("picker")), time: place($("timeline")),
    rows: place($("related")),
    dump: place($("panel")), tree: place($("tree")),
    bar: place($("details")), cdump: place($("cpanel")),
    ctree: place($("ctree")), cdetails: place($("cdetails")),
    chow: place($("chow")),
    contract: place($("contract-box")) };
  // (the walkthrough panel draws the details under its bar)
  statics.push($("dwrap"));
  // (the tree view draws its own edge buttons)
  statics.push($("edge-up"), $("edge-down"));

  // the scene's intro and summary, and no Before | After at one point
  // (the calldata section: its own link group's part of the page)
  $("calldata").setAttribute("data-link-scope", "calldata");
  const scene = (lens: LensContextValue) => {
    const s = lens.store.get();
    const bm = project.bookmarks.find((b) => b.id === s.scene);
    if (!bm) return;
    for (const p of $("intros").querySelectorAll<HTMLElement>(
      "[data-scene]")) {
      p.hidden = p.dataset.scene !== bm.id;
    }
    document.querySelector("main")!.toggleAttribute("data-single",
      bm.points.length === 1);
    $("summary").textContent = bm.summary ?? "";
    // (the call's calldata, for a scene that names its function; what it
    // lights, for bin/run.mjs: the parts lit, and the one chosen)
    $("calldata").hidden = !bm.calldata || !calldataShown();
    const cl = s.links.calldata;
    const abi = project.decodings[`abi:${bm.id}`];
    if (abi) {
      void decode(project, abi, bm.points[bm.points.length - 1])
        .then((d) => {
          // (by the parts' ABI ids, as vanilla's)
          const part = (p?: string | null) => p ? d.byPath.get(p)?.part ??
            null : null;
          const k = cl?.hover?.path ?? cl?.selection ?? null;
          const n = k ? d.byPath.get(k) : undefined;
          (window as unknown as { calldataResults: unknown })
            .calldataResults = { chosen: part(cl?.selection),
              lit: !n ? [] : n.children ? n.children.map((x) => x.part)
                : [n.part] };
        }, () => {});
    }
    // (the locked state, what the view is on and the way out, is the
    // bar's: WalkthroughPanel)
  };

  // (a scene's values are recorded the first time it shows: picked, or
  // selected by window.select)
  const recording = new Map<string, Promise<void>>();
  const recorded = (id: string) => {
    if (!recording.has(id)) {
      const bm = project.bookmarks.find((b) => b.id === id)!;
      const d = project.decodings[bm.decoding];
      const r = Promise.all(bm.points.map((p) =>
        decode(project, d, p))).then((at) =>
        record(id, [at[0], at[at.length - 1]]));
      // (a failed load: recorded again once it loads)
      r.catch(() => recording.get(id) === r && recording.delete(id));
      recording.set(id, r);
    }
    return recording.get(id)!;
  };

  // The memory section, "Inside one play": its own lens in its own
  // elements; every pause decoded once for the checks (vanilla mem.js)
  const memMount = Object.fromEntries(Object.entries({ meta: "mmeta",
    level: "mlevel", point: "mpoint", viewing: "mviewing",
    note: "mnote", dump: "mpanel", sdump: "mspanel", tree: "mtree",
    bar: "mdetails", rows: "mrelated", legend: "msrclegend",
    src: "msrc" })
    .map(([a, id]) => [a, place($(id)!)]));
  const memReady = (lens: LensContextValue, shown: Promise<boolean>) => {
    // (the storage panel's box: every pause has storage in scope)
    $("mstore").hidden = false;
    const flat = (ns: ValueNode[]): ValueNode[] => ns.flatMap((n) =>
      n.kind === "group" ? flat(n.children ?? []) : n.kind ? [] : [n]);
    void shown.then(async () => {
      // (the locals: the scope's "@locals" group)
      for (const o of ["0", "2"]) {
        const id = `bug-O${o}/scope`;
        const d = project.decodings[id];
        const out: typeof window.memResults.decoded[string] = {};
        for (const b of project.bookmarks.filter((x) =>
          x.decoding === id)) {
          out[b.id.split("/")[1]] = await Promise.all(b.points.map(
            async (pt) => {
              const ns = flat((await decode(project, d, pt)).tree
                .filter((n) => n.path === "@locals"));
              return { values: Object.fromEntries(ns.filter((n) => !n.none)
                .map((n) => [n.path, n.value?.text ?? ""])),
              none: ns.filter((n) => n.none).map((n) => n.path) };
            }));
        }
        window.memResults.decoded[o] = out;
      }
    }).catch((e) => {
      console.error(e);
      window.memResults.errors.push(String((e as Error)?.message ?? e));
    }).finally(() => {
      window.memResults.done = true;
    });
  };

  // (once the views have drawn what the lens shows: the dump its point,
  // the tree its selection; as vanilla's, which draws at once)
  const drawn = async (lens: LensContextValue) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() =>
      r(null)));
    const done = () => {
      const s = lens.store.get();
      const want = project.bookmarks.find((b) => b.id === s.scene)
        ?.points[s.moment];
      const sel = s.links.storage?.selection;
      return !!document.querySelector(
        `#panel .view:not([hidden])[data-point="${want}"]`) && (!sel ||
        !!document.querySelector(`#tree li[data-path="${CSS.escape(sel)}"]` +
          " > .row.sel"));
    };
    for (let k = 0; k < 300 && !done(); k++) await frame();
    await frame();
  };
  const ready = (lens: LensContextValue, shown: Promise<boolean>) => {
    lens.store.subscribe(() => {
      scene(lens);
      const id = lens.store.get().scene;
      if (id && !lens.store.get().error) recorded(id).catch(() => {});
    });
    window.select = async (id, view) => {
      const ok = await lens.show(id, view);
      if (ok) await recorded(id);
      if (ok) await drawn(lens);
      return ok;
    };
    // (the view the hash asks for, or the first scene: the lens shows
    // it; usable once one is shown, after a failure once Retry or a pick
    // shows one)
    const usable = () => {
      const id = lens.store.get().scene;
      if (!id || lens.store.get().error || window.results.done) return;
      recorded(id).then(() => drawn(lens)).then(() => {
        if (window.results.done) return;
        off();
        window.results.usable = performance.now();
        window.results.done = true;
        const bm = project.bookmarks.find((b) => b.id === id)!;
        prefetch((fullInspector.bookmarks ?? []).filter((b) =>
          b !== bm.id));
      }, () => {});
    };
    const off = lens.store.subscribe(usable);
    void shown.then((ok) => ok && usable());
  };

  // (each section's part of the page: its Escape and its clicks; vanilla
  // main.js and mem.js keySection)
  const memoryPart = (el: Element) => !!el.closest?.("#memory");
  const storagePart = (el: Element) => !el.closest?.("#memory");
  const host = document.createElement("div");
  document.body.append(host);
  // (a scene another lens shows, "Raw bytes": in its own box under the
  // picker; the page hides the rest meanwhile, main[data-lens])
  const rawBox = document.createElement("div");
  rawBox.id = "rawscene";
  $("storage").after(rawBox);
  const kinds = { contract: (q: Parameters<typeof ContractSource>[0]) =>
    <ContractSource {...q} {...contract} /> };
  createRoot(host).render(<Page project={project} rawBox={rawBox}
    storage={<Lens spec={fullInspector} project={project}
      mount={mount} onReady={ready} onFail={onFail} hash
      within={storagePart} kinds={kinds} />}
    memory={<Lens spec={insideOnePlay} project={project} mount={memMount}
      onReady={memReady} hash within={memoryPart} />} />);
} catch (e) {
  // (the index or the memory section's data did not load: Retry loads
  // the page again)
  if (loading) loading.fail(e, () => location.reload());
  else {
    console.error(e);
    window.results.errors.push(String((e as Error)?.message ?? e));
    window.results.done = true;
  }
}
