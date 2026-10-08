// The calldata of the bookmark's call (one whose function takes one
// string parameter; Phase 1: setMotd), laid out like the storage dump:
// the selector, then 32-byte words by offset, with the parts the ABI
// gives (engine/calldata.ts). Its selection is its own: not a link
// group's, and storage's stays as it is (vanilla calldata.js).
import { useFitDump } from "./fit";
import {
  Fragment, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent,
  type ReactElement, type ReactNode,
} from "react";
import { abiParts, type Calldata as Cd } from "../engine/calldata";
import { useLens, useLensState, usePoint } from "./hooks";
import type { DataRef } from "./types";

const at = (n: number) => `0x${n.toString(16).padStart(4, "0")}`;
const M = ["m-offset", "m-length", "m-data"];
// the parts a key lights: one part, or "m", all of the parameter's
const ids = (k: string | null) => k === "m" ? M : k ? [k] : [];

function Octets({ cells }: { cells: ReactElement[] }) {
  return <>{[0, 8, 16, 24].map((k) =>
    <span key={k} className="oct">{cells.slice(k, k + 8)}</span>)}</>;
}

// one line: the selector's 4 bytes, or a word from `start`
function Line({ cd, start, n, zb, lit }: { cd: Cd; start: number;
  n: number; zb: boolean; lit: Set<string> }) {
  const cells = Array.from({ length: 32 }, (_, k) => {
    const i = start + k;
    if (k >= n) return <span key={k} className="b" />;
    const p = cd.partAt(i);
    const cls = ["b", p ? `t${cd.parts.indexOf(p)}` : "free"];
    if (!p || p.from === i) cls.push("gs");
    if (!p || p.to === i) cls.push("ge");
    if (cd.bytes[i] === "00") cls.push("z");
    if (p && lit.has(p.id)) cls.push("hl");
    return <span key={k} className={cls.join(" ")} data-i={i}
      data-part={p?.id} {...(p?.from === i ? { tabIndex: 0,
        role: "button", "aria-label": p.label } : {})}>{cd.bytes[i]}</span>;
  });
  const on = cells.some((c) => String(c.props.className).includes(" hl"));
  return <div className={`wrow${zb ? " zb" : ""}${on ? " on" : ""}`}
    data-at={start}>
    <span className="addr"><span className="a">{at(start)}</span></span>
    <div className="word"><div className="bytes"><Octets cells={cells} />
    </div></div></div>;
}

function Row({ id, name, type, value, k, chosen, children, top }: {
  id: string; name: string; type: string; value: string;
  k: string | null; chosen: string | null; children?: ReactNode;
  top?: boolean }) {
  const on = k !== null && (id === k || (k === "m" && M.includes(id)) ||
    (id === "m" && M.includes(k)));
  return <li className={top ? "top" : undefined} data-part={id}>
    <div className={["row", on ? "hl" : "", id === chosen ? "sel" : ""]
      .filter(Boolean).join(" ")} tabIndex={0} role="button"
      aria-pressed={id === chosen}>
      <span className="name">{name}</span>
      <span className="type">{type}</span>
      <span className="val"><span>{value}</span></span></div>
    {children}</li>;
}

