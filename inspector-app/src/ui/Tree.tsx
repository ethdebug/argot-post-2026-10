// The values as a tree (vanilla main.js row, renderTree; panel.js paint
// for rows): a row a value, its type and its value; linked to the dumps
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { Decoded, Filter, Light, ValueNode } from "../engine/types";
import { changed } from "../engine/timeline";
import { useDecoded, useLensState, useLight, useLink } from "./hooks";
import type { DataRef, LinkId, ViewId } from "./types";

// `pair`: the other side's decoding and this side's, when the lens
// shows a pair (a value changed, or did not)
function Row({ n, top, light, selection, pair }: { n: ValueNode;
  top?: boolean; light: Light; selection: string | null;
  pair?: [Decoded, Decoded] }) {
  const on = light.rows.has(n.path);
  // an array's length is its value (vanilla); a group's summary
  const own = n.summary !== undefined &&
    n.regions.some((r) => r.role === "length");
  const sel = n.path === selection;
  const cls = ["row", sel ? "sel" : "", on ? "hl" : ""]
    .filter(Boolean).join(" ");
  const chg = pair && changed(pair[0], pair[1], n.path);
  const valueChg = pair && pair[0].byPath.get(n.path)?.value?.text !==
    pair[1].byPath.get(n.path)?.value?.text;
  const li = [pair ? (chg ? "chg" : "same") : "", top ? "top" : ""]
    .filter(Boolean).join(" ");
  return <li className={li || undefined} data-path={n.path}>
    <div className={cls} tabIndex={0} role="button"
      aria-pressed={sel ? "true" : "false"}>
      <span className="name">{n.label}</span>
      <span className="type">{n.typeText}</span>
      {n.value || own ? <span className={`val${!pair ? ""
        : valueChg || (own && chg) ? " chg" : " same"}`}>
        <span>{n.value?.text ?? n.summary}</span></span>
        : n.children?.length ? <span className="val sum">{n.summary}</span>
          : n.note ? <span className="muted">{n.note}</span> : null}
    </div>
    {n.children?.length ? <ul>{n.children.map((c) => <Row key={c.path}
      n={c} light={light} selection={selection} pair={pair} />)}</ul>
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
  const side = useLensState((s) => s.side ?? "after");
  // (a pair: before, after)
  const pair: [Decoded, Decoded] | undefined = p.compare && d && o
    ? (side === "before" ? [d, o] : [o, d]) : undefined;
  const rowOf = (el: EventTarget) =>
    ((el as Element).closest?.("li[data-path] > .row")
      ?.parentElement as HTMLElement | undefined)?.dataset.path ?? null;
  const point = (e: PointerEvent | { target: EventTarget }) => {
    const path = rowOf(e.target);
    setLink((s) => s.hover?.path === path && (path || !s.hover) ? s
      : { ...s, hover: path ? { path } : null });
  };
  // a row selects its value, or, when it is the selected one, clears
  const act = (el: EventTarget) => {
    const path = rowOf(el);
    if (!path) return;
    setLink((s) => ({ ...s, hover: null,
      selection: path === s.selection ? null : path }));
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && rowOf(e.target)) {
      e.preventDefault();
      act(e.target);
    }
  };
  const lit = light.muted; // something is lit: the rest steps back
  return <div id={p.domId} className={`tree${lit ? " active" : ""}`}
    onPointerOver={point} onFocus={point}
    onPointerLeave={() => setLink((s) => s.hover ? { ...s, hover: null } : s)}
    onClick={(e: MouseEvent) => act(e.target)} onKeyDown={onKey}>
    {d ? <ul>{d.tree.map((n) => <Row key={n.path} n={n} top light={light}
      selection={link.selection} pair={pair} />)}</ul>
      : <div className="skel" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>}
  </div>;
}
