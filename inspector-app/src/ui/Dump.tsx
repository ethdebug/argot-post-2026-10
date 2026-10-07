// A dump of one location at one timeline point (vanilla panel.js
// renderPanel, wordHtml, paint): one word a row, in address order, each
// byte linked to the value that owns it
import { useLayoutEffect, useRef } from "react";
import type {
  KeyboardEvent, MouseEvent, PointerEvent, ReactElement,
} from "react";
import type { Filter, Hex, Layout, Light, Location } from "../engine/types";
import { byteKey, short } from "../engine/hex";
import { useLayout, useLight, useLink, useSnapshot } from "./hooks";
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

function Word({ l, row, word, side, name, light }: { l: Layout; row: Hex;
  word?: Hex; side?: string; name: string; light: Light }) {
  const loc = l.location;
  const owners = Array.from({ length: 32 }, (_, i) =>
    l.cover.get(byteKey(loc, row, i)) ?? []);
  // owners in byte order, each with its tint
  const tint = new Map<string, number>();
  for (const ids of owners) for (const id of ids) {
    if (!tint.has(id)) tint.set(id, tint.size);
  }
  const mine = pairs(word);
  const at = light.at?.row === row ? light.at : undefined;
  const cells: ReactElement[] = [];
  for (const g of groups(owners)) {
    const label = g.owners.map(shortKeys).join(", ");
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
      if (hl) cls.push("hl");
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

// `side`: Phase 1's pair (data-side); `hidden`, `title`, `when`: the
// lens's choice (Lens.tsx)
export function Dump(p: { id: ViewId; location: Location; data: DataRef;
  filter?: Filter; link?: LinkId; domId?: string;
  side?: "before" | "after"; hidden?: boolean; title?: string;
  when?: string }) {
  const { l } = useLayout(p.id);
  const snap = useSnapshot(p.data);
  const light = useLight(p.id);
  const [, setLink] = useLink(p.link);
  const side = p.side;
  const title = p.title ?? "Storage";
  const label = p.location[0].toUpperCase() + p.location.slice(1);

  // what the pointer is on: a run of bytes
  const target = (el: EventTarget) => {
    const c = (el as Element).closest?.(".b[data-g]") as HTMLElement | null;
    const w = c?.closest(".word") as HTMLElement | null;
    if (!c || !w) return null;
    const [from, to] = c.dataset.g!.split("-").map(Number);
    return { cell: c, bytes: { row: w.dataset.slot as Hex, from, to,
      location: p.location } };
  };
  const point = (e: PointerEvent | { target: EventTarget }) => {
    const t = target(e.target);
    setLink((s) => {
      const same = JSON.stringify(s.hover?.bytes) ===
        JSON.stringify(t?.bytes);
      return same && (t || !s.hover) ? s
        : { ...s, hover: t ? { bytes: t.bytes } : null };
    });
  };
  // a byte selects its value, or, when it is the selected one's, clears
  const act = (el: EventTarget) => {
    const t = target(el);
    if (!t) return false;
    const owner = (t.cell.dataset.owners ?? "").split("|")[0] || null;
    setLink((s) => ({ ...s, hover: null,
      selection: owner && owner === s.selection ? null : owner }));
    return true;
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") &&
      (e.target as Element).closest(".b[tabindex]")) {
      e.preventDefault();
      act(e.target);
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
    const what = `${name}${name.startsWith("slot") ? ""
      : ` (slot ${short(r.address)})`}`;
    const on = [...Array(32).keys()].some((i) =>
      light.bytes.has(byteKey(p.location, r.address, i)));
    const cls = ["wrow", k % 2 ? "zb" : "", on ? "on" : ""]
      .filter(Boolean).join(" ");
    lines.push(<div key={r.address} className={cls} data-slot={r.address}
      data-name={name} data-facts=""
      {...(name === slotRef(r.address) ? {}
        : { "data-full": `= ${r.address}` })}>
      <span className="addr" tabIndex={0}
        aria-label={`${r.address}; ${what}`}>
        <span className="a">{tail(r.address)}</span></span>
      {l && <Word l={l} row={r.address} word={snap?.storage.get(r.address)}
        side={side} name={name} light={light} />}
    </div>);
  });
  lines.push(<div key="end" className="gap" aria-hidden="true">
    <span>⋯</span></div>);

  return <div ref={me} className="view" data-side={side} role="group"
    aria-label={p.when ? `${label} ${p.when}` : label} hidden={p.hidden}
    onPointerOver={point} onFocus={point}
    onPointerLeave={() => setLink((s) => s.hover ? { ...s, hover: null } : s)}
    onClick={(e: MouseEvent) => act(e.target)} onKeyDown={onKey}>
    <div className="view-head"><span className="view-name">{title}</span>
      <div className="wrow head"><span className="addr" /><Ruler /></div>
    </div>
    <div className="rows">{lines}</div>
  </div>;
}
