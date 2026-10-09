// The debugger's moves (addendum §3.1): a trace step back or on, the
// previous or next change of source range, a transaction's first trace
// step or its end, another transaction; keys while the lens has focus:
// ← → a trace step, ↑ ↓ a range change, Home End the transaction's ends.
// One line of where it is: the transaction, the trace step, its op.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { move, type Move } from "../engine/moves";
import type { MomentSource } from "../engine/source";
import { useLens, useLensState } from "./hooks";
import type { ViewId } from "./types";

const KEYS: Record<string, Move> = { ArrowLeft: "prev", ArrowRight: "next",
  ArrowUp: "prev-range", ArrowDown: "next-range", Home: "tx-first",
  End: "tx-last" };

export function Moves(p: { id: ViewId; domId?: string }) {
  const lens = useLens();
  const scene = useLensState((s) => s.scene);
  const i = useLensState((s) => s.moment);
  const [src, setSrc] = useState<{ id: string; src: MomentSource }>();
  useEffect(() => {
    if (!scene) return;
    let live = true;
    void lens.project.source(scene).then((x) => live &&
      setSrc({ id: scene, src: x }));
    return () => {
      live = false;
    };
  }, [lens.project, scene]);
  const s = src?.id === scene ? src?.src : undefined;
  const go = (how: Move) => {
    if (!s || !scene) return;
    const j = move(s, i, how);
    if (j !== i) {
      void lens.show(scene, { moment: j, sel: lens.store.get().links[
        lens.spec.links[0]]?.selection ?? null });
    }
  };
  const box = useRef<HTMLDivElement>(null);
  const onKey = (e: KeyboardEvent) => {
    const how = KEYS[e.key];
    if (!how || (e.target as Element).closest("select, input")) return;
    e.preventDefault();
    go(how);
  };
  const m = s?.moments[i];
  const at = s && m ? s.moment(i) : undefined;
  const txs = s ? [...new Set(s.moments.map((x) => x.tx))] : [];
  const steps = s && m ? s.moments.filter((x) => x.tx === m.tx).length - 1
    : 0;
  const btn = (how: Move, label: string, text: string) =>
    <button type="button" className="btn" data-move={typeof how ===
      "object" ? "tx" : how} aria-label={label} onClick={() => go(how)}
      disabled={!s || move(s, i, how) === i}>{text}</button>;
  return <div ref={box} id={p.domId} className="moves" tabIndex={0}
    onKeyDown={onKey} data-view={`${lens.key}:${p.id}`}>
    <span className="mctl">
      {btn("tx-first", "The transaction's first trace step", "⏮")}
      {btn("prev-range", "The previous source range", "«")}
      {btn("prev", "The previous trace step", "◀")}
      {btn("next", "The next trace step", "▶")}
      {btn("next-range", "The next source range", "»")}
      {btn("tx-last", "The transaction's end", "⏭")}
    </span>
    <label className="mtx">transaction <select value={m?.tx ?? 0}
      disabled={!s} onChange={(e) => go({ tx: Number(e.target.value) })}>
      {txs.map((t) => <option key={t} value={t}>{t}</option>)}</select>
    </label>
    <span className="mat" data-moment={m ? `${m.tx}:${m.step}` : ""}>{!m
      ? "running…" : m.step === "end" ? "after the transaction"
      : <>trace step <b>{m.step}</b> of {steps} · <code>{at?.op}</code>
      </>}</span>
  </div>;
}
