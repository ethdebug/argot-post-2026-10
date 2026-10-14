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
// others; room left over, split among them all. Its height animates
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
  return body + parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
    parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
};
// share `room` among `needs`: each its need, to an equal share of what is
// left; what is over, split among them all
export function share(room: number, needs: number[]): number[] {
  const out = needs.map(() => 0);
  let left = Math.max(0, room);
  const order = needs.map((_, k) => k).sort((a, b) => needs[a] - needs[b]);
  order.forEach((k, j) => {
    out[k] = Math.min(needs[k], left / (order.length - j));
    left -= out[k];
  });
  // (whole pixels, summing to the room: what the rounding leaves, a
  // pixel each to the first)
  const hs = out.map((h) => h + left / Math.max(1, needs.length));
  const whole = hs.map(Math.floor);
  let rest = Math.round(hs.reduce((a, b) => a + b, 0) -
    whole.reduce((a, b) => a + b, 0));
  return whole.map((h) => rest-- > 0 ? h + 1 : h);
}

const Pages = panel("spanel", "st");
function Wide({ children }: { children: ReactNode }) {
  const me = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const lens = me.current?.closest<HTMLElement>(".lens");
    if (!lens) return;
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
      // (a phone's stack, in an area of its own over the others: the
      // area's gap to them too)
      const between = gap * Math.max(0, group.length - 1);
      const rowsOf = (v: HTMLElement) => v.querySelector<HTMLElement>(
        ".rows");
      const hs = share(room - tabs - between, open.map((v) =>
        rowsOf(v) ? need(rowsOf(v)!) : 0));
      for (const v of group) {
        const b = box(v);
        const k = open.indexOf(v);
        const h = `${k < 0 ? 0 : hs[k]}px`;
        if (b && b.style.height !== h) b.style.height = h;
      }
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
