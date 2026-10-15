// A dump of one location at one timeline point (vanilla panel.js
// renderPanel, wordHtml, paint): one word a row, in address order, each
// byte linked to the value that owns it
import { useFitDump } from "./fit";
import { useEdges } from "./PointerYaml";
import { CHEV } from "./Tree";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { drawOverlays, type ViewData } from "./overlays";
import { drawNotes, hoverNotes } from "./notes";
import { paintView, useRevealed } from "./reveal";
import { touch, UNHOVER } from "./unhover";
import {
  cellsOf, notesOf, onChainNames, unitsOf,
} from "../engine/annotated";

// one drawing of a box's overlays per commit, however many of its dumps
// rendered (the pending mark lives on the box's element)
// (while a view transition animates, its new state is the live page:
// the overlays wait for its end, then draw; ui/transition.ts)
function schedule(root: HTMLElement & { _overlays?: boolean }) {
  if (root._overlays) return;
  root._overlays = true;
  queueMicrotask(() => afterTransition(() => {
    root._overlays = false;
    if (root.isConnected) drawOverlays(root);
  }));
}
import type {
  CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, ReactElement,
} from "react";
import type {
  ByteKey, Colour, Filter, Hex, Layout, Light, Location, Row, Target,
  TimelinePoint,
} from "../engine/types";
import { byteKey, short } from "../engine/hex";
import {
  decodingOf, useDecoded, useLayout, useLens, useLensState, useLight, useLink,
  usePointAt, hush, resolveRef,
} from "./hooks";
import { blockOf, resolveTarget } from "../engine/target";
import { noLight, retint } from "../engine/light";
import { relClass } from "../engine/related";
import { afterTransition, vtName } from "./transition";
import { centring, glide, stopGlide } from "./scroll";
import { readWritten } from "../engine/timeline";
import {
  addressText, addressing, hex4, nextRow, rowBytes,
} from "../engine/location";
import type { DataAt, DataRef, Display, LinkId, ViewId } from "./types";
import { exiting, outside } from "./types";

const TINTS = 5;
const PLAIN = 1n << 32n;

// "slot 1" or "slot 0x7230…a723"
const slotRef = (s: Hex) => BigInt(s) < PLAIN ? `slot ${BigInt(s)}`
  : `slot ${short(s)}`;
