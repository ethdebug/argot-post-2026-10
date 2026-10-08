// The values as a tree (vanilla main.js row, renderTree, setOpen,
// expandTo, treeTo, edges; panel.js paint for rows): a row a value, its
// type and its value; groups collapse by their chevron; linked to the
// dumps. A run of lit rows in one colour is one block (li.blk).
import {
  useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { Colour, Decoded, Filter, Light, ValueNode } from
  "../engine/types";
import { changed } from "../engine/timeline";
import { blockOf } from "../engine/target";
import {
  useCompilation, useDecoded, useLens, useLensState, useLight, useLink,
  useView,
} from "./hooks";
import type { DataRef, LinkId, ViewId } from "./types";

// a chevron, pointing down (open); CSS turns it right when closed
const CHEV = <svg viewBox="0 0 16 16" aria-hidden="true"><path
  d="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor"
  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const ARROW = (d: string) => <svg viewBox="0 0 16 16" aria-hidden="true">
  <path d={d} fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" /></svg>;

// a path in a quoted attribute selector
const esc = (p: string) => p.replace(/["\\]/g, "\\$&");
const pk = (k: Colour | undefined) => k === "src" ? "pksrc"
  : k ? `pk${k}` : "";

interface Ctx { light: Light; selection: string | null;
  collapsed: ReadonlySet<string>; pair?: [Decoded, Decoded];
  card?: { path: string; side: string; node: ReactNode } }

// a row's colour when lit (0: the selection's yellow)
const colourOf = (c: Ctx, n: ValueNode) => c.light.colours.get(n.path) ?? 0;
const mutedRow = (c: Ctx, n: ValueNode) => {
  const k = colourOf(c, n);
  return (c.light.focus !== undefined && !!k && k !== c.light.focus) ||
    !!c.light.dimRows?.has(n.path);
};
// the colours of a group's lit rows (itself and all under it)
function litColours(c: Ctx, n: ValueNode, out = new Set<Colour>()) {
  if (c.light.rows.has(n.path)) out.add(colourOf(c, n));
  n.children?.forEach((x) => litColours(c, x, out));
  return out;
}
const hasSel = (n: ValueNode, sel: string | null): boolean =>
  n.path === sel || !!n.children?.some((x) => hasSel(x, sel));

function Row({ n, top, c, inBlk }: { n: ValueNode; top?: boolean; c: Ctx;
  inBlk?: boolean }) {
  const { light, selection, pair } = c;
  const on = light.rows.has(n.path);
  const k = on ? colourOf(c, n) : undefined;
  // an array's length is its value (vanilla); a group's summary
  const own = n.summary !== undefined &&
    n.regions.some((r) => r.role === "length");
  const sel = n.path === selection;
  const group = !!n.children?.length;
  const shut = group && c.collapsed.has(n.path);
  // the outermost lit group whose lit rows share one colour carries the
  // fill (not one holding the selected row, nor a collapsed one)
  const ks = on && group && !inBlk && !shut && !hasSel(n, selection)
    ? litColours(c, n) : undefined;
  const blk = !!ks && ks.size === 1;
  const blkK = blk ? [...ks!][0] : undefined;
  const cls = ["row", sel ? "sel" : "", on ? "hl" : "", on ? pk(k) : "",
    on && mutedRow(c, n) ? "muted" : ""].filter(Boolean).join(" ");
  const chg = pair && changed(pair[0], pair[1], n.path);
  const valueChg = pair && pair[0].byPath.get(n.path)?.value?.text !==
    pair[1].byPath.get(n.path)?.value?.text;
  const li = [pair ? (chg ? "chg" : "same") : "", top ? "top" : "",
    shut ? "collapsed" : "", blk ? "blk" : "", blk ? pk(blkK) : "",
    blk && mutedRow(c, n) ? "muted" : ""].filter(Boolean).join(" ");
  // (the other state's card: under the row and its members in Before,
  // over the row in After)
  const card = c.card?.path === n.path ? c.card : undefined;
  return <li className={li || undefined} data-path={n.path}>
    <div className={cls} tabIndex={0} role="button"
      aria-pressed={sel ? "true" : "false"}>
      <span className="name">{n.label}</span>
      <span className="type">{n.typeText}</span>
      {n.value || own ? <span className={`val${!pair ? ""
        : valueChg || (own && chg) ? " chg" : " same"}`}>
        <span>{n.value?.text ?? n.summary}</span></span>
        : group ? <span className="val sum">{n.summary}</span>
          : n.note ? <span className="muted">{n.note}</span> : null}
      {card?.side === "after" && card.node}
    </div>
    {group && <button type="button" className="chev" tabIndex={0}
      aria-expanded={shut ? "false" : "true"}
      aria-label={`${shut ? "Expand" : "Collapse"} ${n.label}`}>
      {CHEV}</button>}
    {group ? <ul>{n.children!.map((x) => <Row key={x.path} n={x} c={c}
      inBlk={inBlk || blk} />)}</ul>
      : n.children && !n.value && !own
        ? <p className="muted empty">no keys hashed in this transaction</p>
        : null}
    {card?.side === "before" && card.node}
  </li>;
}

// While a value is lit, a card by its row gives its value in the other
// state (vanilla main.js treeCard): only where it differs; for a parent,
// its changed members (at most 4, then "+N more")
function treeCard(path: string | null, pair: [Decoded, Decoded],
  side: string): Ctx["card"] {
  if (!path) return undefined;
  const [b, a] = pair;
  const text = (d: Decoded, q: string) => {
    const n = d.byPath.get(q);
    return n?.value?.text ?? (n?.children && n.regions.some((r) =>
      r.role === "length") ? n.summary : undefined);
  };
  const shown = side === "before" ? a : b;
  const node = shown.byPath.get(path) ?? (side === "before" ? b : a)
    .byPath.get(path);
  if (!node) return undefined;
  const changed: string[] = [];
  const visit = (q: string) => {
    const [x, y] = [text(b, q), text(a, q)];
    if ((x !== undefined || y !== undefined) && x !== y) changed.push(q);
    const kids = new Set([...(b.byPath.get(q)?.children ?? []),
      ...(a.byPath.get(q)?.children ?? [])].map((k) => k.path));
    kids.forEach(visit);
  };
  visit(path);
  if (!changed.length) return undefined;
  const other = side === "before" ? "after" : "before";
  const val = (q: string) => {
    const t = text(side === "before" ? a : b, q);
    return t === undefined ? <i>none</i> : t;
  };
  const own = changed[0] === path;
  return { path, side, node: <div className={`tcard ${side}`}
    aria-hidden="true"><span className="cmp-tag">{other}</span>
    {own ? <span className="tval">{val(path)}</span>
      : <>{changed.slice(0, 4).map((q) => <span key={q} className="tval">
        <b>{q.slice(path.length).replace(/^\./, "")}</b> {val(q)}</span>)}
      {changed.length > 4 && <span className="tval muted">+{
        changed.length - 4} more</span>}</>}</div> };
}

export function Tree(p: { id: ViewId; data: DataRef; filter?: Filter;
  link?: LinkId; domId?: string; variant?: "tree" | "table";
  compare?: DataRef }) {
  const d = useDecoded(p.data);
  const o = useDecoded(p.compare);
  const light = useLight(p.id);
  const [link, setLink] = useLink(p.link);
  const [view, setView] = useView(p.id);
  const side = useLensState((s) => s.side ?? "after");
  const box = useRef<HTMLDivElement>(null);
  // (groups closing: drawn open while their members shrink)
  const [closing, setClosing] = useState<ReadonlySet<string>>(new Set());
  const lens = useLens();
  const comp = useCompilation(p.data);
  const lang = comp?.language ?? "";
  // (a pair: before, after)
  const pair: [Decoded, Decoded] | undefined = p.compare && d && o
    ? (side === "before" ? [d, o] : [o, d]) : undefined;
  const insets = useLensState((s) => s.insets);
  const lit = link.selection && d?.byPath.has(link.selection)
    ? link.selection : link.hover?.path ?? [...light.rows][0] ?? null;
  const c: Ctx = { light, selection: link.selection, pair,
    collapsed: new Set([...view.collapsed].filter((q) => !closing.has(q))),
    card: pair && insets && light.muted ? treeCard(lit, pair, side)
      : undefined };
  // only the filter's roots, and the groups that hold them
  const roots = p.filter?.roots;
  const keep = (n: ValueNode): ValueNode | null => {
    if (!roots || roots.some((r) => n.path === r ||
      n.path.startsWith(r + ".") || n.path.startsWith(r + "["))) return n;
    const kids = (n.children ?? []).map(keep).filter(Boolean) as
      ValueNode[];
    return kids.length ? { ...n, children: kids } : null;
  };
  const shown = d?.tree.map(keep).filter(Boolean) as ValueNode[]
    | undefined;

  const rowOf = (el: EventTarget) => {
    // (a group's chevron is part of its row, for pointing)
    const e = (el as Element).closest?.("li[data-path] > .row, " +
      "li[data-path] > .chev");
    return (e?.parentElement as HTMLElement | undefined)?.dataset.path
      ?? null;
  };
  const point = (e: PointerEvent | { target: EventTarget }) => {
    const at = rowOf(e.target);
    const path = at && blockOf(at, link.selection);
    setLink((s) => s.hover?.path === path && !s.hover?.bytes &&
      (path || !s.hover) ? s : { ...s, hover: path ? { path } : null });
  };
  // Open or close a group: a deliberate action, so the tree may change
  // (a quick height animation, 180 ms; at once with reduced motion). The
  // dump does not move.
  // (the state changes at once; a closing group stays drawn open while
  // its members shrink; a click meanwhile turns it round)
  const opened = useRef<string | null>(null);
  const toggle = (path: string) => {
    const open = view.collapsed.has(path);
    setView((v) => {
      const next = new Set(v.collapsed);
      if (open) next.delete(path);
      else next.add(path);
      return { ...v, collapsed: next };
    });
    const ul = box.current?.querySelector<HTMLElement>(
      `li[data-path="${esc(path)}"] > ul`);
    ul?.getAnimations?.().forEach((a) => a.cancel());
    if (ul) ul.style.overflow = "";
    const still = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const done = () => setClosing((c) => {
      if (!c.has(path)) return c;
      const n = new Set(c);
      n.delete(path);
      return n;
    });
    if (!ul || still || !ul.animate) return done();
    if (open) {
      done();
      opened.current = path;
      return;
    }
    setClosing((c) => new Set([...c, path]));
    const h = ul.scrollHeight;
    ul.style.overflow = "hidden";
    const a = ul.animate([{ height: `${h}px` }, { height: "0px" }],
      { duration: 180, easing: "ease-in" });
    a.finished.then(() => {
      ul.style.overflow = "";
      done();
    }, () => {});
  };
  // (a group just opened: its members grow in)
  useLayoutEffect(() => {
    const path = opened.current;
    opened.current = null;
    const ul = path && box.current?.querySelector<HTMLElement>(
      `li[data-path="${esc(path)}"] > ul`);
    if (!ul || !ul.animate) return;
    const h = ul.scrollHeight;
    ul.style.overflow = "hidden";
    ul.animate([{ height: "0px" }, { height: `${h}px` }],
      { duration: 180, easing: "ease-out" }).finished.then(() => {
      ul.style.overflow = "";
    });
  }, [view.collapsed]);
  // a row selects its value (its block, by pointer), or, when it is the
  // selected one, clears
  const act = (el: EventTarget, keys = false) => {
    const at = rowOf(el);
    if (!at) return false;
    const path = keys ? at : blockOf(at, link.selection);
    // (a click that clears: what is under the pointer gets its hover at
    // once, with no mouse move: vanilla rehover)
    setLink((s) => path === s.selection
      ? { ...s, selection: null, hover: { path: at } }
      : { ...s, hover: null, selection: path });
    return true;
  };
  const onClick = (e: MouseEvent) => {
    const chev = (e.target as Element).closest?.("li[data-path] > .chev");
    if (chev) {
      toggle((chev.parentElement as HTMLElement).dataset.path!);
      return;
    }
    if (act(e.target)) (e.nativeEvent as { acted?: boolean }).acted = true;
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if ((e.target as Element).closest?.(".chev")) return;
    if ((e.target as Element).closest?.("li[data-path] > .row")) {
      e.preventDefault();
      act(e.target, true);
    }
  };

  // a new selection opens the groups it is in, and the tree (inside its
  // box only) scrolls to it
  const sel = link.selection;
  useEffect(() => {
    if (!sel) return;
    setView((v) => {
      const shut = [...v.collapsed].filter((q) => sel !== q &&
        (sel.startsWith(q + ".") || sel.startsWith(q + "[")));
      if (!shut.length) return v;
      return { ...v, collapsed: new Set([...v.collapsed]
        .filter((q) => !shut.includes(q))) };
    });
  }, [sel, setView]);
  useLayoutEffect(() => {
    const tree = box.current;
    const row = sel && tree?.querySelector(`li[data-path="${
      esc(sel)}"] > .row`);
    if (!tree || !row || tree.scrollHeight <= tree.clientHeight) return;
    const r = row.getBoundingClientRect();
    const b = tree.getBoundingClientRect();
    if (r.top < b.top || r.bottom > b.bottom) {
      tree.scrollTop += r.top - b.top - (b.height - r.height) / 2;
    }
  }, [sel, d]);

  // The tree's box and the dump start at one height: its first row at
  // the height of the dump's first line (the dump has its byte ruler
  // above); on a wide page, as tall as the dump, scrolling inside itself
  // (vanilla main.js alignColumns)
  useLayoutEffect(() => {
    const tree = box.current;
    if (!tree) return;
    const align = () => {
      const dump = [...document.querySelectorAll<HTMLElement>(
        `.view[data-view^="${lens.key}:"]:not([hidden])`)][0];
      const d = dump?.querySelector(".rows > *");
      const t = tree.querySelector("li .row");
      if (!dump || !d || !t) return;
      tree.style.paddingTop = "";
      const col = (e: Element, c: string) => e.closest(c) ??
        e.closest("[data-area]") ?? document.body;
      const top = (e: Element, c: string) => e.getBoundingClientRect().top -
        col(e, c).getBoundingClientRect().top;
      const now = parseFloat(getComputedStyle(tree).paddingTop) || 0;
      const delta = top(d, ".words") - top(t, ".storage");
      tree.style.paddingTop = `${Math.max(0, now + delta)}px`;
      const box2 = dump.closest(".dump") ?? dump;
      const db = box2.getBoundingClientRect();
      const tb = tree.getBoundingClientRect();
      tree.style.height = innerWidth >= 1100
        ? `${Math.max(100, db.bottom - tb.top)}px` : "";
    };
    align();
    // (again once the dump's rows and the page's fonts are in)
    const later = requestAnimationFrame(align);
    let live = true;
    document.fonts?.ready.then(() => live && align());
    addEventListener("resize", align);
    return () => {
      live = false;
      cancelAnimationFrame(later);
      removeEventListener("resize", align);
    };
    // (when the tree is drawn anew, as vanilla's renderTree, and on resize)
  }, [d, side, lens.key]);

  // lit rows out of the box's view: a yellow circle button on the edge
  // past which they are (an overlay; a click scrolls to the first)
  const [past, setPast] = useState<{ up: string[]; down: string[] }>(
    { up: [], down: [] });
  useLayoutEffect(() => {
    const tree = box.current;
    if (!tree) return;
    const measure = () => {
      const b = tree.getBoundingClientRect();
      const rows = [...tree.querySelectorAll<HTMLElement>(
        "li[data-path] > .row.hl")].filter((r) => r.offsetParent);
      const path = (r: HTMLElement) => r.parentElement!.dataset.path!;
      const up = rows.filter((r) => r.getBoundingClientRect().bottom <=
        b.top + 1).map(path).reverse();
      const down = rows.filter((r) => r.getBoundingClientRect().top >=
        b.bottom - 1).map(path);
      setPast((x) => x.up.join() === up.join() &&
        x.down.join() === down.join() ? x : { up, down });
    };
    measure();
    tree.addEventListener("scroll", measure);
    addEventListener("resize", measure);
    return () => {
      tree.removeEventListener("scroll", measure);
      removeEventListener("resize", measure);
    };
  });
  const go = (path: string) => {
    const tree = box.current!;
    const r = tree.querySelector(`li[data-path="${esc(path)}"] > .row`)
      ?.getBoundingClientRect();
    if (!r) return;
    const b = tree.getBoundingClientRect();
    const still = matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    tree.scrollTo({ top: tree.scrollTop + r.top - b.top - (b.height -
      r.height) / 2, behavior: still ? "auto" : "smooth" });
  };
  const edge = (way: "up" | "down") => {
    const list = past[way];
    const on = list.length > 0;
    return <button type="button" id={p.domId ? `edge-${way}` : undefined}
      className={`tedge ${way}${on ? " on" : ""}`}
      tabIndex={on && link.selection && !link.hover ? 0 : -1}
      aria-hidden={on ? "false" : "true"}
      aria-label={on ? `Scroll the variables ${way} to ${list[0]}${
        list.length > 1 ? `, and ${list.length - 1} more lit rows` : ""}`
        : undefined}
      data-path={on ? list[0] : undefined}
      onClick={() => on && go(list[0])}>
      {on && ARROW(way === "up" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4")}
    </button>;
  };

  return <>
    <div ref={box} id={p.domId}
      className={`tree${light.muted ? " active" : ""}`}
      data-view={`${lens.key}:${p.id}`}
      onPointerOver={point} onFocus={point}
      onClick={onClick} onKeyDown={onKey}>
      {comp?.provenance === "hand-written" && <p className="handmade">
        written by hand, not from {lang[0]?.toUpperCase() + lang.slice(1)}
      </p>}
      {shown ? <ul>{shown.map((n) => <Row key={n.path} n={n} top c={c} />)}
      </ul> : <div className="skel" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>}
    </div>
    {edge("up")}{edge("down")}
  </>;
}
