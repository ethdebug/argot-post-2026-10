// The real debugger (the post's "a real debugger runs on it, offline, in
// your browser"): soldb itself, in a Web Worker, on the same transaction
// compiled from Solidity and from Fe (Arcade, alice's second play()),
// with the inspector's own views: the code panel, the moves, rows.
// Everything shown is soldb's: each step's source range, line, op,
// function and call depth, and (Solidity) the contract's state as
// soldb's state(i) reads it from solc's ethdebug; where soldb has
// nothing, its engine's own words say why. No pointer of ours resolves
// anything here. soldb loads on first view, from beside the app
// (figures/soldb.ts), with its progress; its box keeps its size from
// the first paint (data-ready, for the embed, once the first step is
// drawn).
import {
  useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent,
} from "react";
import { lines, useColoured } from "../ui/Code";
import {
  soldb, type Engine, type Loaded, type Progress, type Variable,
} from "./soldb";

const LANGS = [["sol", "Solidity"], ["fe", "Fe"]] as const;
type Lang = typeof LANGS[number][0];
// The step each language opens at: inside play(), on a statement, where
// soldb's view says the most. Solidity: `totalHits += 1`, the step
// where soldb has read totalScore (170) and totalHits (7), the state
// it knows (the transaction never reads playerList or motd, and soldb
// lists a mapping without its entries). Fe: the score's write,
// `store.scores.set(…)` (its export has no state: nothing to wait for).
// (test/e2e/figures/real-debugger.spec.ts checks both.)
const OPEN: Record<Lang, number> = { sol: 2025, fe: 4249 };
// (the grammar each source is coloured with: Fe's is not loaded, plain)
const GRAMMAR: Record<Lang, string> = { sol: "solidity", fe: "" };

type Move = "prev" | "next" | "prev-line" | "next-line" | "first" | "last";
const KEYS: Record<string, Move> = { ArrowLeft: "prev", ArrowRight: "next",
  ArrowUp: "prev-line", ArrowDown: "next-line", Home: "first", End: "last" };

// the steps where the contract's own line changes (soldb's line
// changes, less those in library code: Fe's builtin files)
const ownLines = (d: Loaded) => d.steps.changes.filter((k) =>
  !d.sources[d.steps.spans[3 * k]]?.lib);

