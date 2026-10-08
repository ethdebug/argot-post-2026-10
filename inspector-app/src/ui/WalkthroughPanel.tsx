// The bar over both columns and the details under it, as one unit
// (vanilla main.js renderBox, startReplay, stepTo, endReplay, fold,
// setFocus, retarget, cue; index.html #details, #dwrap). At rest: the
// selection and "▸ Show how it was found" (with nothing selected, the
// details of what is pointed at). In a walkthrough: the bar tinted,
// "Walkthrough", ⏮ ◀ ▶ ⏭ (each disabled at its end), the count (step 0,
// the goal, counts 0), the step's short caption and ✕ Exit; under it,
// the pointer, the step in full, the focus picker and the chips. Every
// part keeps its slot, used or empty: nothing moves but the details'
// unfolding at entry and exit (280 ms; none with reduced motion).
import {
  Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode,
} from "react";
import type { Decoded } from "../engine/types";
import { locked } from "../engine/target";
import { retarget, type Form, type Step, type Tok } from
  "../engine/walkthrough/fold";
import { FOOT, footOf, shortCap } from "../engine/walkthrough/words";
import {
  decodingOf, useDecoded, useLayout, useLens, useLensState, useLink,
  usePoint, useViewSpec, useWalkthrough,
} from "./hooks";
import { infoOf, whereOf, type Info, type Part, type Sides } from "./info";
import { PointerYaml } from "./PointerYaml";
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
const still = () =>
  !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const parts = (ps: Part[]) => ps.map((p, k) => typeof p === "string"
  ? <Fragment key={k}>{p}</Fragment> : <code key={k}>{p.code}</code>);
