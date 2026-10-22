// The real debugger (the post's "a real debugger runs on it, offline, in
// your browser"): soldb itself, in a Web Worker, on the same transaction
// compiled from Solidity and from Fe (Arcade, alice's second play()),
// with the inspector's own views: the code panel and the moves.
// Everything shown is soldb's: each step's source range, and inline,
// its pc and op. No pointer of ours resolves
// anything here. The reader moves a source range at a time, as in a
// source debugger: each move goes to the next (or previous) step whose
// range, in the contract's own source, is another one; no step of
// compiler-generated code (no range) or of Fe's library. soldb loads
// on first view, from beside the app (figures/soldb.ts), its progress
// in the code panel; the box keeps its size from the first paint
// (data-ready, for the embed, at once: the reader sees soldb load;
// data-loaded once a step is drawn).
import {
  useEffect, useLayoutEffect, useMemo, useRef, useState,
  type KeyboardEvent,
} from "react";
import { intoView, lines, useColoured } from "../ui/Code";
import { ResetButton } from "../ui/Reset";
import {
  soldb, type Loaded, type Progress,
} from "./soldb";

const LANGS = [["sol", "solc"], ["fe", "Fe"]] as const;
type Lang = typeof LANGS[number][0];
// The step each language opens at: the same operation in both, play()
// counting the play, early in its body: Solidity's `player.plays += 1`
// (its first step there), Fe's `store.plays.set(…)`.
// (test/e2e/figures/real-debugger.spec.ts checks both.)
const OPEN: Record<Lang, number> = { sol: 252, fe: 740 };
// (the grammar each source is coloured with: ui/Code.tsx's names)
const GRAMMAR: Record<Lang, string> = { sol: "solidity", fe: "fe" };

type Move = "prev" | "next" | "first" | "last";
const KEYS: Record<string, Move> = { ArrowLeft: "prev", ArrowRight: "next",
  ArrowUp: "prev", ArrowDown: "next", Home: "first", End: "last" };

// The source steps: the first step of each run of steps with one range
// of the contract's own source (a step of compiler-generated code, no
// range, or of a library file, Fe's builtins, belongs to none: it
// neither starts nor ends a run)
function sourceSteps(d: Loaded): number[] {
  const s = d.steps.spans;
  const out: number[] = [];
  let last = "";
  for (let k = 0; k < d.steps.n; k++) {
    if (s[3 * k] < 0 || d.sources[s[3 * k]]?.lib) continue;
    const r = `${s[3 * k]}:${s[3 * k + 1]}:${s[3 * k + 2]}`;
    if (r !== last) out.push(k);
    last = r;
  }
  return out;
}

// the source step a step is in: the last that starts at or before it
const runOf = (runs: number[], i: number) => {
  let a = 0, b = runs.length - 1;
  while (a < b) {
    const m = (a + b + 1) >> 1;
    if (runs[m] <= i) a = m;
    else b = m - 1;
  }
  return a;
};

// the step a move goes to: the previous or next source step, or an end
function moveOf(runs: number[], i: number, how: Move): number {
  if (!runs.length) return i;
  const k = runOf(runs, i);
  if (how === "first") return runs[0];
  if (how === "last") return runs[runs.length - 1];
  if (how === "next") return runs[Math.min(runs.length - 1, k + 1)];
  return runs[i > runs[k] ? k : Math.max(0, k - 1)];
}

// a step's range: its own, or (compiler-generated code) the last one
// before it, muted
function rangeAt(d: Loaded, i: number) {
  const s = d.steps.spans;
  for (let k = i; k >= 0; k--) {
    if (s[3 * k] >= 0) {
      return { source: s[3 * k], from: s[3 * k + 1], to: s[3 * k + 2],
        last: k !== i, file: d.steps.files[k] };
    }
  }
  return undefined;
}

const kb = (n: number) => `${Math.round(n / 1024).toLocaleString("en")
} KB`;

// the files' bytes so far, of their totals (and the share), and the
// phase after them
function progressText(ps: Map<string, Progress>, phase?: string) {
  const all = [...ps.values()];
  const got = all.reduce((n, p) => n + (p.loaded ?? 0), 0);
  const total = all.length && all.every((p) => p.total) ? all.reduce(
    (n, p) => n + (p.total ?? 0), 0) : 0;
  if (phase && all.length && all.every((p) => p.done)) return `${phase}…`;
  return `Loading soldb (WebAssembly) and the transaction: ${kb(got)}${
    total ? ` of ${kb(total)} · ${Math.min(100, Math.floor(100 * got /
      total))}%` : ""}`;
}

