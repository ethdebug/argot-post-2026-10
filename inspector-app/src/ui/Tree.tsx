// The values as a tree (vanilla main.js row, renderTree; panel.js paint
// for rows): a row a value, its type and its value; linked to the dumps
import type { KeyboardEvent, MouseEvent, PointerEvent } from "react";
import type { Filter, Light, ValueNode } from "../engine/types";
import { useDecoded, useLensState, useLight, useLink } from "./hooks";
import type { DataRef, LinkId, ViewId } from "./types";

function Row({ n, top, light, selection, single, side }: { n: ValueNode;
  top?: boolean; light: Light; selection: string | null; single: boolean;
  side: string }) {
  const on = light.rows.has(n.path);
  const sel = n.path === selection;
  const cls = ["row", sel ? "sel" : "", on ? "hl" : ""]
    .filter(Boolean).join(" ");
  return <li className={top ? "top" : undefined} data-path={n.path}>
    <div className={cls} tabIndex={0} role="button"
      aria-pressed={sel ? "true" : "false"}>
      <span className="name">{n.label}</span>
      <span className="type">{n.typeText}</span>
      {n.value ? <span className={`val${single ? "" : " same"}`}>
        <span>{n.value.text}</span></span>
        : n.note ? <span className="muted">{n.note}</span> : null}
    </div>
    {n.children?.length ? <ul>{n.children.map((c) => <Row key={c.path}
      n={c} light={light} selection={selection} single={single}
      side={side} />)}</ul> : null}
  </li>;
}

export function Tree(p: { id: ViewId; data: DataRef; filter?: Filter;
  link?: LinkId; domId?: string; variant?: "tree" | "table" }) {
  const d = useDecoded(p.data);
  const light = useLight(p.id);
  const [link, setLink] = useLink(p.link);
  const single = useLensState((s) => s.points.a === s.points.b);
  const side = useLensState((s) => s.side ?? "after");
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
      selection={link.selection} single={single} side={side} />)}</ul>
      : <div className="skel" aria-hidden="true">
        {Array.from({ length: 8 }, (_, i) => <i key={i} />)}</div>}
  </div>;
}
