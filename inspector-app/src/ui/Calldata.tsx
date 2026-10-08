// The calldata section's own views (vanilla calldata.js): what a part
// is (#cdetails) and how the ABI finds it (#chow). Its bytes and its
// parts are the Dump and the Tree of location calldata.
import { Fragment, type ReactNode } from "react";
import type { ValueNode } from "../engine/types";
import { hex4 } from "../engine/location";
import { useDecoded, useLens, useLensState, useLink } from "./hooks";
import type { DataRef, ViewId } from "./types";
import { span as spanOf } from "../engine/derivation";

const span = (n: ValueNode) => spanOf(n.regions[0]);
// a part's name: "text (length)"; the selector's own
const nameOf = (m: ValueNode | undefined, n: ValueNode) =>
  n.root === n.path ? n.label : `${m?.label} (${n.label === "bytes"
    ? "bytes" : n.label})`;

export function AbiView(p: { id: ViewId; data: DataRef; link?: string;
  domId?: string; part: "details" | "how" }) {
  const lens = useLens();
  const d = useDecoded(p.data);
  const [link, setLink] = useLink(p.link);
  const bm = useLensState((s) => lens.project.bookmarks.find((b) =>
    b.id === s.bookmark));
  const k = link.hover?.path ?? link.selection;
  // (the parameter: the node with parts)
  const m = d?.tree.find((n) => n.children);
  const parts = m?.children ?? [];
  if (p.part === "details") {
    const n = k ? d?.byPath.get(k) : undefined;
    const info: [string, ReactNode][] | null = !n ? null : n.children
      ? [["Value", <><code>{n.label}</code> ({n.typeText})</>],
        ["Where", parts.map((x) => `${nameOf(m, x)}: ${span(x)}`)
          .join("; ")], ["Holds", n.value?.text ?? ""]]
      : [["Value", <code>{nameOf(m, n)}</code>], ["Where", span(n)],
        ["Holds", n.value?.text ?? ""]];
    return <div id={p.domId} className="details" aria-live="polite"
      data-view={`${lens.key}:${p.id}`}>
      {info ? <dl>{info.map(([t, v]) => <Fragment key={t}><dt>{t}</dt>
        <dd>{v}</dd></Fragment>)}</dl>
        : <p className="muted">Point at a part or a byte for its
          details.</p>}</div>;
  }
  const sig = bm?.calldata?.signature ?? "";
  const sel = d?.byPath.get("selector");
  const [off, len, data] = parts;
  const lit = (q: string) => !!k && (q === k || d?.byPath.get(k)?.children
    ?.some((x) => x.path === q));
  const step = (n: ValueNode | undefined, kk: string, html: ReactNode) =>
    n && <li key={n.path} data-part={n.part} tabIndex={0}
      className={lit(n.path) ? "hl" : undefined}
      onPointerOver={() => setLink((s) => ({ ...s, hover: { path: n.path } }))}
      onFocus={() => setLink((s) => ({ ...s, hover: { path: n.path } }))}>
      <span className="k">{kk}</span><div className="c">{html}</div></li>;
  const offset = Number(off?.value?.text ?? 0);
  const bytesWord = len?.value?.text === "1" ? "byte" : "bytes";
  return <div id={p.domId} className="how" data-view={`${lens.key}:${p.id}`}>
    {d && <><p className="howside">By the ABI encoding
      of <code>{sig}</code>, not by ethdebug.</p>
    <ol className="steps">
      {step(sel, "Selector", <>bytes 0–3: <b>{sel?.value?.text}</b>, the
        first 4 bytes of keccak256("{sig}")</>)}
      {step(off, "Head", <><code>{m?.label}</code> is the first argument,
        so its head word is at {hex4(4)}. A string is dynamic: the word
        holds the offset of its data, counted from byte 4: <b>{offset}</b></>)}
      {step(len, "Length", <>at 4 + {offset} = {hex4(4 + offset)}: the
        length, <b>{len?.value?.text}</b> {bytesWord}</>)}
      {step(data, "Bytes", <>at {hex4(data?.regions[0].offset ?? 0)}:{" "}
        {len?.value?.text} {bytesWord}, padded with zeros to a whole word →{" "}
        <b>{data?.value?.text}</b></>)}
    </ol></>}</div>;
}