// the step a move goes to: a step back or on, the previous or next
// change of the contract's own line, or an end
function moveOf(d: Loaded, i: number, how: Move): number {
  const { n } = d.steps;
  const own = ownLines(d);
  if (how === "prev") return Math.max(0, i - 1);
  if (how === "next") return Math.min(n - 1, i + 1);
  if (how === "first") return own[0] ?? 0;
  if (how === "last") return n - 1;
  if (how === "next-line") return own.find((k) => k > i) ?? n - 1;
  return [...own].reverse().find((k) => k < i) ?? own[0] ?? 0;
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

const kb = (n: number) => `${Math.round(n / 1024)} KB`;

// the files' bytes so far, of their totals, and the phase after them
function progressText(ps: Map<string, Progress>, phase?: string) {
  const all = [...ps.values()];
  const got = all.reduce((n, p) => n + (p.loaded ?? 0), 0);
  const total = all.every((p) => p.total) ? all.reduce((n, p) =>
    n + (p.total ?? 0), 0) : 0;
  if (phase && all.every((p) => p.done)) return phase;
  return `Loading soldb and the transaction: ${kb(got)}${total
    ? ` of ${kb(total)}` : ""}`;
}

export function RealDebugger() {
  const [engine] = useState(() => soldb());
  const [lang, setLang] = useState<Lang>("sol");
  const [data, setData] = useState<Partial<Record<Lang, Loaded>>>({});
  const [at, setAt] = useState<Partial<Record<Lang, number>>>({});
  const [loading, setLoading] = useState<{ files: Map<string, Progress>;
    phase?: string }>({ files: new Map() });
  const [error, setError] = useState<string>();
  const [why, setWhy] = useState<Engine["whyNot"]>({});
  const d = data[lang];
  const i = at[lang] ?? (d ? Math.min(OPEN[lang], d.steps.n - 1) : 0);

  // soldb's data set for the language shown, once
  useEffect(() => {
    if (data[lang]) return;
    let live = true;
    setError(undefined);
    const files = new Map<string, Progress>();
    engine.then(async (e) => {
      setWhy(e.whyNot);
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

  // (Solidity) soldb's state(i): the contract's state at the step
  const [state, setState] = useState<{ key: string; vars: Variable[] }>();
  const key = d ? `${lang}:${i}` : "";
  useEffect(() => {
    if (!d?.capabilities.state) return;
    let live = true;
    engine.then((e) => e.state(lang, i)).then((vars) => {
      if (live) setState({ key, vars });
    }, (e) => live && setError(String((e as Error)?.message ?? e)));
    return () => {
      live = false;
    };
  }, [engine, d, lang, i, key]);

  const go = (how: Move) => {
    if (!d) return;
    setAt((x) => ({ ...x, [lang]: moveOf(d, i, how) }));
  };
  const onKey = (e: KeyboardEvent) => {
    const how = KEYS[e.key];
    if (!how) return;
    e.preventDefault();
    go(how);
  };

  const r = d && rangeAt(d, i);
  const src = d && (r ? d.sources[r.source] : d.sources[d.main]);
  const text = src?.text ?? "";
  const coloured = useColoured(text, GRAMMAR[lang]);
  const mark = r && { from: r.from, to: r.to,
    className: r.last ? "rng last" : "rng" };
  const pre = useRef<HTMLPreElement>(null);
  useLayoutEffect(() => {
    const box = pre.current;
    const m = box?.querySelector("mark");
    if (!box || !m) return;
    const top = m.getBoundingClientRect().top -
      box.getBoundingClientRect().top + box.scrollTop;
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight -
      m.getBoundingClientRect().height) {
      box.scrollTop = Math.max(0, top - box.clientHeight / 3);
    }
  }, [mark?.from, mark?.to, coloured, lang]);
  const file = (r?.file ?? "").split("/").pop() ||
    (lang === "sol" ? "Arcade.sol" : "arcade.fe");
  const note = !d ? "" : !r ? "no source range yet"
    : r.last ? "compiler-generated code: the last range, muted"
      : src?.lib ? `library code (${src.lib})` : "";
  // (ready: soldb loaded, the step drawn, and, with a state, its rows)
  const ready = !!d && (!d.capabilities.state || state?.key === key);
  // (the last step's, until this one's come: nothing moves)
  const vars = state?.vars ?? [];
  const w = why[lang] ?? {};
  const s = d?.steps;
  // (a value on one line, cut short; pointed at or focused, whole, over
  // the rows below: nothing moves)
  const row = (name: string, value: string, type = "") =>
    <li key={name} data-path={name}><div className="row" tabIndex={0}>
      <span className="name">{name}</span>
      <span className="type">{type}</span>
      <span className="val"><span>{value}</span></span></div></li>;

  return <div className="lens soldb" data-figure="real-debugger"
    data-ready={ready || undefined} data-lang={lang}>
    <div className="sbar">
      <div className="picker" role="radiogroup" aria-label="Language">
        {LANGS.map(([k, t]) => <button key={k} type="button" role="radio"
          data-lang={k} aria-checked={k === lang ? "true" : "false"}
          onClick={() => setLang(k)}>{t}</button>)}
      </div>
      <div className="moves" tabIndex={0} onKeyDown={onKey}
        aria-label="soldb's steps">
        <span className="mctl">
          {([["first", "The transaction's first line", "⏮"],
            ["prev-line", "The contract's previous line", "«"],
            ["prev", "The previous step", "◀"],
            ["next", "The next step", "▶"],
            ["next-line", "The contract's next line", "»"],
            ["last", "The transaction's end", "⏭"]] as const).map(
            ([how, label, t]) => <button key={how} type="button"
              className="btn" data-move={how} aria-label={label}
              disabled={!d || moveOf(d, i, how) === i}
              onClick={() => go(how)}>{t}</button>)}
        </span>
        <span className="mat" data-step={d ? i : ""}>{error
          ? <span className="error">{error}</span> : !s
          ? <span className="muted">{progressText(loading.files,
            loading.phase)}</span>
          : <>step <b>{i}</b> of {s.n - 1} · <code>{s.ops[i]}</code>
            {s.lineNo[i] > 0 && <> · line {s.lineNo[i]}</>}</>}</span>
      </div>
    </div>
    <div className="code" data-area="code">
      <p className="codehead"><span className="srcfile">{file}</span>{" "}
        <span className="codenote">{note}</span></p>
      <pre ref={pre} className={`src codesrc${coloured ? " coloured"
        : ""}`}>{d ? lines(text, coloured, mark ? { mark } : {}) : ""}</pre>
    </div>
    <div className="sside" data-area="side">
      <section aria-label="soldb at this step">
        <h3 className="view-name">soldb at this step</h3>
        <ul className="tree srows">{s ? <>
          {row("function", s.functions[i] ?? "none named")}
          {row("call depth", String(s.depths[i]))}
          {row("pc", String(s.pcs[i]))}
          {row("op", s.ops[i])}</> : null}</ul>
      </section>
      <section aria-label="State">
        <h3 className="view-name">State</h3>
        {d && !d.capabilities.state
          ? <p className="muted small">{w.variables ??
            "soldb reads no state here."}</p>
          : <ul className="tree srows sstate">{vars.map((v) =>
            row(v.name, v.value, v.type))}</ul>}
        {d && w.locals && <p className="muted small">{w.locals}</p>}
      </section>
      <section aria-label="Call stack">
        <h3 className="view-name">Call stack</h3>
        <p className="muted small">{d ? w.callStack ?? "" : ""}</p>
      </section>
    </div>
  </div>;
}
