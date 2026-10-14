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
import type { Display, LensSpec, ViewSpec } from "../ui/types";

// The pages share one fixed room (debugger.css --pages-h): the stack's
// column its own height, beside the others; on a phone the four, one
// under another. A page is open, or shut to its tab (Dump.tsx): the
// open ones share what the tabs leave, each as much as its rows need
// while that is less than an equal share, the rest split among the
// others; room none needs stays at the bottom of the area. Its height animates
// (debugger.css). Measured anew as rows come, as the shut ones change,
// and on resize; held while a move runs (a move's steps would open and
// shut them by turns), laid out once it rests.
const phone = () => matchMedia("(max-width: 759.98px)").matches;
// a page's rows' height: its content's, its box's padding and border
const need = (box: HTMLElement) => {
  const cs = getComputedStyle(box);
  const kids = [...box.children] as HTMLElement[];
  const body = kids.length ? kids[kids.length - 1].getBoundingClientRect()
    .bottom - kids[0].getBoundingClientRect().top : 0;
  return Math.ceil(body + parseFloat(cs.paddingTop) +
    parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) +
    parseFloat(cs.borderBottomWidth));
};
// share `room` among `needs`: each its need, when they all fit (what
// none needs stays under them, the area's); else each a part of the
// room as its need is of theirs, whole pixels, at least `least` (or its
// need, if less): their lit rows scroll into view (ui/Dump.tsx)
export function share(room: number, needs: number[], least = 0): number[] {
  const all = needs.reduce((a, b) => a + b, 0);
  room = Math.max(0, Math.floor(room));
  if (all <= room) return needs.map((n) => Math.ceil(n));
  const min = needs.map((n) => Math.min(n, least));
  const over = Math.max(0, room - min.reduce((a, b) => a + b, 0));
  const extra = needs.map((n, k) => n - min[k]);
  const sum = extra.reduce((a, b) => a + b, 0) || 1;
  const out = needs.map((_, k) => min[k] + Math.floor(over * extra[k] / sum));
  // (the pixels the rounding leaves: to the neediest)
  let rest = room - out.reduce((a, b) => a + b, 0);
  const order = needs.map((_, k) => k).sort((a, b) => extra[b] - extra[a]);
  for (let j = 0; rest > 0 && order.length; j = (j + 1) % order.length) {
    out[order[j]]++;
    rest--;
  }
  return out;
}