export function Calldata({ data }: { data: DataRef }) {
  const { project } = useLens();
  const bm = useLensState((s) => project.bookmarks.find((b) =>
    b.id === s.bookmark));
  const point = usePoint(data);
  const input = bm?.calldata && point?.transaction?.input;
  const cd = useMemo(() => input && bm?.calldata
    ? abiParts(input, bm.calldata.param) : undefined, [input, bm]);
  const [state, setState] = useState<{ of?: string; hover: string | null;
    chosen: string | null }>({ hover: null, chosen: null });
  // (a new call: nothing chosen)
  const mine = state.of === input ? state : { hover: null, chosen: null };
  const set = (s: Partial<typeof state>) =>
    setState({ ...mine, ...s, of: input });
  const k = mine.hover ?? mine.chosen;
  const me = useRef<HTMLDivElement>(null);
  useFitDump(me, !!cd, cd?.bytes.length ?? 0);
  const lit = new Set(ids(k));
  if (cd) (window as unknown as { calldataResults: unknown })
    .calldataResults = { lit: [...lit], chosen: mine.chosen };
  if (!cd || !bm?.calldata) return <section id="calldata" hidden />;
  const { signature } = bm.calldata;
  const [sel, off, len, bytes] = cd.parts;

  // the part an element stands for: a byte, a tree row, a step
  const partOf = (el: Element) => {
    const c = el.closest?.<HTMLElement>(
      "#cpanel .b[data-part], #chow li[data-part]");
    if (c) return c.dataset.part!;
    const li = el.closest?.<HTMLElement>("#ctree li[data-part]");
    return li && el.closest(".row") ? li.dataset.part! : null;
  };
  // a click (or Enter) on a byte or a row selects its part; again, or
  // Escape, or a click elsewhere in it, clears it
  const act = (el: Element) => {
    const p = partOf(el);
    if (!p || el.closest("#chow")) return false;
    set({ chosen: mine.chosen === p ? null : p, hover: null });
    return true;
  };
  const over = (e: { target: EventTarget }) => {
    const p = partOf(e.target as Element);
    if (p !== mine.hover) set({ hover: p });
  };
  const click = (e: MouseEvent) => {
    const t = e.target as Element;
    if (!act(t) && !t.closest("#chow, #cdetails") && mine.chosen) {
      set({ chosen: null });
    }
  };
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape" && mine.chosen) set({ chosen: null });
    else if ((e.key === "Enter" || e.key === " ") &&
      act(e.target as Element)) e.preventDefault();
  };

  const lines = [<Line key={0} cd={cd} start={0} n={4} zb={false}
    lit={lit} />];
  for (let s = 4, j = 1; s < cd.bytes.length; s += 32, j++) {
    lines.push(<Line key={s} cd={cd} start={s} zb={j % 2 === 1} lit={lit}
      n={Math.min(32, cd.bytes.length - s)} />);
  }
  const p = cd.parts.find((x) => x.id === k);
  const info: [string, ReactNode][] | null = k === "m"
    ? [["Value", <><code>{cd.param}</code> (string calldata)</>],
      ["Where", cd.parts.slice(1).map((x) =>
        `${x.label}: bytes ${at(x.from)}–${at(x.to)}`).join("; ")],
      ["Holds", bytes.value]]
    : p ? [["Value", <code>{p.label}</code>],
      ["Where", `bytes ${at(p.from)}–${at(p.to)}`], ["Holds", p.value]]
    : null;
  const step = (id: string, kk: string, html: ReactNode) =>
    <li key={id} data-part={id} tabIndex={0}
      className={lit.has(id) ? "hl" : undefined}>
      <span className="k">{kk}</span><div className="c">{html}</div></li>;
  const fn = signature.replace(/\(.*/, "");
  return <section id="calldata" className="calldata"
    aria-labelledby="cd-h" data-scoped="" onPointerOver={over}
    onFocus={over} onPointerLeave={() => mine.hover && set({ hover: null })}
    onClick={click} onKeyDown={key}>
    <h2 className="label" id="cd-h">The calldata of {fn}</h2>
    <p className="muted small lede"><code>{cd.param}</code> is
      a <code>string calldata</code> parameter: its bytes stay in the
      transaction's input. solc's ethdebug output here gives no pointer
      for <code>{cd.param}</code> (its instructions carry source ranges
      only, and its resources have no calldata types or templates), so
      the labels below come from the ABI encoding rules, which the page
      applies itself; nothing here comes from @ethdebug/pointers. Click a
      byte to find its part of <code>{cd.param}</code>, or a part to find
      its bytes.</p>
    <div className="dump"><div ref={me} id="cpanel" className={`panel${lit.size
      ? " active" : ""}`}><div className="views"><div className="view"
      data-side="after" role="group" aria-label="Calldata">
      <div className="view-head"><span className="view-name">Calldata</span>
        <div className="wrow head"><span className="addr" />
          <div className="ruler" aria-hidden="true"><div className="bytes">
            <Octets cells={Array.from({ length: 32 }, (_, i) =>
              <span key={i} className="b">{i % 8 === 0 ? i : ""}</span>)} />
          </div></div></div></div>
      <div className="rows">{lines}</div></div></div></div></div>
    <div id="cdetails" className="details" aria-live="polite">
      {info ? <dl>{info.map(([t, d]) => <Fragment key={t}><dt>{t}</dt>
        <dd>{d}</dd></Fragment>)}</dl>
        : <p className="muted">Point at a part or a byte for its
          details.</p>}</div>
    <div className="cparts">
      <div><h3 className="label">Parameters</h3>
        <div id="ctree" className={`tree${lit.size ? " active" : ""}`}><ul>
          <Row top id="selector" name="selector" type="bytes4"
            value={sel.value} k={k} chosen={mine.chosen} />
          <Row top id="m" name={cd.param} type="string calldata"
            value={bytes.value} k={k} chosen={mine.chosen}><ul>
            <Row id="m-offset" name="offset" type="uint256"
              value={off.value} k={k} chosen={mine.chosen} />
            <Row id="m-length" name="length" type="uint256"
              value={len.value} k={k} chosen={mine.chosen} />
            <Row id="m-data" name="bytes" type="bytes"
              value={bytes.value} k={k} chosen={mine.chosen} />
          </ul></Row></ul></div></div>
      <div><h3 className="label" id="chow-h">How this was found</h3>
        <div id="chow" className="how">
          <p className="howside">By the ABI encoding
            of <code>{signature}</code>, not by ethdebug.</p>
          <ol className="steps">
            {step("selector", "Selector", <>bytes 0–3: <b>{sel.value}</b>,
              the first 4 bytes of keccak256("{signature}")</>)}
            {step("m-offset", "Head", <><code>{cd.param}</code> is the
              first argument, so its head word is at {at(4)}. A string is
              dynamic: the word holds the offset of its data, counted from
              byte 4: <b>{cd.offset}</b></>)}
            {step("m-length", "Length", <>at 4 + {cd.offset} ={" "}
              {at(cd.lenAt)}: the length, <b>{cd.length}</b> bytes</>)}
            {step("m-data", "Bytes", <>at {at(cd.dataAt)}: {cd.length}{" "}
              bytes, padded with zeros to a whole word →{" "}
              <b>{bytes.value}</b></>)}
          </ol></div></div>
    </div>
  </section>;
}
