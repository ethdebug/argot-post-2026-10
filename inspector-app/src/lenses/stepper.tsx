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
import { useLens } from "../ui/hooks";
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
const needRows = (box: HTMLElement) => {
  const cs = getComputedStyle(box);
  const kids = [...box.children] as HTMLElement[];
  const body = kids.length ? kids[kids.length - 1].getBoundingClientRect()
    .bottom - kids[0].getBoundingClientRect().top : 0;
  return Math.ceil(body + parseFloat(cs.paddingTop) +
    parseFloat(cs.paddingBottom) + parseFloat(cs.borderTopWidth) +
    parseFloat(cs.borderBottomWidth));
};
// share `room` among `needs`: each its need, when they all fit, and what
// none needs split among them, the pages filling the room (their rows at
// their tops, their paper under them); else each a part of the room as
// its need is of theirs, whole pixels, at least `least` (or its need, if
// less): their lit rows scroll into view (ui/Dump.tsx)
export function share(room: number, needs: number[], least = 0): number[] {
  const all = needs.reduce((a, b) => a + b, 0);
  room = Math.max(0, Math.floor(room));
  if (all <= room) {
    const out = needs.map((n) => Math.ceil(n));
    let rest = room - out.reduce((a, b) => a + b, 0);
    const each = needs.length ? Math.floor(rest / needs.length) : 0;
    return out.map((h) => {
      const x = h + each + (rest - each * needs.length > 0 ? 1 : 0);
      rest -= x - h;
      return x;
    });
  }
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
  const { store } = useLens();
  useLayoutEffect(() => {
    const lens = me.current?.closest<HTMLElement>(".lens");
    if (!lens) return;
    // Which pages are open (LensState.pages): a page needed (Dump.tsx
    // data-needed) opens when the moment or the selection changes, and
    // none shuts then; one shuts only when the open ones no longer fit
    // the room, the least lately needed of those not needed now first
    // (never one needed now, unless those alone do not fit: then they
    // share the room by need). A reader's own opening or shutting holds
    // the same way. A show of the scene anew, a Reset, starts over: the
    // pages needed then, open.
    let seen = "";
    let tick = 0;
    const lately = new Map<string, number>();
    const needed = new Map<string, boolean>();
    // (what this last wrote, and the pages the reader opened since)
    let wrote: Record<string, boolean> = {};
    const byHand = new Set<string>();
    // (the related view on: a page with related rows open, one with none
    // shut, the stack too; each its rows' height, whatever a step of a
    // walkthrough lights. As it comes on, the pages as they were kept;
    // as it goes off, put back: folds and scrolls)
    type Held = { pages: Record<string, boolean>;
      scroll: Map<string, number>; byHand: Set<string>;
      heights: Map<string, string> };
    let held: Held | null = null;
    // (put back, while a walkthrough still folds away: nothing decided
    // anew until it has, its steps' lights no longer the pages')
    let restoring = false;
    // (the shut pages waiting for their height to go, to join the row)
    const rowAt = new Map<HTMLElement, ReturnType<typeof setTimeout>>();
    // (each page's box's padding and edges, as last seen open)
    const seenEdges = new Map<string, number>();
    // (the pages' order, over the stack: their own, at first)
    const RANK = ["calldata", "memory", "storage"];
    let rank = [...RANK];
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
      // (the pages that share the room: on a phone, all four, but the
      // stack shut there, its tab in the row of shut tabs: debugger.css)
      const joined = phone() && !!stack && stack.dataset.open === "false" &&
        stack.dataset.row === "true";
      const group = (phone() && !joined) || !stack ? views
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
      // (the pages open now, by the rule above; written to the lens if
      // that changes them, which lays them out again)
      const s = store.get();
      const loc = (v: HTMLElement) => v.dataset.location!;
      const related = s.related !== undefined;
      // (put back: nothing decided anew until the pages have their rows
      // back, the related view's gone from them)
      if (restoring) {
        if (views.some((v) => v.dataset.related !== undefined)) return;
        restoring = false;
      }
      const rowsAt = (v: HTMLElement) => v.querySelector<HTMLElement>(
        ".rows");
      // (its rows not in yet: nothing to decide)
      if (related && views.some((v) => v.dataset.related === undefined))
        return;
      if (!related && held) {
        const w = held;
        held = null;
        byHand.clear();
        w.byHand.forEach((l) => byHand.add(l));
        wrote = { ...w.pages };
        seen = `${s.scene}|${s.moment}|${s.links.st?.selection ?? ""}`;
        // (its pages' places and scrolls as before, once their heights
        // have come back)
        // (each page's scroll as it was, once its rows are back: Dump.tsx;
        // its height as it was, now, as its fold: one move together)
        for (const v of views) {
          v.dataset.restore = String(w.scroll.get(loc(v)) ?? 0);
          const b = box(v), h = w.heights.get(loc(v));
          if (b && h && b.style.height !== h) b.style.height = h;
        }
        restoring = true;
        store.set((x) => ({ ...x, pages: w.pages }));
        return;
      }
      const need = (v: HTMLElement) => related
        ? v.dataset.related === "true" : v.dataset.needed === "true";
      const key = `${s.scene}|${s.moment}|${s.links.st?.selection ?? ""}`;
      const fresh = !s.pages;
      const next: Record<string, boolean> = Object.fromEntries(views.map(
        (v) => [loc(v), fresh ? need(v) : !!s.pages![loc(v) as Location]]));
      // (a page needed anew: on a new moment or selection, or as its
      // rows come for one, its related rows a moment later)
      const moved = key !== seen;
      if (moved) tick++;
      // (their order: those needed at a new moment or selection to the
      // top, in the order they had; the rest after them, as they were; a
      // show anew, the pages' own order)
      if (fresh) rank = [...RANK];
      // (a page the reader opened since: kept as one needed, until the
      // next moment or selection)
      if (moved || fresh) byHand.clear();
      for (const v of views) {
        if (!fresh && s.pages![loc(v) as Location] && wrote[loc(v)] ===
          false) {
          byHand.add(loc(v));
          lately.set(loc(v), tick);
        }
      }
      // (the related view: its pages exactly; none of the pages but the
      // stack's with any of it, the pages as they were)
      if (related && views.some((v) => loc(v) !== "stack" && need(v))) {
        for (const v of views) next[loc(v)] = need(v);
      } else if (related) {
        const stack0 = views.find((v) => loc(v) === "stack");
        if (stack0) next.stack = need(stack0);
      }
      const pulled = new Set<string>();
      for (const v of views) {
        if (need(v) && (moved || fresh || !needed.get(loc(v)))) {
          next[loc(v)] = true;
          lately.set(loc(v), tick);
          pulled.add(loc(v));
        }
        needed.set(loc(v), need(v));
      }
      // (and to the top, in the order they had)
      rank = [...rank.filter((l) => pulled.has(l)),
        ...rank.filter((l) => !pulled.has(l))];
      seen = key;
      const open = group.filter((v) => next[loc(v)]);
      // (a page shut goes to the bottom, the open ones in their order
      // over them: each to its place from where it was, in the heights'
      // time)
      const pages = [...lens.querySelectorAll<HTMLElement>(
        ":scope > [data-area=wide] .view[data-open]")];
      for (const v of pages) {
        const k = rank.indexOf(loc(v));
        const o = String(next[loc(v)] ? k : RANK.length + k);
        if (v.style.order !== o) v.style.order = o;
      }
      // (the top page, its tab on the area's top; the top shut one, its
      // tab on the last open page's strip: debugger.css)
      const laid = [...pages].sort((a, b) => Number(a.style.order) -
        Number(b.style.order));
      const pile = laid.find((v) => !next[loc(v)]);
      for (const [k, v] of laid.entries()) {
        const last = String(v === laid[laid.length - 1]);
        if (v.dataset.last !== last) v.dataset.last = last;
        // (it and the one under it both open: a styling hook; and the one
        // under it in the row of shut tabs, or none: no strip for a tab)
        const after = laid[k + 1];
        const below = String(!!next[loc(v)] && (!after || (!next[loc(
          after)] && after.dataset.row === "true")));
        if (v.dataset.nextRow !== below) v.dataset.nextRow = below;
        const nextOpen = String(!!next[loc(v)] && !!after &&
          !!next[loc(after)]);
        if (v.dataset.nextOpen !== nextOpen) v.dataset.nextOpen = nextOpen;
        const top = String(v === laid[0]);
        const pt = String(v === pile && v !== laid[0]);
        if (v.dataset.top !== top) v.dataset.top = top;
        if (v.dataset.pileTop !== pt) v.dataset.pileTop = pt;
      }
      const now = pages.map((v) => `${v.dataset.open}${v.style.order}`)
        .join();
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
      // (what the boxes have, the room less all else: each page's tab and
      // edges (its height less its box's), the gaps between pages, a
      // pile's overlaps; on a phone, the stack's area over the others and
      // the gap between them. The room the pages leave, above the pile,
      // is no part of it)
      const own = (v: HTMLElement) => v.getBoundingClientRect().height -
        (box(v)?.getBoundingClientRect().height ?? 0);
      const overlap = (v: HTMLElement) => Math.min(0,
        parseFloat(getComputedStyle(v).marginTop) || 0);
      // (a phone's stack in an area of its own, over the others, in one
      // cell with them: none between them, debugger.css)
      const between = 0;
      // (the shut tabs in their row, one row or more, wrapping: the rows'
      // height, from the first of them to the last, not a tab each)
      const inRow = (v: HTMLElement) => v.dataset.open === "false" &&
        v.dataset.row === "true" && v !== stack;
      const slot = lens.querySelector<HTMLElement>(
        ":scope > [data-area=wide] .stackslot");
      const rowEls = [...group.filter(inRow), ...joined && slot ? [slot]
        : []];
      const rowH = rowEls.length ? Math.max(...rowEls.map((e) =>
        e.getBoundingClientRect().bottom)) - Math.min(...rowEls.map((e) =>
        e.getBoundingClientRect().top - (parseFloat(getComputedStyle(e)
          .marginTop) || 0))) : 0;
      const fixed = group.filter((v) => !inRow(v)).reduce((n, v) =>
        n + own(v) + overlap(v), 0) + rowH +
        gap * Math.max(0, group.length - 1 - (stack && group.includes(stack)
          ? 1 : 0));
      void tabs;
      const rowsOf = (v: HTMLElement) => v.querySelector<HTMLElement>(
        ".rows");
      // (when they cannot all have their rows: each at least two of its
      // rows' height, about)
      const least = 2 * Math.max(0, ...[...lens.querySelectorAll<
        HTMLElement>(".pages .rows .wrow")].map((r) => r.offsetHeight));
      // (a page's need: its rows', and its box's padding and edge, where
      // its edges' buttons are)
      // (as it is open: a shut page's box has none, and one just opened
      // may not be drawn open yet; the last seen open, or another's)
      // (and not while they move: their padding and edge move with its
      // height, debugger.css)
      const edgeOf = (v: HTMLElement) => {
        const b = box(v);
        if (!b || v.dataset.open !== "true" || b.getAnimations?.().some(
          (a) => /padding|border/.test((a as CSSTransition)
            .transitionProperty ?? ""))) return undefined;
        const cs = getComputedStyle(b);
        return parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom) +
          parseFloat(cs.borderTopWidth) + parseFloat(cs.borderBottomWidth);
      };
      for (const v of group) {
        const e = edgeOf(v);
        if (e) seenEdges.set(loc(v), e);
      }
      const edges = (v: HTMLElement) => seenEdges.get(loc(v)) ??
        Math.max(0, ...seenEdges.values());
      const needOf = (v: HTMLElement) => rowsOf(v) ? needRows(rowsOf(v)!) +
        edges(v) : 0;
      // (too many to fit: the least lately needed of those not needed now
      // shut, one by one, until the rest do)
      const avail = room - fixed;
      // (a page's least: its need, up to two rows', about)
      const floor = (v: HTMLElement) => Math.min(needOf(v), least +
        edges(v));
      // (a lit page's want: all its lit rows, a row about them, and its
      // edges; at most its need)
      const litWant = (v: HTMLElement) => {
        const r = rowsOf(v);
        // (the rows the selection lights, as the page holds them: not
        // what a pointer in a dump lights, Dump.tsx)
        const lit = new Set((r?.dataset.lit ?? "").split(" "));
        const on = r ? [...r.querySelectorAll<HTMLElement>(".wrow[data-slot]")]
          .filter((x) => lit.has(x.dataset.slot!)) : [];
        if (!r || !on.length) return floor(v);
        const row = on[0].offsetHeight;
        const span = on[on.length - 1].getBoundingClientRect().bottom -
          on[0].getBoundingClientRect().top;
        return Math.min(needOf(v), span + 3 * row + edges(v));
      };
      // (room short: the pages not lit shut, the least lately needed
      // first, before a lit one has less than its lit rows; the others
      // at least two rows only while there is room for that)
      const fits = () => open.reduce((n, v) => n + (need(v) ? litWant(v)
        : floor(v)), 0) <= avail;
      const spare = open.filter((v) => !need(v) && !byHand.has(loc(v)))
        .sort((a, b) =>
        (lately.get(loc(a)) ?? 0) - (lately.get(loc(b)) ?? 0));
      while (!fits() && spare.length) {
        const v = spare.shift()!;
        open.splice(open.indexOf(v), 1);
        next[loc(v)] = false;
      }
      if (fresh || views.some((v) => next[loc(v)] !==
        !!s.pages![loc(v) as Location])) {
        wrote = { ...next };
        store.set((x) => ({ ...x, pages: next }));
        return;
      }
      // (all fit: each its need, the spare shared. Else the pages lit
      // first: each its need when theirs fit beside the others' least,
      // the others the rest by need; when not, each what shows its lit
      // rows at least, the rest by need beyond that; when not even that,
      // in proportion to it)
      // (the related view: each page is its rows, by need alone)
      const lit = related ? [] : open.filter(need);
      const needs = open.map(needOf);
      const hs = !lit.length || needs.reduce((a, b) => a + b, 0) <= avail
        ? share(avail, needs, least)
        : (() => {
          const others = open.filter((v) => !need(v));
          const left = Math.max(0, Math.floor(avail - others.reduce(
            (a, v) => a + floor(v), 0)));
          const want = lit.map((v) => Math.ceil(needOf(v)));
          const keep = lit.map((v, k) => Math.min(want[k],
            Math.ceil(litWant(v))));
          const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
          let hl: number[];
          if (sum(want) <= left) hl = want;
          else if (sum(keep) <= left) {
            const over = left - sum(keep);
            const more = want.map((w, k) => w - keep[k]);
            const all = sum(more) || 1;
            hl = keep.map((x, k) => x + Math.floor(over * more[k] / all));
            let odd = left - sum(hl);
            for (let k = 0; odd > 0; k = (k + 1) % hl.length, odd--) hl[k]++;
          } else {
            // (each in proportion to what shows its lit rows: the nearest
            // to showing them all)
            const all = sum(keep) || 1;
            hl = keep.map((x) => Math.floor(left * x / all));
            let odd = left - sum(hl);
            for (let k = 0; odd > 0; k = (k + 1) % hl.length, odd--) hl[k]++;
          }
          // (the others: at least their least, edges and all)
          const lo = others.length ? least + edges(others[0]) : 0;
          const ho = share(Math.floor(avail) - sum(hl), others.map(needOf),
            lo);
          return open.map((v) => need(v) ? hl[lit.indexOf(v)]
            : ho[others.indexOf(v)]);
        })();
      // (a shut page joins the row of shut tabs once its height has gone:
      // debugger.css; one opening leaves it at once; on a phone the stack
      // too, its tab where the row's first is)
      for (const v of phone() && stack ? [...pages, stack] : pages) {
        if (next[loc(v)]) {
          if (v.dataset.row) delete v.dataset.row;
          rowAt.delete(v);
        } else if (!v.dataset.row && !rowAt.has(v)) {
          rowAt.set(v, setTimeout(() => {
            rowAt.delete(v);
            if (v.dataset.open === "false") v.dataset.row = "true";
          }, still() || !lens.hasAttribute("data-settled") ? 0 : 440));
        }
      }
      for (const v of group) {
        const b = box(v);
        const k = open.indexOf(v);
        const h = `${k < 0 ? 0 : Math.floor(hs[k])}px`;
        if (b && b.style.height !== h) {
          b.style.height = h;
          // (its lit rows into view for the height it moves to: Dump.tsx)
          v.dispatchEvent(new Event("ethdebug:fit"));
        }
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
        const h = group.includes(stack!) ? `${room - sh - between}px` : "";
        if (wide.style.height !== h) wide.style.height = h;
      }
      // (a phone's stack in the row: shut, no height; its tab where the
      // row keeps it a place)
      const sc = lens.querySelector<HTMLElement>(":scope > .stackcol");
      if (joined && stack) {
        const b = box(stack);
        if (b && b.style.height !== "0px") b.style.height = "0px";
      }
      if (sc) {
        let t = "";
        const tabEl = stack?.querySelector<HTMLElement>(".view-name");
        if (joined && slot && tabEl) {
          const prev = sc.style.transform;
          sc.style.transform = "";
          const a = tabEl.getBoundingClientRect();
          const z = slot.getBoundingClientRect();
          sc.style.transform = prev;
          t = `translate(${Math.round(z.left - a.left)}px, ${Math.round(
            z.top - a.top)}px)`;
        }
        if (sc.style.transform !== t) sc.style.transform = t;
      }
      // (the stack's tab in the row, at the area's bottom; and the room
      // for it kept in the row, its tab's width)
      const row = joined ? "end" : undefined;
      if (lens.dataset.stackRow !== row) {
        if (row) lens.dataset.stackRow = row;
        else delete lens.dataset.stackRow;
      }
      if (joined && stack) {
        const w = `${Math.ceil(stack.querySelector(".view-name")
          ?.getBoundingClientRect().width ?? 0)}px`;
        if (lens.style.getPropertyValue("--stack-tabw") !== w) {
          lens.style.setProperty("--stack-tabw", w);
        }
      }
    };
    fit();
    // (settled: no fit for a while since the figure first drew; from then
    // on, heights move: debugger.css)
    let calm: ReturnType<typeof setTimeout> | undefined;
    const settled = () => {
      clearTimeout(calm);
      if (!lens.hasAttribute("data-settled")) {
        calm = setTimeout(() => lens.setAttribute("data-settled", ""), 600);
      }
    };
    settled();
    const ro = new ResizeObserver(() => setTimeout(() => {
      fit();
      settled();
    }));
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
      subtree: true, attributes: true,
      attributeFilter: ["data-open", "data-needed", "data-lit",
        "data-related", "data-row", "data-next-row"] });
    // (and the lens's type size, fit.ts --cell-fs: its rows' height with it)
    mo.observe(lens, { attributes: true, attributeFilter: ["data-playing",
      "style"] });
    // (and the related view coming on or going off)
    let rel = store.get().related !== undefined;
    let walked = false;
    // (the pages as they are: their folds and scrolls)
    const now = () => {
      const views = [...lens.querySelectorAll<HTMLElement>(
        ".view[data-location][data-open]")];
      return { pages: Object.fromEntries(views.map((v) => [
        v.dataset.location!, v.dataset.open === "true"])),
      scroll: new Map(views.map((v) => [v.dataset.location!,
        v.querySelector(".rows")?.scrollTop ?? 0])),
      heights: new Map(views.map((v) => [v.dataset.location!,
        v.querySelector<HTMLElement>(".pagebox")?.style.height ?? ""])),
      byHand: new Set(byHand) };
    };
    // (as a walkthrough opens, before its steps scroll anything: what
    // the related view, if it comes on with it, puts back)
    let pre: Held | null = null;
    const unsub = store.subscribe(() => {
      const s = store.get();
      const w = Object.values(s.links).some((l) => !!l?.walk &&
        !l.walk.exit);
      if (w !== walked) {
        walked = w;
        pre = w && !rel ? now() : null;
      }
      const on = s.related !== undefined;
      if (on === rel) return;
      rel = on;
      // (as it comes on: the pages as they are, before their rows go)
      if (on && !held) held = pre ?? now();
      fit();
    });
    addEventListener("resize", fit);
    // (a page's padding or edge done moving: its edges, read again)
    const settledEdge = (e: TransitionEvent) => {
      if (/padding|border/.test(e.propertyName) &&
        (e.target as Element).classList?.contains("pagebox")) fit();
    };
    lens.addEventListener("transitionend", settledEdge);
    return () => {
      ro.disconnect();
      mo.disconnect();
      clearTimeout(settle);
      clearTimeout(calm);
      rowAt.forEach((t) => clearTimeout(t));
      unsub();
      removeEventListener("resize", fit);
      lens.removeEventListener("transitionend", settledEdge);
    };
  }, []);
  // (the slot in the row of shut tabs where a phone's shut stack's tab
  // stands: debugger.css, fit above)
  return <div ref={me} style={{ display: "contents" }}><Pages>
    {Children.toArray(children)}<div key="stackslot" className="stackslot"
      aria-hidden="true" /></Pages></div>;
}

const NOW = { decoding: "$scene", moment: "current" } as const;
// (a page's rows: every one the location has, as any dump's; which show
// is the related view's alone, a gap row between runs: ui/hooks.ts)
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
  areas: { wide: "dump pages", narrow: "stackcol", side: "sidecol",
    src: "srcrow" },
  wrap: { wide: Wide },
  views: [
    { id: "time", kind: "timeline", area: "moves", domId: "stime",
      bar: "moments" },
    // (the stack: a narrow column beside the others, its tab along its
    // edge, as the debugger's beside its dumps; a page on a phone)
    page("stack", "Stack", all, { area: "narrow", display: { ruler: false,
      abbreviate: 2 } } as Partial<ViewSpec>),
    page("calldata", "Calldata", all),
    page("memory", "Memory", all),
    page("storage", "Storage", all),
    { id: "walk", kind: "walkthrough", area: "side", link: "st",
      button: true,
      domId: "sdetails", data: NOW },
    { id: "vars", kind: "variables", area: "side", data: NOW, link: "st",
      domId: "svars", edges: true },
    { id: "instrs", kind: "instructions", area: "src", data: NOW },
    { id: "code", kind: "code", area: "src", data: NOW, domId: "scode",
      pane: true },
  ],
};
