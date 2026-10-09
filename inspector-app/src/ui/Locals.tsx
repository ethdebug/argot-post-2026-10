// The memory section's own views (vanilla mem.js): the source with the
// paused instructions marked (#msrc and its legend), and the lines about
// the pause (#mnote, #mviewing, #mmeta). (The selection and how it was
// found: the walkthrough, WalkthroughPanel.)
import type { ReactNode } from "react";
import {
  useCompilation, useDecoded, useLens, useLensState, useLink, usePoint,
} from "./hooks";
import type { DataRef, ViewId } from "./types";

// both steps of the pause: the moment before the one shown, and it (a
// pause of one step: that one only)
function useSides(data: DataRef) {
  const [prev, now] = (["previous", "current"] as const).map((moment) =>
    ({ decoding: data.decoding, moment }));
  const a = useDecoded(prev);
  const b = useDecoded(now);
  const pa = usePoint(prev);
  const pb = usePoint(now);
  const single = !pa;
  return { single, before: single ? undefined : a, after: b, pa, pb };
}

// ------------------------------------------------------------- source

// The source, with the paused instructions' code ranges marked: one
// point's, or the two steps' (before, after); and its legend
export function Source(p: { id: ViewId; data: DataRef; domId?: string;
  part?: "legend" }) {
  const lens = useLens();
  const { single, pa, pb } = useSides(p.data);
  const c = useCompilation(p.data);
  if (p.part === "legend") {
    return <span className="legend" id={p.domId}>{single
      ? <mark className="mb">paused here</mark> : <><mark className="ma">
        before</mark> <mark className="mb">after</mark></>}</span>;
  }
  const src = c?.sources[0]?.text ?? "";
  const bytes = new TextEncoder().encode(src);
  const cls = new Array<string>(bytes.length).fill("");
  for (const [pt, k] of single ? [[pb, "b"] as const]
    : [[pa, "a"] as const, [pb, "b"] as const]) {
    const r = pt?.paused?.range;
    if (!r) continue;
    for (let i = r.offset; i < r.offset + r.length; i++) cls[i] += k;
  }
  const out: ReactNode[] = [];
  const dec = new TextDecoder();
  for (let k = 0; k < bytes.length;) {
    let e = k;
    while (e < bytes.length && cls[e] === cls[k]) e++;
    const t = dec.decode(bytes.slice(k, e));
    out.push(cls[k] ? <mark key={k} className={`m${cls[k]}`}>{t}</mark>
      : t);
    k = e;
  }
  return <pre id={p.domId} className="src"
    data-view={`${lens.key}:${p.id}`}>{out}</pre>;
}

// --------------------------------------------------------------- note

const NOTES: Record<string, (inl: string) => string> = {
  roll: () => "Just after `let hit = _rolledHit()`: the first step where " +
    "bugc gives hit a location.",
  mult: (inl) => `Inside _applyCombo(10, 3), ${inl}: the two steps around ` +
    "`mult = combo`, the first where all three locals have a location with " +
    "mult = 5, then with mult = 3.",
  writes: () => "gained = 30, just before the SSTORE that adds it to her " +
    "score; her record slot as the trace has it then (every counter but " +
    "score already written).",
};

// a line about the pause; or the selection ("viewing …"); or the
// program and compiler
export function Note(p: { id: ViewId; data: DataRef; domId?: string;
  part: "note" | "viewing" | "meta"; link?: string }) {
  const lens = useLens();
  const { single, pa, pb } = useSides(p.data);
  const c = useCompilation(p.data);
  const [link] = useLink(p.link);
  const id = useLensState((s) => s.scene ?? "");
  if (p.part === "viewing") {
    const sel = link.selection;
    return <span id={p.domId} className="viewing" hidden={!sel}>{sel
      ? `viewing ${sel} · Esc to clear` : ""}</span>;
  }
  if (p.part === "meta") {
    const m = c?.compiler.match(/\(ethdebug\/format (\S+), (\w+)\)/);
    // (kept, hidden, as vanilla's since ab53776: the About page says it)
    return <p className="meta" id={p.domId} hidden>Program{" "}
      <code>{c?.sources[0]?.path}</code>, alice's third hit, compiled by
      bugc from ethdebug/format {m?.[1] === "main" ? "main"
        : <>branch <code>{m?.[1]}</code></>} (commit <code>{m?.[2]}</code>).
    </p>;
  }
  const [o, pt] = id.split("/");
  const steps = (single ? [pb] : [pa, pb]).map((x) => x?.paused);
  const inl = o === "O0" ? "a real call, with its frame"
    : "inlined: no call, no frame";
  const text = NOTES[pt]?.(inl) ?? "";
  return <p id={p.domId} className="summary">{`${text} At -O${
    o?.slice(1)}: ${steps.map((s) => `step ${s?.step} (${s?.op})`)
    .join(" and ")} of ${steps[0]?.of}.`}</p>;
}