// a caption's names from the code (in `backticks`), in monospace
const cap = (t: string) => t.split(/`([^`]+)`/).map((x, k) => k % 2
  ? <code key={k} className="id">{x}</code>
  : <Fragment key={k}>{x}</Fragment>);
const pk = (k: number | string | undefined) =>
  k === "src" ? "pksrc" : k ? `pk${k}` : "";

function toks(ts: Tok[]): ReactNode {
  return ts.map((t, k) => typeof t === "string"
    ? <Fragment key={k}>{t}</Fragment>
    : "code" in t ? <code key={k}>{t.code}</code>
      : "gloss" in t ? <span key={k} className="gloss">{t.gloss}</span>
        : "prose" in t ? <span key={k} className="prose">{t.prose}</span>
          : "question" in t ? <span key={k} className="prose rq">{
            t.question}</span>
            : <span key={k} className="fname" data-path={t.field}>{t.text}
            </span>);
}

// A step's worked values: a line, a table (one row an instance), lines,
// or a byte strip (a word's 32 bytes as a dump row draws them, the
// fields over their bytes, in their colours)
function FormView({ f }: { f: Form }) {
  if (f.kind === "text") return <>{toks(f.toks)}</>;
  if (f.kind === "lines") {
    return <>{f.lines.map((l, k) => <Fragment key={k}>{k > 0 && <br />}
      {toks(l)}</Fragment>)}</>;
  }
  if (f.kind === "table") {
    return <span className="itab">{f.rows.map((r, k) => <Fragment key={k}>
      <span>{toks(r.a)}</span><span className="prose">→</span>
      <span className={r.k ? `${pk(r.k)} isw` : undefined}>{toks(r.b)}
      </span></Fragment>)}</span>;
  }
  const hex = f.word.slice(2).padStart(64, "0").match(/../g) ?? [];
  const owner = (i: number) => f.fields.find((x) => i >= x.from && i <= x.to);
  return <span className="bstrip" role="img" aria-label={f.fields.map((x) =>
    `${x.name} bytes ${x.from}–${x.to}`).join(", ")}>
    <span className="bbytes">{hex.map((b, i) => {
      const o = owner(i);
      return <span key={i} className={`b${o ? ` hl ${pk(o.k)}` : " free"}${
        o && i === o.from ? " gs" : ""}${o && i === o.to ? " ge" : ""}`}>
        {b}</span>;
    })}</span>
    <span className="bnames">{f.fields.map((x) => <span key={x.path}
      className={`fname ${pk(x.k)}`} data-path={x.path}
      style={{ gridColumn: `${x.from + 1} / ${x.to + 2}` }}>{x.name}</span>)}
    </span>
  </span>;
}

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

// The Vyper scene: the same entry by Vyper's own rule (hand-written: no
// ethdebug from Vyper), its words listed, each lighting its word
function Contrast({ d, path, side, onPoint }: { d?: Decoded; path: string;
  side: string; onPoint: (slot: bigint | null) => void }) {
  const entry = path.match(/^players\[[^\]]*\]/)?.[0];
  const e = entry && d?.byPath.get(entry);
  if (!d || !e) return null;
  const words: { slot: bigint; name: string; text: string }[] = [];
  for (const m of e.children ?? []) {
    const value = m.regions.find((r) => r.role === "value");
    const len = m.regions.find((r) => r.role === "length");
    if (len && value) {
      const s = JSON.parse(m.value?.text ?? '""') as string;
      const bytes = new TextEncoder().encode(s);
      words.push({ slot: len.slot!, name: `${m.label} (length)`,
        text: String(bytes.length) });
      for (let k = 0; k * 32 < Math.max(1, bytes.length); k++) {
        words.push({ slot: value.slot! + BigInt(k),
          name: `${m.label} (bytes)`, text: JSON.stringify(
            new TextDecoder().decode(bytes.slice(k * 32, k * 32 + 32))) });
      }
    } else if (value) {
      words.push({ slot: value.slot!, name: m.label,
        text: m.value?.text ?? "" });
    }
  }
  const first = "0x" + (words[0]?.slot ?? 0n).toString(16).padStart(64, "0");
  return <>
    <p className="howside">Vyper's rule, for contrast: not from ethdebug
      (Vyper emits none). Vyper's <code>players</code> is slot 108; it
      hashes the slot first, <code>keccak256(slot 108 . key)</code>, and
      puts each member in its own slot, the name's length and bytes after
      them.</p>
    <ol className="steps vyper">{words.map((w, k) => <li key={k}
      data-side={side} tabIndex={0}
      onPointerEnter={() => onPoint(w.slot)} onFocus={() => onPoint(w.slot)}
      onPointerLeave={() => onPoint(null)} onBlur={() => onPoint(null)}>
      <span className="k">Slot {k ? `+ ${k}` : ""}</span><div className="c">
        {k ? "" : <><span className="hex short">{first.slice(0, 14)}…{
          first.slice(-12)}</span>: </>}<code>{w.name}</code> = <b>{w.text}
        </b></div></li>)}</ol>
  </>;
}

export function WalkthroughPanel(p: { id: ViewId; data: DataRef;
  link?: LinkId; domId?: string; compare?: DataRef;
  others?: { decoding: string; who?: string }[] }) {
  const { d, l } = useLayout(p.id);
  const o = useDecoded(p.compare);
  const here = usePoint(p.data);
  const there = usePoint(p.compare);
  const [link, setLink] = useLink(p.link);
  const side = useLensState((s) => s.side ?? "after");
  const single = !p.compare;
  useViewSpec(p.id);
  const lens = useLens();
  const w = useWalkthrough(p.id);
  // (the Vyper scene: Vyper's own reading of the same point)
  const vyRef = p.others?.find((x) => d && decodingOf(lens, x.decoding)
    ?.timeline === decodingOf(lens, d.decoding)?.timeline);
  const vy = useDecoded(vyRef && d ? { decoding: vyRef.decoding,
    point: d.point } : undefined);
  const sides: Sides | undefined = d && l ? { d, l, snap: here?.snapshot,
    ...(o ? { pair: side === "before"
      ? { before: { d, snap: here?.snapshot },
        after: { d: o, snap: there?.snapshot } }
      : { before: { d: o, snap: there?.snapshot },
        after: { d, snap: here?.snapshot } } } : {}) } : undefined;
  const sel = link.selection && d?.byPath.has(link.selection)
    ? link.selection : null;
  const node = sel ? d!.byPath.get(sel) : undefined;
  const walk = link.walk;
  const steps = w?.steps ?? [];
  const goal = steps[0]?.goal ? 1 : 0;
  const i = walk ? Math.max(0, Math.min(steps.length - 1, walk.step)) : -1;
  const st: Step | undefined = walk ? steps[i] : undefined;

  // the unfolding of the details: at entry and exit only; meanwhile the
  // walkthrough takes no input
  const wrap = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [unfolding, setUnfolding] = useState(false);
  const started = useRef(0);
  const fold = (open: boolean) => {
    const dp = panel.current;
    const wr = wrap.current;
    const h = dp?.offsetHeight ?? 0;
    if (!dp || !wr || still() || !h || !wr.animate) return Promise.resolve();
    setUnfolding(true);
    // (no step while the details move: the lens's keys see it)
    setLink((s) => s.walk ? { ...s, walk: { ...s.walk, busy: true } } : s);
    wr.classList.add("folding");
    const o2 = { duration: 280, easing: open ? "ease-out" : "ease-in" };
    const hs = [{ height: "0px" }, { height: `${h}px` }];
    const ts = [{ transform: `translateY(${-h}px)` }, { transform: "none" }];
    if (!open) {
      hs.reverse();
      ts.reverse();
    }
    wr.animate(hs, { ...o2, fill: "forwards" });
    return dp.animate(ts, { ...o2, fill: "forwards" }).finished.then(() => {
      wr.getAnimations().forEach((a) => a.cancel());
      dp.getAnimations().forEach((a) => a.cancel());
      wr.classList.remove("folding");
      setUnfolding(false);
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk, busy: false } }
        : s);
    });
  };
  const opening = useRef(false);
  const start = (at = 0) => {
    if (!sel || !w?.steps.length) return;
    started.current = performance.now();
    opening.current = true;
    setLink((s) => ({ ...s, hover: null, walk: { step: at,
      focus: undefined, n: w.steps.length } }));
  };
  // (once the details are drawn: unfold them, bring the bar to the top
  // of the window, and the focus to ▶)
  useLayoutEffect(() => {
    if (!opening.current || !walk) return;
    opening.current = false;
    void fold(true);
    // (the line before the bar in the page: its own sibling, or its
    // place's, on the parity page)
    const before = bar.current?.previousElementSibling ??
      bar.current?.parentElement?.previousElementSibling;
    if (before) {
      const y = before.getBoundingClientRect().bottom + scrollY +
        parseFloat(getComputedStyle(before).marginBottom || "0");
      scrollTo({ top: Math.max(0, y), behavior: still() ? "auto"
        : "smooth" });
    }
    (bar.current?.querySelector<HTMLElement>(
      'button[data-r="next"]:not([disabled])') ?? bar.current
      ?.querySelector<HTMLElement>("button:not([disabled])"))
      ?.focus({ preventScroll: true });
  });
  const exit = async () => {
    if (!walk || unfolding) return;
    await fold(false);
    setLink((s) => ({ ...s, walk: null }));
    exiting.current = false;
    setTimeout(() => bar.current?.querySelector<HTMLElement>(
      'button[data-r="start"]')?.focus({ preventScroll: true }));
  };
  // (an exit asked elsewhere: Escape in the lens)
  const exiting = useRef(false);
  useEffect(() => {
    if (walk?.exit && !exiting.current && !unfolding) {
      exiting.current = true;
      void exit();
    }
  });
  const stepTo = (k: number) => {
    if (!walk || unfolding) return;
    const to = Math.max(0, Math.min(steps.length - 1, k));
    if (to === walk.step) return;
    setLink((s) => s.walk ? { ...s, walk: { ...s.walk, step: to } } : s);
  };
  const setFocus = (f: string) => {
    if (!walk || unfolding || f === w?.focus) return;
    setLink((s) => s.walk ? { ...s, walk: { ...s.walk, focus: f } } : s);
  };
  // (the step count, in the link: the lens's keys clamp to it)
  useEffect(() => {
    if (walk && w && walk.n !== w.steps.length) {
      setLink((s) => s.walk ? { ...s, walk: { ...s.walk,
        n: w.steps.length } } : s);
    }
  }, [walk, w, setLink]);

  // re-targeting: a new selection during a walkthrough keeps it, and its
  // place (the steps aligned by identity); a cue when the place moved
  const last = useRef<{ sel: string; steps: Step[]; at: number } | null>(
    null);
  const [cue, setCue] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    const was = last.current;
    if (walk && w && was && was.sel !== sel && sel) {
      const r = retarget(was.steps, was.at, w.steps);
      last.current = { sel, steps: w.steps, at: r.at };
      setLink((s) => s.walk ? { ...s, walk: { step: r.at,
        n: w.steps.length } } : s);
      if (r.moved) {
        setCue((c) => ({ text: `→ step ${r.at + (w.steps[0]?.goal ? 0 : 1)}`,
          n: (c?.n ?? 0) + 1 }));
      }
      return;
    }
    last.current = walk && w && sel ? { sel, steps: w.steps, at: i } : null;
  }, [walk, w, sel, i, setLink]);
  useEffect(() => {
    if (!cue) return;
    const t = setTimeout(() => setCue(null), 1800);
    return () => clearTimeout(t);
  }, [cue]);

  const onClick = (e: React.MouseEvent) => {
    const b = (e.target as Element).closest<HTMLElement>("button[data-r]");
    if (!b) return;
    const k = b.dataset.r!;
    // (a double click on the entry: its second click lands on a step
    // button; it is ignored)
    if (k !== "start" && e.detail > 1 &&
      performance.now() - started.current < 600) return;
    if (unfolding) return;
    if (k === "start") start();
    else if (k === "exit") void exit();
    else if (k === "first") stepTo(0);
    else if (k === "last") stepTo(Infinity);
    else stepTo(i + (k === "next" ? 1 : -1));
  };

  let barBody: ReactNode;
  let text: ReactNode;
  const selSpan = node && (() => {
    const own = node.children && node.regions.some((r) =>
      r.role === "length");
    const v = node.value?.text ?? (own ? node.summary : undefined);
    const n = node.children?.length ?? 0;
    return <span className="rsel"><code>{shortKeys(sel!)}</code>{
      node.typeText && <> <span className="type">{node.typeText}</span></>}
      {v !== undefined ? <> = <b>{v}</b></> : node.children ? <> <span
        className="muted">{n} {partsWord(node.typeText, n)}</span></>
        : null}{!single && <> <span className="muted">({side})</span></>}
    </span>;
  })();
  // footnote numbers: by first use in this walkthrough
  const notes: string[] = [];
  for (const s of steps) {
    const c = footOf(s);
    if (c && !notes.includes(c)) notes.push(c);
  }
  if (!node || !sides) {
    barBody = <><span className="rmode" /><span className="rsel muted">
      Select a value to see how it was found.</span><span className="rctl" />
      <span className="rcount" /><span className="rshort" />
      <span className="rexit" /></>;
    const t = sides && locked(link.hover, null, sides.d.byPath);
    text = <Details info={sides ? infoOf(sides, t ?? null) : null} />;
  } else if (st && w) {
    const btn = (r: string, label: string, glyph: string, off: boolean) =>
      <button type="button" className="btn" data-r={r} aria-label={label}
        disabled={off}>{glyph}</button>;
    const lastStep = i === steps.length - 1;
    const fc = footOf(st);
    barBody = <><span className="rmode">Walkthrough</span>{selSpan}
      <span className="rctl">{btn("first", "First step", "⏮", !i)}
        {btn("prev", "Previous step", "◀", !i)}
        {btn("next", "Next step", "▶", lastStep)}
        {btn("last", "Last step", "⏭", lastStep)}</span>
      <span className="rcount">{i + 1 - goal} / {steps.length - goal}</span>
      <span className="rshort">{cap(shortCap(st, w.variable))}</span>
      <span className="rexit"><button type="button" className="btn"
        data-r="exit">✕ Exit</button></span>
      {cue && <span key={cue.n} className="rcue" aria-live="polite">
        {cue.text}</span>}</>;
    text = <><p className="rcap">{cap(st.cap)}</p>
      <p className="rform"><FormView f={st.form} /></p>
      <p className="rsrc">{st.constructs.map((c) => <Fragment key={c}>
        <code className="badge">{c}{c === fc && <sup className="fn">{
          notes.indexOf(c) + 1}</sup>}</code>{" "}</Fragment>)}<span
        className={`source${st.sourceTint ? " pksrc" : ""}`}>{st.source}
      </span></p>
      <p className="fnotes">{fc && <span className="fnote"><sup>{
        notes.indexOf(fc) + 1}</sup> <a href={FOOT[fc][1]} target="_blank"
        rel="noopener">{FOOT[fc][0]}</a></span>}</p></>;
  } else {
    const own = node.children && node.regions.some((r) =>
      r.role === "length");
    const v = node.value?.text ?? (own ? node.summary : undefined);
    const n = node.children?.length ?? 0;
    const otherText = o?.byPath.get(node.path)?.value?.text;
    barBody = <><span className="rmode" />{selSpan}
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
        of the ethdebug data from the compiler for {sel!.split(/[.[]/)[0]}.
      </span></p></>;
  }

  // the chips: one per step (not step 0), done, current or later; all
  // done at rest
  const at = walk ? i : steps.length;
  const chips = node && steps.slice(goal).map((s, k) => <Fragment key={k}>
    {k > 0 && <span className="carrow" aria-hidden="true">→</span>}
    <button type="button" className={`chip ${k + goal < at ? "done"
      : k + goal === at ? "cur" : "later"}`} data-k={k}
      aria-label={`Step ${k + 1}: ${s.cap.replace(/`/g, "")}`}
      onClick={() => walk ? stepTo(k + goal) : start(k + goal)}>
      <span className="ctext">{s.chip}</span>
      <span className="clabel">{s.chipLabel}</span></button></Fragment>);
  const chipsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    // the current chip, scrolled into the chips' row
    const box = chipsRef.current;
    if (!box) return;
    const cur = box.querySelector<HTMLElement>(".chip.cur");
    const right = cur ? cur.offsetLeft - box.offsetLeft + cur.offsetWidth
      : 0;
    box.scrollLeft = Math.max(0, right - box.clientWidth + 8);
  });

  const pointVy = (slot: bigint | null) => setLink((s) => s.walk ? s
    : { ...s, hover: slot === null ? null : { region: { location: "storage",
      slot, offset: 0, length: 32, role: "value", instance: "" } } });

  return <>
    <div ref={bar} id={p.domId} className={`rbar${walk ? " replaying" : ""}`}
      aria-live="polite" tabIndex={0}
      aria-label="The selected value; how it was found"
      data-view={`${lens.key}:${p.id}`} onClick={onClick}>{barBody}</div>
    <div ref={wrap} id={p.domId ? "dwrap" : undefined} className="dwrap"
      data-view={`${lens.key}:${p.id}`}>
      <div ref={panel} id={p.domId ? "dpanel" : undefined}
        className="dpanel" hidden={!walk}>
        <div className="dleft">
          <div id={p.domId ? "dtext" : undefined} className="dtext">{text}
          </div>
          <div id={p.domId ? "dpick" : undefined} className="dpick">
            {walk && w?.recs && <><span className="plab">Focus</span>
              {[{ path: "*", who: "all" }, ...w.recs].map((r) =>
                <button key={r.path} type="button" className="btn"
                  data-focus={r.path} aria-pressed={r.path === w.focus
                    ? "true" : "false"} onClick={() => setFocus(r.path)}>
                  {r.who}</button>)}</>}</div>
          <div ref={chipsRef} id={p.domId ? "chips" : undefined}
            className="chips">{chips}</div>
        </div>
        <div className="ptr" aria-label="Ethdebug data from the compiler">
          <p className="plabel">Ethdebug data from the compiler <span
            className="pnote">(as YAML; template names shortened; solc
            writes <code>$</code>, shown as <code>~</code>)</span></p>
          <PointerYaml domId={p.domId ? "ptr" : undefined} data={p.data}
            variable={sel?.split(/[.[]/)[0]} band={st?.band}
            goal={!!st?.goal} shown={!!walk}
            before={vy && sel ? <Contrast d={vy} path={sel} side={side}
              onPoint={pointVy} /> : null} />
        </div>
      </div>
    </div>
  </>;
}
