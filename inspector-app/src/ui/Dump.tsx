// A dump of one location at one timeline point (vanilla panel.js
// renderPanel, wordHtml, paint): one word a row, in address order, each
// byte linked to the value that owns it
import { useFitDump } from "./fit";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { drawOverlays, type ViewData } from "./overlays";

// one drawing of a box's overlays per commit, however many of its dumps
// rendered (the pending mark lives on the box's element)
function schedule(root: HTMLElement & { _overlays?: boolean },
  cards: boolean) {
  if (root._overlays) return;
  root._overlays = true;
  queueMicrotask(() => {
    root._overlays = false;
    if (root.isConnected) drawOverlays(root, { cards });
  });
}
import type {
  KeyboardEvent, MouseEvent, PointerEvent, ReactElement,
} from "react";
import type {
  Filter, Hex, Layout, Light, Location, Row, Target, TimelinePoint,
} from "../engine/types";
import { byteKey, short } from "../engine/hex";
import {
  useDecoded, useLayout, useLens, useLight, useLink, usePointAt,
  hush,
} from "./hooks";
import { blockOf, resolveTarget } from "../engine/target";
import { noLight } from "../engine/light";
import { readWritten } from "../engine/timeline";
import { addressText, goesOn, rowBytes } from "../engine/location";
import type { DataRef, LinkId, ViewId } from "./types";
import { exiting } from "./types";

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

// an owner id's label: a value's path, or "<path> (length)" for its
// length part or an array's own word
const ownerLabel = (id: string, composite: boolean) =>
  id.endsWith("#length") || composite
    ? `${shortKeys(id.replace(/#[a-z]+$/, ""))} (length)` : shortKeys(id);
// a lit byte's colour class, from its first owner with one
const pick = (light: Light, ids: string[]) => {
  const k = ids.map((id) => light.colours.get(id.replace(/#[a-z]+$/, "")))
    .find((x) => x !== undefined);
  return { k, cls: k === "src" ? "pksrc" : k ? `pk${k}` : "" };
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

function Word({ l, ls, loc, row, mine, theirs, side, name, light,
  groupsOf }: {
  l: Layout; ls: Layout[]; loc: Location; row: Hex;
  mine: (string | undefined)[]; theirs: (string | undefined)[];
  side?: string; name: string; light: Light;
  groupsOf: (id: string) => boolean }) {
  const ownersIn = (x: Layout) => Array.from({ length: 32 }, (_, i) =>
    x.cover.get(byteKey(loc, row, i)) ?? []);
  const owners = ownersIn(l);
  // each owner's tint: one per owner, wherever its bytes fall (a region
  // that crosses rows keeps it), the same in every view of a pair
  const tint = tintsOf(ls, loc);
  const at = light.at?.row === row ? light.at : undefined;
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
        const { k, cls: c } = pick(light, g.owners);
        cls.push("hl");
        if (c) cls.push(c);
        // (the selection's own colour, 0, never mutes; a walkthrough's
        // echo of its focus does)
        if ((light.focus !== undefined && k && k !== light.focus) ||
          light.dim?.has(byteKey(loc, row, i))) {
          cls.push("muted");
        }
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
            `${label}, ${range} of ${name}${side ? `, ${side}` : ""}` }
          : {})}>
        {mine[i] ?? "··"}</span>);
    }
  }
  return <div className="word" data-side={side} data-slot={row}>
    <div className="bytes"><Octets cells={cells} /></div></div>;
}