export function RealDebugger() {
  const [engine] = useState(() => soldb());
  const [lang, setLang] = useState<Lang>("sol");
  const [data, setData] = useState<Partial<Record<Lang, Loaded>>>({});
  const [at, setAt] = useState<Partial<Record<Lang, number>>>({});
  const [loading, setLoading] = useState<{ files: Map<string, Progress>;
    phase?: string }>({ files: new Map() });
  const [error, setError] = useState<string>();
  const d = data[lang];
  const runs = useMemo(() => d ? sourceSteps(d) : [], [d]);
  const i = at[lang] ?? (d ? Math.min(OPEN[lang], d.steps.n - 1) : 0);

  // soldb's data set for the language shown, once
  useEffect(() => {
    if (data[lang]) return;
    let live = true;
    setError(undefined);
    const files = new Map<string, Progress>();
    setLoading({ files });
    engine.then(async (e) => {
      const got = await e.load(lang, (p) => {
        if (!live) return;
        if (p.path) files.set(p.path, p);
        setLoading({ files: new Map(files), phase: p.phase });
      });
      if (live) setData((x) => ({ ...x, [lang]: got }));
    }).catch((e) => live && setError(String((e as Error)?.message ?? e)));
    return () => {
      live = false;
    };
  }, [engine, lang, data]);

  const go = (how: Move) => {
    if (!d) return;
    setAt((x) => ({ ...x, [lang]: moveOf(runs, i, how) }));
  };
  // (the arrow keys anywhere in the figure, once the reader has clicked
  // in it or tabbed to it)
  const onKey = (e: KeyboardEvent) => {
    const how = KEYS[e.key];
    if (!how || e.altKey || e.metaKey || e.ctrlKey) return;
    e.preventDefault();
    go(how);
  };
  // (back to the opening language and steps)
  const reset = () => {
    setLang("sol");
    setAt({});
  };
  // (changed: another language, or a step the reader chose)
  const changed = lang !== "sol" || Object.entries(at).some(([k, n]) =>
    n !== OPEN[k as Lang]);

  const r = d && rangeAt(d, i);
  const src = d && (r ? d.sources[r.source] : d.sources[d.main]);
  const text = src?.text ?? "";
  const coloured = useColoured(text, GRAMMAR[lang]);
  const mark = r && { from: r.from, to: r.to,
    className: r.last ? "rng last" : "rng" };
  const pre = useRef<HTMLPreElement>(null);
  // (another language's text, or its colouring come: placed from the
  // top again, not from where the other's, or the plain text's, was)
  const shown = useRef<string>(undefined);
  useLayoutEffect(() => {
    const box = pre.current;
    const now = `${lang}:${!!coloured}`;
    if (box && d && shown.current !== now) {
      box.scrollTop = box.scrollLeft = 0;
      shown.current = now;
    }
    intoView(box);
  }, [mark?.from, mark?.to, coloured, lang, d]);
  const file = (r?.file ?? "").split("/").pop() ||
    (lang === "sol" ? "Arcade.sol" : "arcade.fe");
  const note = !d ? "" : !r ? "no source range yet"
    : r.last ? "compiler-generated code: the last range, muted"
      : src?.lib ? `library code (${src.lib})` : "";
  // (loaded: soldb loaded, the step drawn)
  const loaded = !!d;
  const s = d?.steps;

  return <div className="lens soldb" data-figure="real-debugger"
    data-ready data-loaded={loaded || undefined} data-lang={lang}
    tabIndex={-1} onKeyDown={onKey}>
    <ResetButton shown={changed} onReset={reset} />
    <p className="view-name treehead shead">soldb · Walnut's debugger
      <span className="handmade">running in this page, from ethdebug data
        alone</span></p>
    <div className="sbar">
      <div className="picker" role="radiogroup" aria-label="Language">
        {LANGS.map(([k, t]) => <button key={k} type="button" role="radio"
          data-lang={k} aria-checked={k === lang ? "true" : "false"}
          onClick={() => setLang(k)}>{t}</button>)}
      </div>
      <div className="moves" tabIndex={0} aria-label="soldb's steps">
        <span className="mctl">
          {([["first", "The transaction's first source range", "⏮"],
            ["prev", "The previous source range", "◀ Back"],
            ["next", "The next source range", "Step ▶"],
            ["last", "The transaction's last source range", "⏭"]] as const)
            .map(([how, label, t]) => <button key={how} type="button"
              className="btn" data-move={how} aria-label={label}
              title={label} disabled={!d || moveOf(runs, i, how) === i}
              onClick={() => go(how)}>{t}</button>)}
        </span>
        <span className="mat" data-step={d ? i : ""}>{error
          ? <span className="error">{error}</span> : !s
          ? <span className="muted">step – of – · pc – · –</span>
          : <>step <b>{runOf(runs, i) + 1}</b> of {runs.length} · pc{" "}
            {s.pcs[i]} · <code>{s.ops[i]}</code></>}</span>
      </div>
    </div>
    <div className="code" data-area="code">
      <p className="codehead"><span className="srcfile">{file}</span>{" "}
        <span className="codenote">{note}</span></p>
      <pre ref={pre} className={`src codesrc${coloured ? " coloured"
        : ""}`}>{d ? lines(text, coloured, { indent: true,
          ...mark ? { mark } : {} })
        : !error && <span className="muted sload" role="status">{
          progressText(loading.files, loading.phase)}</span>}</pre>
    </div>
  </div>;
}
