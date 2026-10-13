// The bugc stepper (addendum §8, T8.1): a scene's moments, stepped on
// the walkthrough's bar (TimelineBar.tsx, "moments"); under it the
// dumps and the variables, side by side; under them the code at the
// moment, in the walkthrough's pointer box (Code.tsx, "pane"). The dumps
// are pages, one a location, stacked, each its own box and its tab (the
// location), each as tall as its rows over the scene, to a cap, and
// scrolling inside itself past that (debugger.css): stepping moves
// nothing. The variables are everything in scope (the storage
// variables and the locals, one tree), linked to the pages: a local's
// bytes light in its page, as a storage variable's do. Its play steps
// through the scene's transactions. One column on a phone.
import {
  Children, useLayoutEffect, useRef, type ReactNode,
} from "react";
import type { Filter, Location } from "../engine/types";
import { panel } from "../ui/Panel";
import type { LensSpec, ViewSpec } from "../ui/types";

// each page's height, in rows: one height at every moment, whatever it
// holds then (a taller page scrolls inside; its lit rows come into view,
// ui/Dump.tsx)
// (on a phone, a word is two lines: fewer)
const ROWS: Partial<Record<Location, number>> = { stack: 4, calldata: 3,
  memory: 5, storage: 4 };
const PHONE: Partial<Record<Location, number>> = { stack: 3, calldata: 2,
  memory: 3, storage: 2 };
const phone = () => matchMedia("(max-width: 759.98px)").matches;

// (the pages, in one panel: one set of popovers over them all; each
// page's rows box set to its rows' height, measured: a row's height
// follows the type, which follows the width, ui/fit.ts)
const Pages = panel("spanel", "st");
function Wide({ children }: { children: ReactNode }) {
  const me = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = me.current;
    if (!root) return;
    // (a row's height: the tallest word's of its kind, a stack's
    // abbreviated words or the others' whole ones; a word past the end
    // of calldata draws shorter)
    const tallest = (q: string) => Math.max(0, ...[...root
      .querySelectorAll<HTMLElement>(q)].map((r) => r.offsetHeight));
    const fit = () => {
      const pitch = { abbr: tallest(".view.abbr > .rows .wrow"),
        word: tallest(".view:not(.abbr) > .rows .wrow") };
      for (const v of root.querySelectorAll<HTMLElement>(".view")) {
        const n = (phone() ? PHONE : ROWS)[v.dataset.location as
          Location];
        const box = v.querySelector<HTMLElement>(":scope > .rows");
        const row = pitch[v.classList.contains("abbr") ? "abbr" : "word"];
        if (!n || !box || !row) continue;
        const cs = getComputedStyle(box);
        const h = `${n * row + parseFloat(cs.paddingTop) +
          parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) +
          parseFloat(cs.borderBottomWidth)}px`;
        if (box.style.height !== h) box.style.height = h;
      }
    };
    fit();
    // (again as rows come, and as a row's height changes: the first
    // row's of each page, watched)
    const ro = new ResizeObserver(() => setTimeout(fit));
    const watch = () => {
      ro.disconnect();
      for (const r of root.querySelectorAll(".view > .rows .wrow:first-child"))
        ro.observe(r);
      fit();
    };
    watch();
    const mo = new MutationObserver(watch);
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);
  return <div ref={me} style={{ display: "contents" }}><Pages>
    {Children.toArray(children)}</Pages></div>;
}

const NOW = { decoding: "$scene", moment: "current" } as const;
// (a page's rows: the scene's, every one the location has at any step,
// storage's those that hold something: engine/replay.ts; the values'
// own besides; memory's, large, those that hold something here, the
// zeros folded into gaps)
const values: Filter = { rows: "values" };
const all: Filter = { rows: "all" };
const page = (location: Location, title: string, filter: Filter,
  more: Partial<ViewSpec> = {}): ViewSpec => ({
  id: location, kind: "dump", area: "wide", location, link: "st",
  data: NOW, filter, title, display: { ruler: false }, ...more } as
  ViewSpec);

export const stepper: LensSpec = {
  id: "stepper", title: "Stepping through bugc's code", timelines: [],
  decodings: [], grid: "", layout: "stepper", links: ["st"],
  columns: 2,
  areas: { wide: "dump pages", side: "sidecol" },
  wrap: { wide: Wide },
  views: [
    { id: "time", kind: "timeline", area: "moves", domId: "stime",
      bar: "moments" },
    page("stack", "Stack", all, { display: { ruler: false,
      abbreviate: 2 } } as Partial<ViewSpec>),
    page("calldata", "Calldata", all),
    page("memory", "Memory", values, { display: { ruler: false,
      foldZero: true } } as Partial<ViewSpec>),
    page("storage", "Storage", values),
    { id: "walk", kind: "walkthrough", area: "side", link: "st",
      domId: "sdetails", data: NOW },
    { id: "vars", kind: "variables", area: "side", data: NOW, link: "st",
      domId: "svars" },
    { id: "code", kind: "code", area: "src", data: NOW, domId: "scode",
      pane: true },
  ],
};