// `side`: Phase 1's pair (data-side); `hidden`, `title`, `when`,
// `compare` (the pair's other point: changed bytes, the slots' facts):
// the lens's choice (Lens.tsx)
export function Dump(p: { id: ViewId; location: Location; data: DataRef;
  filter?: Filter; link?: LinkId; domId?: string;
  side?: "before" | "after"; hidden?: boolean; title?: string;
  when?: string; compare?: DataRef; cards?: boolean }) {
  const { l } = useLayout(p.id, p.filter, undefined, p.compare);
  const { l: lThere0 } = useLayout(p.id, p.filter, p.compare, p.data);
  const lThere = p.compare ? lThere0 : undefined;
  const hereAt = usePointAt(p.data);
  const thereAt = usePointAt(p.compare);
  const here = hereAt?.p;
  const snap = here?.snapshot;
  const otherPoint = thereAt?.p;
  const lit0 = useLight(p.id, p.filter, undefined, p.compare);
  const [walkLink] = useLink(p.link);
  // (a walkthrough lights the side it walks, the one shown)
  const light = p.hidden && walkLink.walk ? noLight : lit0;
  // what the compared point lights (a slot lit there only: "only"; none
  // in a walkthrough, which walks one side: vanilla panel.js)
  const there0 = useLight(p.id, p.filter, p.compare, p.data);
  const there = walkLink.walk && !lit0.rest ? noLight : there0;
  const [link, setLink] = useLink(p.link);
  const d = useDecoded(p.data);
  const lens = useLens();
  const groupsOf = (id: string) => !!d?.byPath.get(id)?.children;
  const side = p.side;
  const title = p.title ?? "Storage";
  const label = p.location[0].toUpperCase() + p.location.slice(1);

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
    if (a) return { row: (a.parentElement as HTMLElement).dataset.slot as Hex };
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
  const xy = (e: { target: EventTarget }) => "clientX" in e
    ? [(e as PointerEvent).clientX, (e as PointerEvent).clientY] as const
    : [undefined, undefined] as const;
  const target = (e: { target: EventTarget }, sel: string | null) => {
    const at = spot(e.target, ...xy(e));
    const r = (e.target as Element).closest?.(".wrow[data-slot]") as
      HTMLElement | null;
    const h = at === "row" ? { row: r!.dataset.slot as Hex }
      : at ? hit(at) : null;
    return h && d && l ? resolveTarget(h, sel, d.byPath, l) : null;
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
  const point = (e: PointerEvent | { target: EventTarget }) => {
    if ("clientX" in e) cursorAt(e);
    if (lens.store.get().hush) return;
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
    const h = hit(el);
    if (!h || !d || !l) return false;
    // (on what the selection does not light: it ends, and the hover
    // waits for the pointer to move: hush)
    const lit = h.row !== undefined
      ? [...Array(32).keys()].some((i) => lit0.bytes.has(byteKey(p.location,
        h.row as Hex, i)))
      : !!h.bytes && lit0.bytes.has(byteKey(p.location, h.bytes.row,
        h.bytes.from));
    let cleared = false;
    setLink((s) => {
      const sel = s.selection;
      if (exiting(s) && !lit && !keys) {
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
      const t = resolveTarget(h, keys ? null : sel, d.byPath, l);
      const q = t.path ?? null;
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
  const rows = l?.rows ?? [];
  useFitDump(me, !p.hidden, rows.length);

  // the overlays (popovers, cards, the tray), over the dumps' box, once
  // per render of any of its dumps; again on resize and once the fonts
  // are in (the labels are fitted in them)
  const cards = !!p.cards && !link.walk;
  useLayoutEffect(() => {
    const v = me.current as (HTMLDivElement & { _data?: ViewData }) | null;
    if (v && l) v._data = { light, there: p.compare ? there : undefined, l };
    const root = v?.closest<HTMLElement>(".panel") ?? v?.parentElement;
    if (root) schedule(root, cards);
  });
  useEffect(() => {
    const again = () => {
      const v = me.current;
      const root = v?.closest<HTMLElement>(".panel") ?? v?.parentElement;
      if (root) schedule(root, cards);
    };
    addEventListener("resize", again);
    let live = true;
    document.fonts?.ready.then(() => live && again());
    return () => {
      live = false;
      removeEventListener("resize", again);
    };
  }, [cards]);
  const lines: ReactElement[] = [];
  // (the pair's layouts, the earlier point's first, for the tints)
  const tintOrder = useMemo(() => !l ? [] : !lThere ? [l]
    : (hereAt?.i ?? 0) < (thereAt?.i ?? 0) ? [l, lThere] : [lThere, l],
  [l, lThere, hereAt?.i, thereAt?.i]);
  const loc = p.location;
  // (storage's rows are named by how they are found: a hashed one gets
  // a line of room above it)
  const slots = loc === "storage";
  rows.forEach((r, k) => {
    const n = BigInt(r.address);
    const name = r.how;
    if (k === 0 && n === 0n) {
      // row 0 at the top: no line before it
    } else if (r.gapBefore) {
      lines.push(<div key={`g${k}`} className="gap" aria-hidden="true">
        <span>⋯</span></div>);
    } else if (slots && !/^slot \d+$|\+ \d+$/.test(name)) {
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
    const on = light.at?.row === r.address || [...Array(32).keys()].some(
      (i) => light.bytes.has(byteKey(loc, r.address, i)));
    const only = !on && !!p.compare && [...there.bytes].some((b) =>
      b.split("|")[1] === r.address);
    const gut = !on && !only && light.gutters.has(r.address);
    // (a row a walkthrough has found by now keeps its label)
    const known = !on && !only && !!light.known?.has(r.address);
    const cls = ["wrow", same ? "same" : "", k % 2 ? "zb" : "",
      on ? "on" : "", only ? "only" : "", known ? "known" : "",
      gut ? "gut" : ""]
      .filter(Boolean).join(" ");
    lines.push(<div key={r.address} className={cls} data-slot={r.address}
      data-name={name} data-facts={facts}
      {...(name === slotRef(r.address) || !slots ? {}
        : { "data-full": `= ${r.address}` })}>
      <span className="addr" tabIndex={0}
        aria-label={`${r.address}; ${what}`}>
        {ring && <span className="ring" aria-label="written, same value" />}
        <span className="a">{addressText(loc, r.address)}</span></span>
      {l && <Word l={l} ls={tintOrder} loc={loc} row={r.address}
        mine={rowBytes(snap, loc, r.address)}
        theirs={rowBytes((p.compare ? otherPoint : here)?.snapshot, loc,
          r.address)}
        side={side} name={name} light={light} groupsOf={groupsOf} />}
    </div>);
  });
  if (goesOn(loc)) {
    lines.push(<div key="end" className="gap" aria-hidden="true">
      <span>⋯</span></div>);
  }

  // (nothing of this location to show here: no dump)
  if (l && !rows.length) return null;
  return <div ref={me} data-side={side} role="group"
    aria-label={p.when ? `${label} ${p.when}` : label} hidden={p.hidden}
    // (lit: the rest steps back; a selection or a step: brown caps)
    className={["view", light.muted ? "active" : "",
      link.selection || link.walk ? "chosen" : ""].filter(Boolean).join(" ")}
    data-view={`${lens.key}:${p.id}`} data-point={l?.point}
    data-exits={exiting(link) || undefined}
    onPointerOver={point} onPointerMove={point} onFocus={point}
    onClick={(e: MouseEvent) => {
      // (the lens's click-to-clear leaves a click that acted alone)
      // (a gap inside a value: the value's byte; between values, or
      // outside the bytes: no act, the click as on empty space)
      const at = spot(e.target, e.clientX, e.clientY);
      if (at && at !== "row" && act(at)) {
        (e.nativeEvent as { acted?: boolean }).acted = true;
      }
    }} onKeyDown={onKey}>
    <div className="view-head"><span className="view-name">{title}</span>
      <div className="wrow head"><span className="addr" /><Ruler /></div>
    </div>
    <div className="rows">{lines}</div>
  </div>;
}