const Pages = panel("spanel", "st");
function Wide({ children }: { children: ReactNode }) {
  const me = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const lens = me.current?.closest<HTMLElement>(".lens");
    if (!lens) return;
    // (the pages' places as last laid out, and which were open: a page
    // that opens or shuts moves to its new place from its old one)
    const places = new Map<Element, number>();
    let was = "";
    let settle: ReturnType<typeof setTimeout> | undefined;
    const still = () =>
      matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fit = () => {
      if (lens.hasAttribute("data-playing")) return;
      const room = parseFloat(getComputedStyle(lens)
        .getPropertyValue("--pages-h")) || 0;
      const views = [...lens.querySelectorAll<HTMLElement>(
        ".view[data-location][data-open]")];
      const stack = views.find((v) => v.dataset.location === "stack");
      // (the pages that share the room: on a phone, all four)
      const group = phone() || !stack ? views
        : views.filter((v) => v !== stack);
      // (a page's box, the rows' clip: its height set, the rows filling it)
      const box = (v: HTMLElement) => v.querySelector<HTMLElement>(
        ".pagebox");
      // (a tab's height as drawn, fractions and all: the room's parts
      // add up to it exactly, as they move too)
      const tab = (v: HTMLElement) => v.querySelector<HTMLElement>(
        ".view-head")?.getBoundingClientRect().height ?? 0;
      const tabs = group.reduce((n, v) => n + tab(v), 0);
      // (the gap between pages: the pages' own, and the lens's between
      // its areas, one value: debugger.css)
      const gap = parseFloat(getComputedStyle(lens.querySelector(
        ".pages .views") ?? lens).rowGap) || 0;
      const open = group.filter((v) => v.dataset.open === "true");
      // (a page shut goes to the bottom, opened back to its place,
      // debugger.css: from where it was, in the heights' time)
      const pages = [...lens.querySelectorAll<HTMLElement>(
        ":scope > [data-area=wide] .view[data-open]")];
      const now = pages.map((v) => v.dataset.open).join();
      if (was && now !== was && !still()) {
        for (const v of pages) {
          const from = places.get(v);
          const dy = from === undefined ? 0 : from -
            v.getBoundingClientRect().top;
          if (!dy) continue;
          v.style.transition = "none";
          v.style.transform = `translateY(${dy}px)`;
          void v.offsetHeight;
          v.style.transition = "transform 420ms cubic-bezier(0.4, 0, 0.2, 1)";
          v.style.transform = "";
        }
      }
      was = now;
      // (what the boxes have, the room less all else as it is laid out:
      // the tabs, the gaps, the pile's overlaps; each area's pages from
      // its top to the last one's bottom, less their boxes, as laid out,
      // not as a page's move draws it, a transform)
      const shift = (v: HTMLElement) => new DOMMatrix(getComputedStyle(v)
        .transform === "none" ? "" : getComputedStyle(v).transform).m42;
      const extent = (area: Element | null) => {
        const vs = group.filter((v) => area?.contains(v));
        if (!area || !vs.length) return 0;
        const top = area.getBoundingClientRect().top;
        const bottom = Math.max(...vs.map((v) =>
          v.getBoundingClientRect().bottom - shift(v)));
        return bottom - top - vs.reduce((n, v) => n + (box(v)
          ?.getBoundingClientRect().height ?? 0), 0);
      };
      const areaOf = (n: string) => lens.querySelector(
        `:scope > [data-area=${n}]`);
      const fixed = extent(areaOf("wide")) + (stack && group.includes(stack)
        ? extent(areaOf("narrow")) + gap : 0);
      void tabs;
      const rowsOf = (v: HTMLElement) => v.querySelector<HTMLElement>(
        ".rows");
      // (when they cannot all have their rows: each at least two of its
      // rows' height, about)
      const least = 2 * Math.max(0, ...[...lens.querySelectorAll<
        HTMLElement>(".pages .rows .wrow")].map((r) => r.offsetHeight));
      const hs = share(room - fixed, open.map((v) =>
        rowsOf(v) ? need(rowsOf(v)!) : 0), least);
      for (const v of group) {
        const b = box(v);
        const k = open.indexOf(v);
        const h = `${k < 0 ? 0 : hs[k]}px`;
        if (b && b.style.height !== h) b.style.height = h;
      }
      // (their places once laid out: after the heights' move)
      clearTimeout(settle);
      settle = setTimeout(() => {
        for (const v of pages) places.set(v, v.getBoundingClientRect().top);
      }, still() ? 0 : 450);
      // (the stack's column, beside them: its own height, the room)
      if (stack && !group.includes(stack)) box(stack)?.style
        .removeProperty("height");
      // (a phone: the stack's area and the others' together the room,
      // however many are shut)
      const wide = lens.querySelector<HTMLElement>(
        ":scope > [data-area=wide]");
      const narrow = lens.querySelector<HTMLElement>(
        ":scope > [data-area=narrow]");
      if (wide && narrow) {
        const sh = stack && group.includes(stack) ? tab(stack) + (stack
          .dataset.open === "true" ? hs[open.indexOf(stack)] ?? 0 : 0) : 0;
        const h = group.includes(stack!) ? `${room - sh - gap}px` : "";
        if (wide.style.height !== h) wide.style.height = h;
      }
    };
    fit();
    const ro = new ResizeObserver(() => setTimeout(fit));
    const watch = () => {
      ro.disconnect();
      for (const r of lens.querySelectorAll(".view .rows .run, " +
        ".view .rows > .gap")) ro.observe(r);
      fit();
    };
    watch();
    const mo = new MutationObserver(watch);
    for (const a of lens.querySelectorAll(":scope > :is([data-area=wide], " +
      "[data-area=narrow])")) mo.observe(a, { childList: true,
      subtree: true, attributes: true, attributeFilter: ["data-open"] });
    mo.observe(lens, { attributes: true, attributeFilter: ["data-playing"] });
    addEventListener("resize", fit);
    return () => {
      ro.disconnect();
      mo.disconnect();
      clearTimeout(settle);
      removeEventListener("resize", fit);
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
  data: NOW, filter, title, ...more,
  display: { ruler: false, edges: true,
    ...(more as { display?: Display }).display } } as ViewSpec);

export const stepper: LensSpec = {
  id: "stepper", title: "Stepping through bugc's code", timelines: [],
  decodings: [], grid: "", layout: "stepper", links: ["st"],
  columns: 2,
  areas: { wide: "dump pages", narrow: "stackcol", side: "sidecol" },
  wrap: { wide: Wide },
  views: [
    { id: "time", kind: "timeline", area: "moves", domId: "stime",
      bar: "moments" },
    // (the stack: a narrow column beside the others, its tab along its
    // edge, as the debugger's beside its dumps; a page on a phone)
    page("stack", "Stack", all, { area: "narrow", display: { ruler: false,
      abbreviate: 2 } } as Partial<ViewSpec>),
    page("calldata", "Calldata", all),
    page("memory", "Memory", values, { display: { ruler: false,
      foldZero: true } } as Partial<ViewSpec>),
    page("storage", "Storage", values),
    { id: "walk", kind: "walkthrough", area: "side", link: "st",
      domId: "sdetails", data: NOW },
    { id: "vars", kind: "variables", area: "side", data: NOW, link: "st",
      domId: "svars", edges: true },
    { id: "code", kind: "code", area: "src", data: NOW, domId: "scode",
      pane: true },
  ],
};