const tail = (s: Hex) => `…${s.slice(-4)}`;
// accounts[0xf39fd6…92266].nonce -> accounts[0xf39f…2266].nonce
const shortKeys = (path: string) =>
  path.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`);

// Runs of bytes with the same owners, in one word
function groups(owners: string[][]) {
  const out: { key: string; owners: string[]; from: number; to: number }[]
    = [];
  owners.forEach((list, i) => {
    const key = list.join("|");
    const last = out[out.length - 1];
    if (last && last.key === key) last.to = i;
    else out.push({ key, owners: list, from: i, to: i });
  });
  return out;
}

// 32 byte cells as four groups of eight
function Octets({ cells }: { cells: ReactElement[] }) {
  return <>{[0, 8, 16, 24].map((k) =>
    <span key={k} className="oct">{cells.slice(k, k + 8)}</span>)}</>;
}

function Ruler() {
  return <div className="ruler" aria-hidden="true"><div className="bytes">
    <Octets cells={Array.from({ length: 32 }, (_, i) =>
      <span key={i} className="b">{i % 8 === 0 ? i : ""}</span>)} />
  </div></div>;
}

// An abbreviated dump's words (Display `abbreviate`): each word's cells
// on one line, its first byte, a "…" cell, its last ABBR_LOW: the cells
// between cut (hidden), the "…" in the light of a lit byte it stands for
// (else a consulted one's, else a zero's): no lit byte hidden
const ABBR_LOW = 4;
export function fitAbbr(v: HTMLElement) {
  const words = [...v.querySelectorAll<HTMLElement>(".word > .bytes")]
    .map((b) => ({ b, el: b.querySelector<HTMLElement>(":scope > .el"),
      cells: [...b.querySelectorAll<HTMLElement>(".oct > .b")] }))
    .filter((w) => w.el && w.cells.length);
  for (const w of words) {
    w.el!.hidden = true;
    for (const c of w.cells) c.hidden = false;
    // (and its reveal's part, ui/reveal.ts: none)
    delete w.el!.dataset.r;
    delete w.el!.dataset.unit;
    w.el!.removeAttribute("style");
  }
  words.forEach((w) => {
    // (its first byte and its last ABBR_LOW shown, the rest cut)
    const gone = w.cells.slice(1, w.cells.length - ABBR_LOW);
    const n = gone.length;
    if (!n) return;
    gone.forEach((c) => c.hidden = true);
    const has = (x: string) => gone.find((c) => c.classList.contains(x));
    const like = has("hl") ?? has("rel") ?? gone[0];
    // (its caps: a lit run that starts among them starts at it; one
    // that ends among them, ends at it)
    const lit = like.classList.contains("hl");
    const caps = lit ? [gone.some((c) => c.classList.contains("hl") &&
      c.classList.contains("gs")) ? "gs" : "", gone[n - 1].classList
      .contains("ge") && gone[n - 1].classList.contains("hl") ? "ge" : ""]
      : [];
    w.el!.className = ["b", "el", ...[...like.classList].filter((x) =>
      !/^(b|gs|ge|at|at-s|at-e|jd|chg)$/.test(x)), ...caps]
      .filter(Boolean).join(" ");
    // (an annotated value's: its unit, its place in the reveal, as the
    // byte it stands for, so the reveal paints it with them)
    if (lit && like.dataset.r !== undefined) {
      w.el!.dataset.r = like.dataset.r;
      if (like.dataset.unit !== undefined) {
        w.el!.dataset.unit = like.dataset.unit;
      }
      w.el!.setAttribute("style", like.getAttribute("style") ?? "");
    }
    w.el!.hidden = false;
  });
}

// The rows' bytes as one run, `per` bytes a line (Display "flow"): each
// line's address, where the location is a segment (its offset)
function Flow({ rows, loc, snap, per, annot }: { rows: Row[];
  loc: Location; snap?: TimelinePoint["snapshot"]; per: number;
  // (the annotated layer: each row's bytes, as a Word's)
  annot?: (row: Hex) => Annot }) {
  const at0 = rows.flatMap((r) => {
    const bs = rowBytes(snap, loc, r.address);
    const a = annot?.(r.address);
    return bs.map((b, i) => ({ b, row: r.address, c: a?.cells[i] ?? null,
      on: !!a?.on, hover: a?.hover ?? null }))
      .filter((x): x is typeof x & { b: string } => x.b !== undefined);
  });
  const all = at0.map((x) => x.b);
  // (lit as a Word's bytes are, a run of one value rounded at its ends)
  const an = (j: number) => {
    const x = at0[j];
    if (!x.c) return "";
    // (a region's bytes one run, its own caps: the inspector's per leaf)
    const same = (k: number) => at0[k]?.c?.unit === x.c!.unit &&
      at0[k]?.c?.g === x.c!.g && at0[k]?.row === x.row;
    return ` hl pk${x.c.k}${!same(j - 1) ? " gs" : ""}${
      !same(j + 1) ? " ge" : ""}${x.hover !== null && x.hover !== x.c.unit
      ? " muted" : ""}`;
  };
  const data = (j: number) => at0[j].c ? { "data-unit": at0[j].c!.unit,
    "data-row": at0[j].row, ...cellVars(at0[j].c!) } : {};
  const from = rows.length ? Number(BigInt(rows[0].address)) : 0;
  const lines: ReactElement[] = [];
  for (let k = 0; k * per < all.length; k++) {
    const at = from + k * per;
    lines.push(<div key={k} className={`wrow${k % 2 ? " zb" : ""}`}>
      <span className="addr"><span className="a">
        {addressing(loc) === "offset" ? hex4(at) : ""}</span></span>
      <div className="word"><div className="bytes">
        {all.slice(k * per, (k + 1) * per).map((b, i) =>
          <span key={i} className={`b${b === "00" ? " z" : ""}${
            an(k * per + i)}`} {...data(k * per + i)}>{b}</span>)}
      </div></div></div>);
  }
  return <div style={{ "--per": per } as CSSProperties}>{lines}</div>;
}

// an owner id's label: a value's path, or "<path> (length)" for its
// length part or an array's own word
const ownerLabel = (id: string, composite: boolean) =>
  id.endsWith("#length") || composite
    ? `${shortKeys(id.replace(/#[a-z]+$/, ""))} (length)` : shortKeys(id);
// a lit byte's colour class, from its first owner with one
// (or the byte's own colour, a walkthrough's: another rule's words)
export const pkClass = (k: Colour | undefined) => k === undefined || k === 0
  ? "" : `pk${k}`;
const pick = (light: Light, ids: string[], key?: ByteKey) => {
  const k = (key ? light.byteColours?.get(key) : undefined) ?? ids.map((id) =>
    light.colours.get(id.replace(/#[a-z]+$/, "")))
    .find((x) => x !== undefined);
  return { k, cls: pkClass(k) };
};

// The owners' tints of a dump: in byte order, row by row, each owner
// its own (the earlier point's layout first: vanilla renderLocation); a
// tint per owner, never per row, so a value that goes on to the next row
// keeps its colour
const tints = new WeakMap<Layout[], Map<string, number>>();
function tintsOf(ls: Layout[], loc: Location) {
  const got = tints.get(ls);
  if (got) return got;
  const tint = new Map<string, number>();
  for (const x of ls) {
    for (const r of x.rows) {
      for (let i = 0; i < 32; i++) {
        for (const id of x.cover.get(byteKey(loc, r.address, i)) ?? []) {
          if (!tint.has(id)) tint.set(id, tint.size);
        }
      }
    }
  }
  tints.set(ls, tint);
  return tint;
}

// (a row whose second half is past the segment's end: on 16 bytes a
// line, no second line of dots)
const half = (mine: (string | undefined)[]) =>
  mine.slice(16).every((b) => b === undefined) && mine[0] !== undefined;

// (each byte of a row, in the annotated layer: its unit, its child
// colour, its fade's delay; `on`: revealed, lit; `muted`: another unit
// is hovered)
// (`g`: its region, the value's leaf (or part) that owns it: its own run
// of caps, as a lit selection's leaves have)
type Cell = { unit: number; k: number; r: number; o: number; g: string };
type Annot = { on: boolean; hover: number | null; cells: (Cell | null)[] };
// (a byte's reveal: its value's place in the sequence, `r` (ui/reveal.ts
// writes its --tf, the value's progress); `o`, its place in its value, 0
// to 1, for the sweep)
const cellVars = (c: Cell) => ({ "data-r": c.r,
  style: { "--o": c.o.toFixed(3) } as CSSProperties });
function Word({ l, ls, loc, row, mine, theirs, side, pair, name, light,
  groupsOf, bare, abbreviate, annot }: {
  l: Layout; ls: Layout[]; loc: Location; row: Hex;
  mine: (string | undefined)[]; theirs: (string | undefined)[];
  side?: string; pair?: boolean; name: string; light: Light;
  groupsOf: (id: string) => boolean; bare?: boolean;
  abbreviate?: number; annot?: Annot }) {
  // (the annotated layer: revealed, every value lit at once, as a lit
  // composite's children are: its bytes in its child colour, a run of
  // them rounded at its ends; hovering one, the others muted, as the
  // inspector mutes a selection's other children)
  const an = (i: number) => {
    const c = annot?.cells[i];
    if (!c) return "";
    const same = (j: number) => annot!.cells[j]?.unit === c.unit &&
      annot!.cells[j]?.g === c.g;
    return ` hl pk${c.k}${!same(i - 1) ? " gs" : ""}${
      !same(i + 1) ? " ge" : ""}${annot!.hover !== null &&
      annot!.hover !== c.unit ? " muted" : ""}`;
  };
  const unit = (i: number) => annot?.cells[i] ? {
    "data-unit": annot.cells[i]!.unit, ...cellVars(annot.cells[i]!) } : {};
  // (the word: its bytes, drawn as every word's are; abbreviated, the
  // same cells on one line, its low end at the right edge, the cells that
  // do not fit cut from the left after layout, a "…" cell in their place
  // that takes a cut lit byte's light: no lit byte hidden; fitAbbr)
  const word = (cells: ReactElement[]) => {
    if (abbreviate === undefined) {
      return <div className={`word${half(mine) ? " half" : ""}`}
        data-side={side} data-slot={row}>
        <div className="bytes"><Octets cells={cells} /></div></div>;
    }
    return <div className="word" data-side={side} data-slot={row}>
      <div className="bytes">
        {/* (a row past the stack's top, a replay's reserve: empty) */}
        {mine.every((b) => b === undefined) ? "\u00a0" : <><span
          className="b el" aria-hidden="true" hidden>…</span><Octets
          cells={cells} /></>}</div></div>;
  };
  if (bare) {
    return word(mine.map((b, i) =>
      <span key={i} className={`b${b === undefined ? " past"
        : b === "00" ? " z" : ""}${an(i)}`} {...unit(i)}>{b ?? "··"}
      </span>));
  }
  const ownersIn = (x: Layout) => Array.from({ length: 32 }, (_, i) =>
    x.cover.get(byteKey(loc, row, i)) ?? []);
  const owners = ownersIn(l);
  // each owner's tint: one per owner, wherever its bytes fall (a region
  // that crosses rows keeps it), the same in every view of a pair
  const tint = tintsOf(ls, loc);
  const at = light.at?.row === row && light.at.location === loc
    ? light.at : undefined;
  const cells: ReactElement[] = [];
  for (const g of groups(owners)) {
    const label = g.owners.map((id) => ownerLabel(id, groupsOf(id)))
      .join(", ");
    const range = g.from === g.to ? `byte ${g.from}`
      : `bytes ${g.from} to ${g.to}`;
    for (let i = g.from; i <= g.to; i++) {
      const hl = light.bytes.has(byteKey(loc, row, i));
      const isAt = !!at && i >= at.from && i <= at.to;
      const cls = ["b", g.owners.length
        ? `t${tint.get(g.owners[0])! % TINTS}` : "free"];
      if (i === g.from) cls.push("gs");
      // (the same value under it, on a word's second line: joined)
      if (i < 16 && g.owners.length && owners[i + 16]?.[0] === g.owners[0]) {
        cls.push("jd");
      }
      if (i === g.to) cls.push("ge");
      if (mine[i] === undefined) cls.push("past");
      else if (mine[i] === "00") cls.push("z");
      if (mine[i] !== undefined && mine[i] !== theirs[i]) cls.push("chg");
      if (hl) {
        const { k, cls: c } = pick(light, g.owners, byteKey(loc, row, i));
        cls.push("hl");
        if (c) cls.push(c);
        // (the selection's own colour, 0, never mutes; a walkthrough's
        // echo of its focus does)
        if ((light.focus !== undefined && k && k !== light.focus) ||
          light.dim?.has(byteKey(loc, row, i))) {
          cls.push("muted");
        }
      } else if (light.relBytes?.has(byteKey(loc, row, i))) {
        // (a consulted value's: the related treatment)
        cls.push(relClass(light, g.owners) ?? "rel pkn");
      }
      if (isAt) cls.push("at");
      // (bytes no value owns, pointed at: a neutral light)
      if (isAt && light.unmapped && !g.owners.length) cls.push("fl");
      // (one outline a run, in each group of eight)
      if (isAt && (i === at.from || i % 8 === 0)) cls.push("at-s");
      if (isAt && (i === at.to || i % 8 === 7)) cls.push("at-e");
      const first = i === g.from && g.owners.length > 0;
      cells.push(<span key={i} className={cls.join(" ")} data-i={i}
        data-g={`${g.from}-${g.to}`}
        data-owners={g.owners.length ? g.owners.join("|") : undefined}
        {...(first ? { tabIndex: 0, role: "button",
          "aria-label":
            `${label}, ${range} of ${name}${pair ? `, ${side}` : ""}` }
          : {})}>
        {mine[i] ?? "··"}</span>);
    }
  }
  return word(cells);
}

// `title`, `when` (its moment's label), `compare` (another moment:
// changed bytes, the slots' facts): the lens's choice (Lens.tsx)
export function Dump(p: { id: ViewId; location: Location; data: DataRef;
  filter?: Filter; link?: LinkId; domId?: string; title?: string;
  when?: string; compare?: DataRef; display?: Display }) {
  const disp = p.display ?? {};
  const bare = !!disp.bare;
  const flow = disp.density === "flow";
  // (a page shut while a move runs, held so (below): its rows as at the
  // step it was shut on, not laid out again at each step; laid out as
  // the moment has them once the move rests)
  const { project: proj } = useLens();
  const was = useRef<boolean | null>(null);
  const moving = useLensState((s) => !!s.playing);
  const resolved = useLensState((s) => {
    const a = resolveRef(p.data, s, proj);
    return a ? `${a.decoding}\n${a.point}` : "";
  });
  const frozen = useRef<DataAt | undefined>(undefined);
  const hold = !!disp.edges && moving && was.current === false &&
    !!frozen.current;
  if (!hold && resolved && `${frozen.current?.decoding}\n${
    frozen.current?.point}` !== resolved) {
    const [decoding, point] = resolved.split("\n");
    frozen.current = { decoding, point };
  }
  const data: DataRef = hold ? frozen.current! : p.data;
  const { l, only } = useLayout(p.id, p.filter, hold ? data : undefined,
    p.compare);
  const { l: lThere0 } = useLayout(p.id, p.filter, p.compare, data);
  const lThere = p.compare ? lThere0 : undefined;
  const hereAt = usePointAt(data);
  const thereAt = usePointAt(p.compare);
  const here = hereAt?.p;
  const snap = here?.snapshot;
  const otherPoint = thereAt?.p;
  const lit00 = useLight(p.id, p.filter, hold ? data : undefined,
    p.compare);
  const lit0 = useMemo(() => retint(lit00, disp.tint), [lit00, disp.tint]);
  // (a second reading of the same storage: its layout and its light, in
  // its own colour; its rows merged in, its lit bytes outlined)
  const { l: l2 } = useLayout(p.id, p.filter, disp.second?.data);
  const lit2 = useLight(p.id, p.filter, disp.second?.data);
  const d2 = useDecoded(disp.second?.data);
  const light2 = useMemo(() => retint(lit2, disp.second?.tint),
    [lit2, disp.second?.tint]);
  const [walkLink] = useLink(p.link);
  // (a walkthrough walks the moment shown: the dump of the one before
  // it stays unlit meanwhile)
  const earlier = "moment" in p.data && p.data.moment === "previous";
  const light = bare || (earlier && walkLink.walk) ? noLight : lit0;
  const lightMain = light;
  const relOn = useLensState((s) => s.related !== undefined);
  // what the compared point lights (a slot lit there only: "only"; none
  // in a walkthrough, which walks one side: vanilla panel.js)
  const there0 = useLight(p.id, p.filter, p.compare, data);
  const there = walkLink.walk && !lit0.rest ? noLight : there0;
  const [link, setLink] = useLink(p.link);
  const d = useDecoded(data);
  const lens = useLens();
  const foreign = !!d && !!decodingOf(lens, d.decoding)?.foreign;
  const foreign2 = !!d2 && !!decodingOf(lens, d2.decoding)?.foreign;
  const groupsOf = (id: string) => !!d?.byPath.get(id)?.children;
  const title = p.title ?? "Storage";
  const label = p.location[0].toUpperCase() + p.location.slice(1);
  // (which of two moments this is: the earlier, "before", its changed
  // bytes in the old colour; else, and at one moment, "after")
  const order = hereAt && thereAt && hereAt.i < thereAt.i ? "before"
    : "after";

  // what the pointer is on (vanilla main.js target): a run of bytes, or
  // a row's address; as a target that follows the blocks
  const hit = (el: EventTarget): Target | null => {
    const e = el as Element;
    const c = e.closest?.(".b[data-g]") as HTMLElement | null;
    const w = c?.closest(".word") as HTMLElement | null;
    if (c && w) {
      const [from, to] = c.dataset.g!.split("-").map(Number);
      return { bytes: { row: w.dataset.slot as Hex, from, to,
        location: p.location } };
    }
    const a = e.closest?.(".wrow[data-slot] > .addr");
    if (a) {
      return { row: (a.parentElement as HTMLElement).dataset.slot as Hex,
        location: p.location };
    }
    return null;
  };
  // What a point stands for (the one resolver for the hover, a click and
  // the cursor): a byte, itself; in a gap between two bytes of one value
  // (or of one run no value owns), the byte before it, so the gap is
  // the value's; so too between a word's two lines, where the value goes
  // on to the next; elsewhere in a row but on none of its bytes (a gap
  // between values, its ends): the row, its slot hover; else nothing
  const spot = (el: EventTarget, x?: number, y?: number):
    Element | "row" | null => {
    const e = el as Element;
    if (e.closest?.(".b[data-g]") || e.closest?.(".wrow[data-slot] > .addr")) {
      return e;
    }
    const r = e.closest?.(".wrow[data-slot]") as HTMLElement | null;
    if (!r || !me.current?.contains(r) || x === undefined ||
      y === undefined) return null;
    const cells = [...r.querySelectorAll<HTMLElement>(".b[data-g]")]
      .map((c) => [c, c.getBoundingClientRect()] as const);
    const own = (c?: HTMLElement) => c?.dataset.owners?.split("|")[0];
    // (between a word's two lines, under a byte of one value whose next
    // line goes on with it: the value's)
    const above = cells.filter(([, b]) => b.bottom <= y && x >= b.left &&
      x < b.right).at(-1);
    const below = cells.find(([, b]) => b.top >= y && x >= b.left &&
      x < b.right);
    if (above && below && own(above[0]) &&
      above[0].classList.contains("jd") &&
      below[1].top - above[1].bottom < 4) return above[0];
    // (the bytes on the pointer's line: a phone's word has two)
    const line = cells.filter(([, b]) => y >= b.top && y < b.bottom);
    const left = line.filter(([, b]) => b.right <= x).at(-1)?.[0];
    const right = line.find(([, b]) => b.left >= x)?.[0];
    if (left && right && own(left) === own(right) && (own(left) ||
      left.dataset.g === right.dataset.g)) return left;
    return "row";
  };
  // (a row no value owns, its gutter or its gaps pointed at: its bytes,
  // one run no value owns, as unmapped bytes in a row that has values)
  const unowned = (h: Target): Target => {
    if (h.row === undefined || !l) return h;
    const r = l.rows.find((x) => x.address === h.row);
    return r && !r.what.length && !Array.from({ length: 32 }, (_, i) =>
      l.cover.get(byteKey(p.location, h.row as Hex, i))).some((c) =>
      c?.length) ? { bytes: { row: h.row, from: 0, to: 31,
        location: p.location } } : h;
  };
  const xy = (e: { target: EventTarget }) => "clientX" in e
    ? [(e as PointerEvent).clientX, (e as PointerEvent).clientY] as const
    : [undefined, undefined] as const;
  const target = (e: { target: EventTarget }, sel: string | null) => {
    const at = spot(e.target, ...xy(e));
    const r = (e.target as Element).closest?.(".wrow[data-slot]") as
      HTMLElement | null;
    const h = at === "row" ? { row: r!.dataset.slot as Hex,
      location: p.location }
      : at ? hit(at) : null;
    return h && d && l ? resolveTarget(unowned(h), sel, d.byPath, l)
      : null;
  };
  // (the cursor in a gap: its value's bytes' cursor, by the same rules)
  const cursorAt = (e: PointerEvent) => {
    const r = (e.target as Element).closest?.(".wrow[data-slot]") as
      HTMLElement | null;
    if (!r) return;
    const at = spot(e.target, e.clientX, e.clientY);
    const c = at && at !== "row" && at !== e.target &&
      !(e.target as Element).closest(".b, .addr")
      ? getComputedStyle(at).cursor : "";
    if (r.style.cursor !== c) r.style.cursor = c;
  };
  const still = lens.spec.hover === false;
  const point = (e: PointerEvent | { target: EventTarget }) => {
    if ("clientX" in e) cursorAt(e);
    if (still || lens.store.get().hush || touch.on) return;
    setLink((s) => {
      const t = target(e, s.selection);
      return JSON.stringify(s.hover) === JSON.stringify(t) ? s
        : { ...s, hover: t };
    });
  };
  // a byte selects its value's block (by keys: its value), or, when it
  // is the selected one, clears; a variable's own slot selects it; a
  // row's address, inside a selected composite: the child whose block
  // holds all of the slot's values
  const act = (el: EventTarget, keys = false) => {
    const h0 = hit(el);
    const h = h0 && unowned(h0);
    if (!h || !d || !l) return false;
    // (on what the selection does not light: it ends, and the hover
    // waits for the pointer to move: hush)
    const lit = h.row !== undefined
      ? [...Array(32).keys()].some((i) => lit0.bytes.has(byteKey(p.location,
        h.row as Hex, i)))
      : !!h.bytes && lit0.bytes.has(byteKey(p.location, h.bytes.row,
        h.bytes.from));
    // (what the selection consulted is inside it too: its bytes, or a
    // row it consulted, an anchor's among them)
    const row = (h.row ?? h.bytes?.row) as Hex | undefined;
    const consulted = !!row && (!!lit0.related?.has(row) ||
      (h.bytes ? !!lit0.relBytes?.has(byteKey(p.location, h.bytes.row,
        h.bytes.from)) : [...Array(32).keys()].some((i) =>
        lit0.relBytes?.has(byteKey(p.location, row, i)))));
    // (an anchor's bytes, owned by none: the variable it anchors)
    const anchor = row ? lit0.anchors?.get(row) : undefined;
    let cleared = false;
    setLink((s) => {
      const sel = s.selection;
      if (outside(s, lit, consulted) && !keys) {
        cleared = true;
        return { ...s, selection: null, hover: null };
      }
      if (h.row !== undefined) {
        const t = resolveTarget(h, sel, d.byPath, l);
        if (t.path) return { ...s, hover: null,
          selection: t.path === sel ? null : t.path };
        if (keys || !sel) return s;
        const ids = new Set(Array.from({ length: 32 }, (_, i) =>
          l.cover.get(byteKey(p.location, h.row as Hex, i))?.[0])
          .filter((x): x is string => !!x)
          .map((x) => blockOf(x.replace(/#[a-z]+$/, ""), sel, d.byPath)));
        const [only] = ids;
        return ids.size === 1 && only !== sel
          ? { ...s, hover: null, selection: only } : s;
      }
      // (in a walkthrough, exactly the value clicked: no drilling)
      const t = resolveTarget(h, keys || s.walk ? null : sel, d.byPath, l);
      const q = t.path ?? (consulted ? anchor : undefined) ?? null;
      // (a click on the selection, which clears it: its hover at once,
      // vanilla rehover; with nothing selected, on bytes no value owns:
      // nothing changes, the hover stays)
      return q && q !== sel ? { ...s, hover: null, selection: q }
        : { ...s, selection: null, hover: resolveTarget(h, null, d.byPath, l) };
    });
    if (cleared) hush(lens.store);
    return true;
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") &&
      (e.target as Element).closest(".b[tabindex], .addr")) {
      e.preventDefault();
      act(e.target, true);
    }
  };

  const me = useRef<HTMLDivElement>(null);
  // (all-zero rows folded into the gaps, when the display asks: a row
  // after a folded one starts after a gap)
  const kept = useMemo(() => {
    let all: (Row & { second?: boolean })[] = l?.rows ?? [];
    if (disp.second && l2) {
      const mine = new Set(all.map((r) => r.address));
      all = [...all, ...l2.rows.filter((r) => !mine.has(r.address))
        .map((r) => ({ ...r, second: true }))].sort((a, b) =>
        BigInt(a.address) < BigInt(b.address) ? -1 : 1)
        .map((r, k, xs) => ({ ...r, gapBefore: k === 0
          ? BigInt(r.address) !== 0n
          : BigInt(r.address) !== nextRow(p.location, xs[k - 1].address) }));
    }
    // (a figure's few rows: no "⋯" before the first)
    if (disp.ends === false && all[0]?.gapBefore) {
      all = [{ ...all[0], gapBefore: false }, ...all.slice(1)];
    }
    if (!disp.foldZero) return all;
    const zero = (r: (typeof all)[number]) => rowBytes(snap, p.location,
      r.address).every((b) => b === undefined || b === "00");
    const out: typeof all = [];
    let folded = false;
    for (const r of all) {
      if (zero(r)) {
        folded = true;
        continue;
      }
      out.push(folded || r.gapBefore ? { ...r, gapBefore: true } : r);
      folded = false;
    }
    return out;
  }, [l, l2, disp.second, disp.ends, disp.foldZero, snap, p.location]);
  // (a stack's page: a row for each item it has now, none past its top;
  // the rows past it, the scene's deepest, kept as paper and gutter
  // under them, so the page's height stays: debugger.css)
  const stackPage = !!disp.edges && p.location === "stack";
  // (memory's and calldata's pages too: the words they have now, none
  // past their end; the page's height the words of the whole scene's,
  // `data-reserve` (lenses/stepper.tsx), the room under them paper and
  // the gutter, no scroll: debugger.css)
  const wordPage = !!disp.edges &&
    (p.location === "memory" || p.location === "calldata");
  const rows = useMemo(() => !stackPage && !wordPage ? kept
    : kept.filter((r) => rowBytes(snap, p.location, r.address)
      .some((b) => b !== undefined)),
  [kept, stackPage, wordPage, snap, p.location]);
  const past = kept.length - rows.length;
  useFitDump(me, true, rows.length);
  // (the reserve: its words' height now, and a word's past their end
  // (one drawn unseen, .reserve) for each; none in the related view,
  // its rows its own)
  const pastRow = wordPage && !only && past > 0
    ? kept.find((r) => !rows.includes(r)) : undefined;
  useLayoutEffect(() => {
    const v = me.current;
    const box = v?.querySelector<HTMLElement>(".pagebox > .rows");
    if (!v || !wordPage) return;
    const kids = box ? [...box.children] as HTMLElement[] : [];
    const row = past === 0 ? 0 : v.querySelector<HTMLElement>(
      ".pagebox > .reserve > .wrow")?.getBoundingClientRect().height;
    if (only || !kids.length || row === undefined) {
      v.removeAttribute("data-reserve");
      return;
    }
    const body = kids[kids.length - 1].getBoundingClientRect().bottom -
      kids[0].getBoundingClientRect().top;
    const h = String(Math.ceil(body + past * row));
    if (v.dataset.reserve !== h) v.dataset.reserve = h;
  });

  // the annotated layer (display `annotate`): the values here, each in
  // its tint, and the popovers that say what they are; keys by their
  // on-chain names, from the scene's own decoding. Hand-written
  // pointers' (the stack's): a popover a run of rows, as ever
  const annot = !!disp.annotate;
  const own = useDecoded(annot ? { decoding: "$scene", moment: "current" }
    : undefined);
  const hand = annot && !!d && decodingOf(lens, d.decoding)?.provenance ===
    "hand-written";
  const layer = useMemo(() => {
    if (!annot || !d || !l || !own) return undefined;
    const names = onChainNames(own);
    const units = unitsOf(d, l);
    // (the stack's: one card an item, beside it; memory's, one a run)
    const notes = notesOf(d, l, units, rows, { names, perRun: hand,
      values: disp.abbreviate === undefined,
      each: disp.abbreviate !== undefined });
    // (the reveal's sequence: the values in reading order, by their
    // first byte shown; each byte after the one before it in its value)
    const first = units.map(() => Infinity);
    const ord = new Map<Hex, number[]>();
    const seen = units.map(() => 0);
    rows.forEach((r, k) => {
      const cs = cellsOf(units, l, r.address);
      ord.set(r.address, cs.map((u, i) => {
        if (u === null) return 0;
        first[u] = Math.min(first[u], k * 32 + i);
        return seen[u]++;
      }));
    });
    const rank = units.map((_, i) => units.map((_, j) => j).sort((a, b) =>
      first[a] - first[b] || a - b).indexOf(i));
    return { units, notes, rank, ord, seen };
  }, [annot, d, l, own, rows, hand, disp.abbreviate]);
  const revealed = useRevealed();
  // (a row's bytes in the annotated layer)
  const annotOf = layer && l ? (row: Hex): Annot => ({ on: revealed,
    hover, cells: cellsOf(layer.units, l, row).map((u, i) => u === null
      ? null : { unit: u, k: layer.units[u].k as number,
        r: layer.rank[u], o: layer.seen[u] > 1 ? (layer.ord.get(row)?.[i]
          ?? 0) / (layer.seen[u] - 1) : 0,
        g: (l.cover.get(byteKey(l.location, row, i)) ?? []).join("|") }) })
    : undefined;
  // (every value active, lit with its caps, as a selection's children
  // are, as far as the reveal has come (raw.css); Display annotateFill
  // "hover": the plain fill, no caps)
  const active = annot && disp.annotateFill !== "hover";
  // the value the pointer is on (a byte of it, or its popover): the
  // others muted, their popovers the light, kept kind
  const [hover, setHover] = useState<number | null>(null);
  const hoverRef = useRef<number | null>(null);
  useEffect(() => {
    if (!revealed) setHover(null);
  }, [revealed]);
  // (every hover ended: unhover.ts)
  useEffect(() => {
    const off = () => setHover(null);
    addEventListener(UNHOVER, off);
    return () => removeEventListener(UNHOVER, off);
  }, []);
  const hovering = annot && revealed && !still ? {
    onPointerOver: (e: PointerEvent) => {
      if (e.pointerType === "touch") return setHover(null);
      const t = e.target as Element;
      const u = t.closest<HTMLElement>("[data-unit]")?.dataset.unit ??
        t.closest<HTMLElement>(".pop.note")?.dataset.units?.split(" ")[0];
      setHover(u === undefined ? null : +u);
    },
    onPointerLeave: () => setHover(null) } : {};
  useLayoutEffect(() => {
    const v = me.current;
    if (!v || !layer) return;
    let cards: ResizeObserver | undefined;
    // (an observer's redraw, after its round: a redraw inside one sizes
    // what it observes, a loop the browser reports; by a timer, not an
    // animation frame, which a frame off screen may not get)
    let queued: ReturnType<typeof setTimeout> | undefined;
    const later = () => {
      clearTimeout(queued);
      queued = setTimeout(() => draw(), 0);
    };
    const draw = () => {
      if (!v.isConnected) return;
      drawNotes(v, layer.notes, layer.units, layer.notes.map((n) =>
        Math.min(...n.units.map((u) => layer.rank[u]))));
      // (a card whose size changes after (its type fitted to the cells
      // later): drawn again)
      cards?.disconnect();
      cards = typeof ResizeObserver === "undefined" ? undefined
        : new ResizeObserver(() => {
          if ([...v.querySelectorAll<HTMLElement>(".pop.note")].some((p) =>
            p.offsetWidth !== Number(p.dataset.w))) later();
        });
      v.querySelectorAll(".pop.note").forEach((p) => cards?.observe(p));
      paintView(v, true);
      hoverNotes(v, hoverRef.current);
    };
    draw();
    addEventListener("resize", draw);
    addEventListener("ethdebug:redraw", draw);
    // (and when its rows' size changes: the cell size fitted, the fonts)
    const ro = typeof ResizeObserver === "undefined" ? undefined
      : new ResizeObserver(later);
    // (and a byte's: the cell size, fitted after the first draw)
    for (const e of [v.querySelector(".rows"), v.querySelector(
      ".rows .word .b, .rows .word .ab")]) if (e) ro?.observe(e);
    let live = true;
    document.fonts?.ready.then(() => live && draw());
    // (a face the cards use loads later than the rows': again)
    document.fonts?.addEventListener?.("loadingdone", draw);
    return () => {
      live = false;
      document.fonts?.removeEventListener?.("loadingdone", draw);
      ro?.disconnect();
      cards?.disconnect();
      clearTimeout(queued);
      removeEventListener("resize", draw);
      removeEventListener("ethdebug:redraw", draw);
    };
  }, [layer]);
  // (after the popovers are drawn, and after each redraw: the hover's
  // look)
  hoverRef.current = hover;
  useLayoutEffect(() => {
    if (me.current) hoverNotes(me.current, hover);
    // (a render may make new bytes: their reveal written again)
    if (me.current && layer) paintView(me.current, true);
  });

  // (a figure's facts, by a decoding: a value's own name and value)
  const factsOf = (x: typeof d) => disp.facts && x ? { facts: (q: string) => {
    const n = x.byPath.get(q);
    return n ? { label: n.label, value: n.value?.text } : undefined;
  } } : {};
  // the overlays (popovers), over the dumps' box, once per render of any
  // of its dumps; again on resize and once the fonts are in (the labels
  // are fitted in them)
  // (a replay playing: none, until it stops, TimelineBar.tsx)
  const playing = useLensState((x) => !!x.playing);
  useLayoutEffect(() => {
    if (bare || playing) return;
    const v = me.current as (HTMLDivElement & { _data?: ViewData }) | null;
    if (v && l) {
      v._data = { light, there: p.compare ? there : undefined, l,
        ...factsOf(d) };
    }
    const root = v?.closest<HTMLElement>(".panel") ?? v?.parentElement;
    if (root) schedule(root);
  });
  useEffect(() => {
    if (bare) return;
    const again = () => {
      const v = me.current;
      const root = v?.closest<HTMLElement>(".panel") ?? v?.parentElement;
      if (root) schedule(root);
    };
    addEventListener("resize", again);
    // (and as its box changes width, a column opening or shutting: its
    // popovers laid out for the width it comes to, never a sliver)
    let w = me.current?.getBoundingClientRect().width ?? 0;
    const ro = typeof ResizeObserver === "undefined" ? null
      : new ResizeObserver(() => {
        const now = me.current?.getBoundingClientRect().width ?? 0;
        if (Math.abs(now - w) < 0.5) return;
        w = now;
        setTimeout(again);
      });
    if (me.current) ro?.observe(me.current);
    let live = true;
    document.fonts?.ready.then(() => live && again());
    return () => {
      live = false;
      ro?.disconnect();
      removeEventListener("resize", again);
    };
  }, [bare]);
  const lines: ReactElement[] = [];
  // (the rows lit: a dump that scrolls inside itself, a figure's page,
  // brings the first into view when they change)
  const litRows: string[] = [];
  const relRows: string[] = [];
  // (the pair's layouts, the earlier point's first, for the tints)
  const tintOrder = useMemo(() => !l ? [] : !lThere ? [l]
    : (hereAt?.i ?? 0) < (thereAt?.i ?? 0) ? [l, lThere] : [lThere, l],
  [l, lThere, hereAt?.i, thereAt?.i]);
  const loc = p.location;
  // (storage's rows are named by how they are found: a hashed one gets
  // a line of room above it)
  const slots = loc === "storage";
  // (a row's name in a view transition: transition.ts)
  const vt = (...x: string[]) => vtName(lens.key, p.id, p.location, ...x);
  rows.forEach((r0, k) => {
    // (a row of the second reading: its layout and light)
    const r = r0 as Row & { second?: boolean };
    const L = r.second && l2 ? l2 : l;
    const light = r.second ? light2 : lightMain;
    const n = BigInt(r.address);
    const name = r.how;
    if ((k === 0 && n === 0n) || (k === 0 && disp.ends === false)) {
      // row 0 at the top: no line before it
    } else if (r.gapBefore) {
      lines.push(<div key={`g${k}`} className="gap" aria-hidden="true"
        data-vt={vt("gap", r.address)}><span>⋯</span></div>);
    } else if (slots && !bare && ((r.room ?? !/^slot \d+$|\+ \d+$/
      .test(name)) ||
      // (in the related view, under a row the selection consulted, when
      // this row has bytes its popover may not cover, lit or consulted:
      // room for it, as a hashed row has above it)
      (relOn && k > 0 && !!light.related?.has(rows[k - 1].address) &&
        (light.related.has(r.address) || [...Array(32).keys()].some((i) =>
          light.bytes.has(byteKey(loc, r.address, i))))))) {
      lines.push(<div key={`r${k}`} className="gap room"
        aria-hidden="true" />);
    }
    // what the transaction did to the slot (a pair only)
    // (the earlier point is before the transaction between them)
    const [b, a] = (hereAt?.i ?? 0) < (thereAt?.i ?? 0) ? [here, otherPoint]
      : [otherPoint, here];
    const words = [b, a].map((x) => rowBytes(x?.snapshot, loc,
      r.address).join());
    const same = !!p.compare && words[0] === words[1];
    // (what the transaction did to it, where the points know: storage's
    // reads and writes; else whether it changed)
    const facts = !p.compare || !a || !b ? "" : slots && a.transaction
      ? readWritten(b, a, r.address) ?? "not read or written"
      : same ? "unchanged" : "changed";
    const ring = same && !!a?.transaction?.writes.has(r.address);
    const what = `${name}${name.startsWith("slot") || !slots ? ""
      : ` (slot ${short(r.address)})`}${facts ? `; ${facts}` : ""}`;
    // (lit, or pointed at: a gutter address)
    const on = (light.at?.row === r.address && light.at.location === loc)
      || [...Array(32).keys()].some(
      (i) => light.bytes.has(byteKey(loc, r.address, i)));
    if (on) litRows.push(r.address);
    // (consulted by the selection: its frame pointer, its offset and
    // length word, a key's slot)
    else if (light.related?.has(r.address)) relRows.push(r.address);
    const only = !on && !!p.compare && [...there.bytes].some((b) =>
      b.split("|")[1] === r.address);
    const gut = !on && !only && light.gutters.has(r.address);
    // (a row a walkthrough has found by now keeps its label)
    const known = !on && !only && !!light.known?.has(r.address);
    // (a row the selection consulted: the related treatment)
    const rel = !on && !only && !!light.related?.has(r.address);
    const cls = ["wrow", same ? "same" : "", k % 2 ? "zb" : "",
      on ? "on" : "", only ? "only" : "", known ? "known" : "",
      gut ? "gut" : "", rel ? "rel" : "",
      rel && light.anchors?.has(r.address) ? "anchor" : "",
      // (in the related view, a row shown only as context: plainer than
      // a consulted one)
      relOn && !on && !only && !rel && !gut && !known ? "ctx" : ""]
      .filter(Boolean).join(" ");
    lines.push(<div key={r.address} className={r.second ? `${cls} second`
      : cls} data-slot={r.address}
      ref={r.second && L ? (el) => {
        if (el) (el as HTMLElement & { _data?: ViewData })._data = {
          light, l: L, ...factsOf(d2) };
      } : undefined}
      data-name={name} data-facts={facts} data-vt-in={vt(r.address)}
      // (a rule read over another compiler's storage: a slot it reads
      // that holds nothing, every byte zero; the misread's cause)
      data-empty={slots && (r.second ? foreign2 : foreign) && snap &&
        rowBytes(snap, loc,
        r.address).every((b) => b === undefined || b === "00") ? ""
        : undefined}
      {...(name === slotRef(r.address) || !slots ? {}
        : { "data-full": `= ${r.address}` })}>
      <span className="addr" tabIndex={bare ? undefined : 0}
        aria-label={bare ? undefined : `${r.address}; ${what}`}>
        {ring && <span className="ring" aria-label="written, same value" />}
        <span className="a">{addressText(loc, r.address)}</span></span>
      {L && <Word l={L} ls={r.second ? [L] : tintOrder} loc={loc}
        row={r.address}
        mine={rowBytes(snap, loc, r.address)}
        theirs={rowBytes((p.compare ? otherPoint : here)?.snapshot, loc,
          r.address)}
        side={order} pair={!!p.compare} name={name} light={light}
        groupsOf={groupsOf}
        bare={bare} abbreviate={disp.abbreviate}
        annot={annotOf?.(r.address)} />}
    </div>);
  });
  if (l?.more && !flow) {
    lines.push(<div key="end" className="gap" aria-hidden="true"
      data-vt={vt("end")}><span>⋯</span></div>);
  }

  // the groups: each run of adjacent rows between two "⋯" lines, one
  // box, named in a view transition by its first row (transition.ts)
  const grouped: ReactElement[] = [];
  let run: ReactElement[] = [];
  const close = () => {
    if (!run.length) return;
    const first = run.find((e) => !String(e.key).startsWith("r"))?.key;
    grouped.push(<div key={`run${String(first)}`} className="run"
      data-vt={vt("run", String(first))}>{run}</div>);
    run = [];
  };
  for (const e of lines) {
    const key = String(e.key);
    if (key === "end" || key.startsWith("g")) {
      close();
      grouped.push(e);
    } else run.push(e);
  }
  close();

  // (into view inside the dump's rows' box, when it scrolls and they are
  // out of it: the lit rows whole where they fit, with a row above them
  // and a popover's line under them where there is room; else the first
  // at the top; not while the pointer is in it, its rows under the
  // pointer staying put; nothing lit, a stack shows its top: its live
  // entries. Nothing else moves)
  const rowsBox = useRef<HTMLDivElement>(null);
  // (none lit here: the rows it consulted, as lit ones. A hover in a
  // dump, on its bytes or a row, scrolls nothing: what is lit then is
  // what was lit before it; a hover in the variables may)
  const inDump = !!(link.hover?.bytes || link.hover?.row);
  const litNow = (litRows.length ? litRows : relRows).join(" ");
  const litHeld = useRef(litNow);
  if (!inDump) litHeld.current = litNow;
  const litKey = litHeld.current;
  const inDumpRef = useRef(inDump);
  inDumpRef.current = inDump;
  const litSel = litRows.length ? ".wrow.on" : ".wrow.rel";
  const top0 = p.location === "stack";
  // (a page's rows' box, its height set and moving to it (its page box's,
  // lenses/stepper.tsx, which says "ethdebug:fit" when it sets one): the
  // scroll for the box as it will be, so its rows do not slide as it
  // grows; a page shut, its box no height: none, until it opens)
  const bring = () => {
    const v = rowsBox.current;
    if (!v || !/auto|scroll/.test(getComputedStyle(v).overflowY)) return;
    const set = v.parentElement?.classList.contains("pagebox")
      ? parseFloat(v.parentElement.style.height) : NaN;
    const to = Number.isNaN(set) ? undefined : set;
    // (the page box's own padding and edge, where its edges' buttons
    // are: not the rows')
    const pb = v.parentElement ? getComputedStyle(v.parentElement) : null;
    const frame = pb ? parseFloat(pb.paddingTop) + parseFloat(
      pb.paddingBottom) + parseFloat(pb.borderTopWidth) + parseFloat(
      pb.borderBottomWidth) : 0;
    const h = to === undefined ? v.clientHeight
      : Math.max(0, to - frame - (v.offsetHeight - v.clientHeight));
    if (!h) return;
    // (no further down than the box as it will be lets it: the browser
    // would bring it back up as the box grows, a slide)
    if (to !== undefined && v.scrollTop > v.scrollHeight - h) {
      v.scrollTop = Math.max(0, v.scrollHeight - h);
    }
    // (a scroll to put back, the related view gone: as it was, at once,
    // once its rows are back; nothing brought into view over it)
    const view = me.current;
    if (view?.dataset.restore !== undefined) {
      if (view.dataset.related !== undefined) return;
      const y = Number(view.dataset.restore);
      // (not yet room for it: its box still coming back to its height)
      if (v.scrollHeight - v.clientHeight < y - 1) return;
      delete view.dataset.restore;
      stopGlide(v);
      v.scrollTop = y;
      return;
    }
    if (v.scrollHeight <= h) return;
    if (!litKey) {
      if (top0) glide(v, 0);
      return;
    }
    // (once a move rests, not at each of its steps; not under the
    // pointer, its rows staying put)
    if (moving || inDumpRef.current || me.current?.matches(":hover"))
      return;
    // (the lit rows in runs, each of rows lit side by side; their places
    // from the content's top)
    const vb = v.getBoundingClientRect();
    const at = (r: HTMLElement) => r.getBoundingClientRect().top - vb.top -
      v.clientTop + v.scrollTop;
    const runs: { top: number; bottom: number }[] = [];
    let open = false;
    for (const r of v.querySelectorAll<HTMLElement>(".wrow")) {
      if (!r.matches(litSel)) {
        open = false;
        continue;
      }
      const t = at(r), b = t + r.offsetHeight;
      if (open) runs[runs.length - 1].bottom = b;
      else runs.push({ top: t, bottom: b });
      open = true;
    }
    if (!runs.length) return;
    const row = v.querySelector<HTMLElement>(".wrow")?.offsetHeight ?? 20;
    const cs = getComputedStyle(v);
    // (a popover's line under them: about half a word's row)
    const pop = Math.min(row, 1.8 * (parseFloat(cs.fontSize) || 12));
    // (all of them, when they fit clear of the edges; else the first, the
    // edge's button pointing to the rest)
    const clear = Math.max(row / 2, 18);
    const all = { top: runs[0].top,
      bottom: runs[runs.length - 1].bottom + pop };
    const run = all.bottom - all.top <= h - 2 * clear ? all
      : { top: runs[0].top, bottom: runs[0].bottom + pop };
    const y = centring(v, run, { row, clear, h });
    if (y !== undefined) glide(v, y);
  };
  const bringRef = useRef(bring);
  bringRef.current = bring;
  useLayoutEffect(() => bring(), [litKey, top0, snap, moving,
    rows.length]);
  useEffect(() => {
    const v = me.current;
    if (!v) return;
    const on = () => bringRef.current();
    v.addEventListener("ethdebug:fit", on);
    // (and as its rows change height, their type fitted later, or its
    // box comes to its height, a page opened: the lit ones where they
    // come to, once it holds still)
    let hs = "";
    let t: ReturnType<typeof setTimeout> | undefined;
    const ro = typeof ResizeObserver === "undefined" ? null
      : new ResizeObserver(() => {
        const r = rowsBox.current?.querySelector(".wrow");
        const now = `${r?.getBoundingClientRect().height}|${
          rowsBox.current?.clientHeight}`;
        if (now === hs) return;
        hs = now;
        clearTimeout(t);
        t = setTimeout(on, 80);
      });
    const first = rowsBox.current?.querySelector(".wrow");
    if (first) ro?.observe(first);
    if (rowsBox.current) ro?.observe(rowsBox.current);
    return () => {
      v.removeEventListener("ethdebug:fit", on);
      clearTimeout(t);
      ro?.disconnect();
    };
  // (its box, once drawn: the first render may have none)
  }, [me.current]);
  // (an abbreviated dump's words cut to what fits, after each layout)
  useLayoutEffect(() => {
    if (disp.abbreviate !== undefined && me.current) fitAbbr(me.current);
  });
  useEffect(() => {
    const v = me.current;
    if (disp.abbreviate === undefined || !v ||
      typeof ResizeObserver === "undefined") return;
    // (a new width, or a new cell size: its first cell's)
    const ro = new ResizeObserver(() => fitAbbr(v));
    ro.observe(v);
    const c = v.querySelector(".word .oct > .b");
    if (c) ro.observe(c);
    return () => ro.disconnect();
  }, [disp.abbreviate, rows.length]);
  const { more, edge } = useEdges(rowsBox, !!disp.edges, [rows.length,
    litKey, snap], { what: `the ${p.location}`, band: "its lit rows",
    on: ".wrow.on",
    // (a stack's rows past its top, empty: not more to show)
    ...disp.abbreviate !== undefined ? { end: ".wrow:has(.word .b)" }
      : {} });
  // (a page, `edges`: open or shut to its tab, as LensState.pages has it,
  // its owner's (the stepper's: lenses/stepper.tsx); none yet, open where
  // it is needed: something here related at the moment, drawn, in the
  // related view)
  // (none while the related rows are not known: not every page needed
  // for an instant, as a moment's data comes; and, the related view on
  // or off, a page whose bytes the selection lights, as drawn. A hover
  // changes nothing: its light is not the selection's)
  const selLit = useRef(false);
  // (where the selection's bytes are, or what it consulted to find them)
  if (!link.hover) selLit.current = !!link.selection &&
    litRows.length + relRows.length > 0;
  const needed = (!!only && only.rows.length > 0 && rows.length > 0) ||
    selLit.current;
  const chosen = useLensState((s) => s.pages?.[p.location]);
  const open = chosen ?? needed;
  // (its last: what a move holds, above)
  was.current = open;
  const toggle = () => lens.store.set((s) => ({ ...s, pages: {
    ...s.pages, [p.location]: !open } }));
  // (nothing of this location to show here: no dump; a page keeps its
  // tab and a gap row)
  if (l && !rows.length && !disp.edges) return null;
  // (bare: the bytes only, nothing to point at or click)
  const handlers = bare ? {} : {
    onPointerOver: point, onPointerMove: point, onFocus: point,
    onClick: (e: MouseEvent) => {
      // (the lens's click-to-clear leaves a click that acted alone)
      // (a gap inside a value: the value's byte; between values, or
      // outside the bytes: no act, the click as on empty space)
      const at = spot(e.target, e.clientX, e.clientY);
      if (at && at !== "row" && act(at)) {
        (e.nativeEvent as { acted?: boolean }).acted = true;
      }
    }, onKeyDown: onKey };
  const ruler = disp.ruler !== false && disp.shape !== "strip" &&
    disp.abbreviate === undefined && !flow;
  return <div ref={me} data-side={order} role="group"
    aria-label={p.when ? `${label} ${p.when}` : label}
    // (lit: the rest steps back; a selection or a step: brown caps)
    className={["view", light.muted || annot ? "active" : "",
      link.selection || link.walk || active ? "chosen" : "",
      // (step 0, the selection's slots: its own yellow gutter group, not
      // the neutral one the steps after it give the slots found)
      light.walk && !light.quiet ? "walking" : "", disp.shape === "strip" ? "strip" : "",
      disp.abbreviate !== undefined ? "abbr" : "", flow ? "flow" : "",
      bare ? "bare" : "", annot ? "annot" : "", still ? "no-hover" : "", annot && revealed
        ? "revealed" : "", hand ? "hand" : ""].filter(Boolean).join(" ")}
    data-view={`${lens.key}:${p.id}`} data-point={l?.point}
    data-open={disp.edges ? String(open) : undefined}
    data-needed={disp.edges ? String(needed) : undefined}
    data-related={disp.edges && only ? String(only.rows.length > 0 &&
      rows.length > 0) : undefined}
    data-location={p.location}
    data-exits={exiting(link) || undefined} {...handlers} {...hovering}
    {...layer ? { "data-units": layer.units.length } : {}}>
    <div className="view-head">{disp.edges ? <button type="button"
      className="view-name ptab" aria-expanded={open} onClick={toggle}
      aria-label={`${title}: ${open ? "fold" : "open"} its page`}>{title}
      <span className="pchev">{CHEV}</span></button>
      : <span className="view-name">{title}</span>}
      {ruler && <div className="wrow head"><span className="addr" />
        <Ruler /></div>}
    </div>
    {disp.edges ? <div className="pagebox"><div ref={rowsBox}
      data-lit={litKey}
      className={`rows${more.up ? " more-up" : ""}${more.down
        ? " more-down" : ""}`}>{grouped.length ? grouped
        : <div className="gap" aria-hidden="true"><span>⋯</span></div>}
        {stackPage && <div className="past" aria-hidden="true"
          style={{ "--past": only ? 0 : past } as CSSProperties} />}
      </div>{pastRow && l && <div className="reserve" aria-hidden="true">
        <div className="wrow"><span className="addr"><span className="a">
          {addressText(loc, pastRow.address)}</span></span>
          <Word l={l} ls={tintOrder} loc={loc} row={pastRow.address}
            mine={rowBytes(snap, loc, pastRow.address)}
            theirs={rowBytes(snap, loc, pastRow.address)} side={order}
            pair={!!p.compare} name={pastRow.how} light={lightMain}
            groupsOf={groupsOf} bare={bare}
            abbreviate={disp.abbreviate} /></div></div>}
      {edge("up")}{edge("down")}
    </div> : <div ref={rowsBox} className="rows" style={disp.scale
      ? { fontSize: `${disp.scale}em` } : undefined}>{flow
        ? <Flow rows={rows} loc={loc} snap={snap}
          per={disp.perLine ?? 16} annot={annotOf} /> : grouped}</div>}
  </div>;
}
