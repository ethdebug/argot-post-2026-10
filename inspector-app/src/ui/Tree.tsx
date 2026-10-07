// The values as a tree (vanilla main.js row, renderTree, setOpen,
// expandTo, treeTo, edges; panel.js paint for rows): a row a value, its
// type and its value; groups collapse by their chevron; linked to the
// dumps. A run of lit rows in one colour is one block (li.blk).
import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  collapsed: ReadonlySet<string>; pair?: [Decoded, Decoded] }

// a row's colour when lit (0: the selection's yellow)
const colourOf = (c: Ctx, n: ValueNode) => c.light.colours.get(n.path) ?? 0;
const mutedRow = (c: Ctx, n: ValueNode) => {
  const k = colourOf(c, n);
  return c.light.focus !== undefined && !!k && k !== c.light.focus;
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
  </li>;
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
  const lens = useLens();
  const comp = useCompilation(p.data);
  const lang = comp?.language ?? "";
  // (a pair: before, after)
  const pair: [Decoded, Decoded] | undefined = p.compare && d && o
    ? (side === "before" ? [d, o] : [o, d]) : undefined;
  const c: Ctx = { light, selection: link.selection, pair,
    collapsed: view.collapsed };
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
  const toggle = (path: string) => setView((v) => {
    const next = new Set(v.collapsed);
    if (!next.delete(path)) next.add(path);
    return { ...v, collapsed: next };
  });
  // a row selects its value (its block, by pointer), or, when it is the
  // selected one, clears
  const act = (el: EventTarget, keys = false) => {
    const at = rowOf(el);
    if (!at) return;
    const path = keys ? at : blockOf(at, link.selection);
    setLink((s) => ({ ...s, hover: null,
      selection: path === s.selection ? null : path }));
  };
  const onClick = (e: MouseEvent) => {
    const chev = (e.target as Element).closest?.("li[data-path] > .chev");
    if (chev) {
      toggle((chev.parentElement as HTMLElement).dataset.path!);
      return;
    }
    act(e.target);
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
