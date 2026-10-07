// The bar over both columns and the details under it, as one unit
// (vanilla main.js renderBox, show; index.html #details, #dwrap). At
// rest (this task): the selection and "▸ Show how it was found"; with
// nothing selected, the details of what is pointed at. Every part keeps
// its slot, used or empty: nothing moves when a value is selected.
// The walkthrough itself comes in M4.
import { Fragment, type ReactNode } from "react";
import type { Decoded } from "../engine/types";
import { locked } from "../engine/target";
import {
  useDecoded, useLayout, useLensState, useLink, usePoint, useViewSpec,
} from "./hooks";
import { infoOf, whereOf, type Info, type Part, type Sides } from "./info";
import type { DataRef, LinkId, ViewId } from "./types";

const PROBE = "Point at a value or a byte for its details.";
const short = (h: string, keep = 4) => {
  const s = "0x" + (h.replace(/^0x0*/, "") || "0");
  return s.length <= keep * 2 + 4 ? s
    : `${s.slice(0, keep + 2)}…${s.slice(-keep)}`;
};
const shortKeys = (path: string) =>
  path.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`);
const partsWord = (typeText: string, n: number) =>
  (typeText.startsWith("mapping(") ? ["entry", "entries"]
    : /\[\d*\]$/.test(typeText) ? ["item", "items"]
      : typeText ? ["field", "fields"] : ["part", "parts"])[n === 1 ? 0 : 1];

const parts = (ps: Part[]) => ps.map((p, k) => typeof p === "string"
  ? <Fragment key={k}>{p}</Fragment> : <code key={k}>{p.code}</code>);

function Details({ info }: { info: Info | null }) {
  if (!info) return <p className="muted">{PROBE}</p>;
  return <dl>{info.map(([t, d]) => <Fragment key={t}>
    <dt>{t}</dt><dd>{parts(d)}</dd></Fragment>)}</dl>;
}

// "no such value (roster has 2 items)"
function missing(d: Decoded, path: string) {
  const parent = d.byPath.get(path.replace(/(\.[^.[\]]+|\[[^\]]*\])$/, ""));
  const len = parent?.summary?.match(/^length (\d+)$/)?.[1];
  return `no such value${len !== undefined ? ` (${parent!.label} has ${len
    } item${len === "1" ? "" : "s"})` : ""}`;
}

export function WalkthroughPanel(p: { id: ViewId; data: DataRef;
  link?: LinkId; domId?: string; compare?: DataRef }) {
  const { d, l } = useLayout(p.id);
  const o = useDecoded(p.compare);
  const here = usePoint(p.data);
  const there = usePoint(p.compare);
  const [link] = useLink(p.link);
  const side = useLensState((s) => s.side ?? "after");
  const single = !p.compare;
  useViewSpec(p.id);
  const sides: Sides | undefined = d && l ? { d, l, snap: here?.snapshot,
    ...(o ? { pair: side === "before"
      ? { before: { d, snap: here?.snapshot },
        after: { d: o, snap: there?.snapshot } }
      : { before: { d: o, snap: there?.snapshot },
        after: { d, snap: here?.snapshot } } } : {}) } : undefined;
  const sel = link.selection && d?.byPath.has(link.selection)
    ? link.selection : null;
  const node = sel ? d!.byPath.get(sel) : undefined;

  let bar: ReactNode;
  let text: ReactNode;
  if (!node || !sides) {
    bar = <><span className="rmode" /><span className="rsel muted">Select a
      value to see how it was found.</span><span className="rctl" />
      <span className="rcount" /><span className="rshort" />
      <span className="rexit" /></>;
    // (what is pointed at, while nothing is selected)
    const t = sides && locked(link.hover, null, sides.d.byPath);
    text = <Details info={sides ? infoOf(sides, t ?? null) : null} />;
  } else {
    const own = node.children && node.regions.some((r) =>
      r.role === "length");
    const v = node.value?.text ?? (own ? node.summary : undefined);
    const n = node.children?.length ?? 0;
    const otherText = o?.byPath.get(node.path)?.value?.text;
    bar = <><span className="rmode" /><span className="rsel"><code>{
      shortKeys(sel!)}</code>{node.typeText && <> <span className="type">{
      node.typeText}</span></>}{v !== undefined ? <> = <b>{v}</b></>
      : node.children ? <> <span className="muted">{n} {partsWord(
        node.typeText, n)}</span></> : null}{!single && <> <span
        className="muted">({side})</span></>}</span>
      <span className="rctl"><button type="button" className="btn rstart"
        data-r="start">▸ Show how it was found</button></span>
      <span className="rcount" /><span className="rshort" />
      <span className="rexit" /></>;
    text = <>{v !== undefined ? <p className="rcap rwhere">{parts(whereOf(
      sides, sel!))}{otherText !== undefined && otherText !== v &&
      <> <span className="muted">({side === "after" ? "before" : "after"
      }: {otherText})</span></>}</p>
      : <p className="rcap rwhere">{node.children ? `${n} ${partsWord(
        node.typeText, n)}` : missing(d!, sel!)}</p>}
      <p className="fnotes"><span className="muted">Each step is one part
        of the pointer solc wrote for {sel!.split(/[.[]/)[0]}.</span></p></>;
  }
  return <>
    <div id={p.domId} className="rbar" aria-live="polite" tabIndex={0}
      aria-label="The selected value; how it was found">{bar}</div>
    <div id={p.domId ? "dwrap" : undefined} className="dwrap">
      <div id={p.domId ? "dpanel" : undefined} className="dpanel" hidden>
        <div className="dleft">
          <div id={p.domId ? "dtext" : undefined} className="dtext">{text}
          </div>
          <div id={p.domId ? "dpick" : undefined} className="dpick" />
          <div id={p.domId ? "chips" : undefined} className="chips" />
        </div>
        <div className="ptr" aria-label="The pointer solc wrote">
          <p className="plabel">The pointer solc wrote <span
            className="pnote">(as YAML; template names shortened)</span></p>
          <div id={p.domId ? "ptr" : undefined} className="ptrscroll">
            {!node && <p className="muted small">Select a value to see the
              part of solc's ethdebug pointer that finds it.</p>}</div>
        </div>
      </div>
    </div>
  </>;
}
