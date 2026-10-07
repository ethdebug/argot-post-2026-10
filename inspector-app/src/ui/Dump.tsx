// A dump of one location at one timeline point (vanilla panel.js
// renderPanel, wordHtml, paint): one word a row, in address order, each
// byte linked to the value that owns it
import { useEffect, useLayoutEffect, useRef } from "react";
import { drawOverlays } from "./overlays";

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
  Filter, Hex, Layout, Light, Location, Target,
} from "../engine/types";
import { byteKey, short } from "../engine/hex";
import {
  useDecoded, useLayout, useLens, useLight, useLink, usePointAt,
} from "./hooks";
import { blockOf, resolveTarget } from "../engine/target";
import { readWritten } from "../engine/timeline";
import type { DataRef, LinkId, ViewId } from "./types";

const TINTS = 5;
const PLAIN = 1n << 32n;

const pairs = (h?: string) =>
  (h ?? "0x" + "0".repeat(64)).slice(2).padStart(64, "0").match(/../g)!;
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
    ? `${shortKeys(id.replace(/#length$/, ""))} (length)` : shortKeys(id);
// a lit byte's colour class, from its first owner with one
const pick = (light: Light, ids: string[]) => {
  const k = ids.map((id) => light.colours.get(id.replace(/#length$/, "")))
    .find((x) => x !== undefined);
  return { k, cls: k === "src" ? "pksrc" : k ? `pk${k}` : "" };
};

function Word({ l, row, word, other, side, name, light, groupsOf }: {
  l: Layout; row: Hex; word?: Hex; other?: Hex; side?: string;
  name: string; light: Light; groupsOf: (id: string) => boolean }) {
  const loc = l.location;
  const owners = Array.from({ length: 32 }, (_, i) =>
    l.cover.get(byteKey(loc, row, i)) ?? []);
  // owners in byte order, each with its tint
  const tint = new Map<string, number>();
  for (const ids of owners) for (const id of ids) {
    if (!tint.has(id)) tint.set(id, tint.size);
  }
  const mine = pairs(word);
  const theirs = other === undefined ? mine : pairs(other);
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
      if (i === g.to) cls.push("ge");
      if (mine[i] === "00") cls.push("z");
      if (mine[i] !== theirs[i]) cls.push("chg");
      if (hl) {
        const { k, cls: c } = pick(light, g.owners);
        cls.push("hl");
        if (c) cls.push(c);
        // (the selection's own colour, 0, never mutes)
        if (light.focus !== undefined && k && k !== light.focus) {
          cls.push("muted");
        }
      }
      if (isAt) cls.push("at");
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
        {mine[i]}</span>);
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
  const { l } = useLayout(p.id, p.filter);
  const hereAt = usePointAt(p.data);
  const thereAt = usePointAt(p.compare);
  const here = hereAt?.p;
  const snap = here?.snapshot;
  const otherPoint = thereAt?.p;
  const light = useLight(p.id, p.filter);
  // what the compared point lights (a slot lit there only: "only")
  const there = useLight(p.id, p.filter, p.compare);
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
  const target = (el: EventTarget, sel: string | null) => {
    const h = hit(el);
    return h && d && l ? resolveTarget(h, sel, d.byPath, l) : null;
  };
  const point = (e: PointerEvent | { target: EventTarget }) => {
    setLink((s) => {
      const t = target(e.target, s.selection);
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
    setLink((s) => {
      const sel = s.selection;
      if (h.row !== undefined) {
        const t = resolveTarget(h, sel, d.byPath, l);
        if (t.path) return { ...s, hover: null,
          selection: t.path === sel ? null : t.path };
        if (keys || !sel) return s;
        const ids = new Set(Array.from({ length: 32 }, (_, i) =>
          l.cover.get(byteKey(p.location, h.row as Hex, i))?.[0])
          .filter((x): x is string => !!x)
          .map((x) => blockOf(x.replace(/#length$/, ""), sel)));
        const [only] = ids;
        return ids.size === 1 && only !== sel
          ? { ...s, hover: null, selection: only } : s;
      }
      const t = resolveTarget(h, keys ? null : sel, d.byPath, l);
      const q = t.path ?? null;
      return { ...s, hover: null, selection: q && q === sel ? null : q };
    });
    return true;
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") &&
      (e.target as Element).closest(".b[tabindex], .addr")) {
      e.preventDefault();
      act(e.target, true);
    }
  };

  // The dump's font: the largest at which its row fits the box (CSS,
  // .views); a row's width in em, in this font, measured once for each
  // layout (32 bytes a line, or 16 on a narrow box) (vanilla fitDumps)
  const me = useRef<HTMLDivElement>(null);
  const rows = l?.rows ?? [];
  const shownHere = !p.hidden;
  useLayoutEffect(() => {
    const fit = () => {
      const d = me.current?.closest<HTMLElement>(".dump");
      const row = me.current?.querySelector(".rows > .wrow");
      if (!d || !row || !shownHere || !d.clientWidth) return;
      const key = d.clientWidth < 560 ? "--k16" : "--k32";
      if (d.style.getPropertyValue(key)) return;
      const fs = parseFloat(getComputedStyle(row).fontSize);
      const w = row.querySelector(".word")!.getBoundingClientRect().right -
        row.getBoundingClientRect().left;
      if (w > 0) d.style.setProperty(key, (w / fs).toFixed(4));
    };
    fit();
    addEventListener("resize", fit);
    return () => removeEventListener("resize", fit);
  }, [rows.length, shownHere]);

  // the overlays (popovers, cards, the tray), over the dumps' box, once
  // per render of any of its dumps; again on resize and once the fonts
  // are in (the labels are fitted in them)
  const cards = !!p.cards;
  useLayoutEffect(() => {
    const v = me.current;
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
  rows.forEach((r, k) => {
    const n = BigInt(r.address);
    const name = r.how;
    if (k === 0 && n === 0n) {
      // slot 0 at the top: no line before it
    } else if (r.gapBefore) {
      lines.push(<div key={`g${k}`} className="gap" aria-hidden="true">
        <span>⋯</span></div>);
    } else if (!/^slot \d+$|\+ \d+$/.test(name)) {
      lines.push(<div key={`r${k}`} className="gap room"
        aria-hidden="true" />);
    }
    // what the transaction did to the slot (a pair only)
    // (the earlier point is before the transaction between them)
    const [b, a] = (hereAt?.i ?? 0) < (thereAt?.i ?? 0) ? [here, otherPoint]
      : [otherPoint, here];
    const facts = !p.compare || !a || !b ? ""
      : readWritten(b, a, r.address) ?? "not read or written";
    const words = [b, a].map((x) => x?.snapshot.storage.get(r.address));
    const same = !!p.compare && words[0] === words[1];
    const ring = same && !!a?.transaction?.writes.has(r.address);
    const what = `${name}${name.startsWith("slot") ? ""
      : ` (slot ${short(r.address)})`}${facts ? `; ${facts}` : ""}`;
    const on = [...Array(32).keys()].some((i) =>
      light.bytes.has(byteKey(p.location, r.address, i)));
    const only = !on && !!p.compare && [...there.bytes].some((b) =>
      b.split("|")[1] === r.address);
    const gut = !on && !only && light.gutters.has(r.address);
    const cls = ["wrow", same ? "same" : "", k % 2 ? "zb" : "",
      on ? "on" : "", only ? "only" : "", gut ? "gut" : ""]
      .filter(Boolean).join(" ");
    lines.push(<div key={r.address} className={cls} data-slot={r.address}
      data-name={name} data-facts={facts}
      {...(name === slotRef(r.address) ? {}
        : { "data-full": `= ${r.address}` })}>
      <span className="addr" tabIndex={0}
        aria-label={`${r.address}; ${what}`}>
        {ring && <span className="ring" aria-label="written, same value" />}
        <span className="a">{tail(r.address)}</span></span>
      {l && <Word l={l} row={r.address} word={snap?.storage.get(r.address)}
        other={p.compare ? otherPoint?.snapshot.storage.get(r.address)
          ?? undefined : undefined}
        side={side} name={name} light={light} groupsOf={groupsOf} />}
    </div>);
  });
  lines.push(<div key="end" className="gap" aria-hidden="true">
    <span>⋯</span></div>);

  return <div ref={me} className="view" data-side={side} role="group"
    aria-label={p.when ? `${label} ${p.when}` : label} hidden={p.hidden}
    data-view={`${lens.key}:${p.id}`}
    onPointerOver={point} onFocus={point}
    onClick={(e: MouseEvent) => {
      // (the lens's click-to-clear leaves a click that acted alone)
      if (act(e.target)) (e.nativeEvent as { acted?: boolean }).acted = true;
    }} onKeyDown={onKey}>
    <div className="view-head"><span className="view-name">{title}</span>
      <div className="wrow head"><span className="addr" /><Ruler /></div>
    </div>
    <div className="rows">{lines}</div>
  </div>;
}
