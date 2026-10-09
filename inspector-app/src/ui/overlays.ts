// The dumps' overlays (vanilla panel.js at d235617: paint's second half,
// annotate, popFor, whatIn, whatHtml, fitWhat, place): the slot popovers
// and the byte ruler, drawn on the rendered dumps after each render,
// from what each view lights (its Light and Layout, which the Dump puts
// on its element: `ViewData`); the DOM gives only geometry. They are
// overlays: nothing in the dumps moves for them.
import type { Hex, Layout, Light, Location } from "../engine/types";
import { byteKey } from "../engine/hex";
import { relClass } from "../engine/related";
import { addressing, rangeText } from "../engine/location";

type El = HTMLElement;
// what a dump view lights: its own Light, the compared point's (a slot
// lit there only: "only"), its layout
export interface ViewData { light: Light; there?: Light; l: Layout }
const data = (e: Element | null): ViewData | undefined =>
  (e?.closest(".view") as (El & { _data?: ViewData }) | null)?._data;
const slotOf = (r: El) => r.dataset.slot as Hex;
const rowLit = (x: ViewData | undefined, l: Light | undefined, r: El) =>
  !!x && !!l && Array.from({ length: 32 }, (_, i) =>
    l.bytes.has(byteKey(x.l.location, slotOf(r), i))).some(Boolean);
// a row's state: lit, lit in the other point only, found by an earlier
// walkthrough step, a gutter
function rowState(r: El) {
  const x = data(r);
  const on = rowLit(x, x?.light, r) || (x?.light.at?.row === slotOf(r) &&
    x.light.at.location === x.l.location);
  const only = !on && rowLit(x, x?.there, r);
  return { on, only, known: !on && !only && !!x?.light.known?.has(slotOf(r)),
    gut: !on && !only && !!x?.light.gutters.has(slotOf(r)),
    // (consulted by the selection: the related treatment)
    rel: !on && !only && !!x?.light.related?.has(slotOf(r)) };
}
// a byte's lighting, from its view's Light
function byteLight(c: El) {
  const x = data(c);
  const w = c.closest<El>(".word");
  if (!x || !w) {
    return { hl: false, k: null as string | null, muted: false,
      rel: null as string | null };
  }
  const key = byteKey(x.l.location, w.dataset.slot as Hex, +c.dataset.i!);
  const hl = x.light.bytes.has(key);
  const ids = (c.dataset.owners ?? "").split("|").filter(Boolean);
  // (a consulted value's byte: its related classes)
  const rel = !hl && x.light.relBytes?.has(key)
    ? relClass(x.light, ids) : null;
  const k = !hl ? undefined : x.light.byteColours?.get(key) ?? ids.map((id) =>
    x.light.colours.get(id.replace(/#[a-z]+$/, ""))).find((y) =>
    y !== undefined);
  const muted = hl && ((x.light.focus !== undefined && !!k &&
    k !== x.light.focus) || !!x.light.dim?.has(key));
  return { hl, k: !hl ? null : typeof k === "number" && k ? `pk${k}` : "pk0",
    muted, rel };
}
// a row the selection consulted, not lit (the related treatment)
const consulted = (r: El) => rowState(r).rel;
type Rect = { top: number; left: number; bottom: number; right: number };
// A dump's lines, in order: its rows and "⋯" lines, through its groups
// (.run: a run of rows between two "⋯" lines)
export const lines = (view: ParentNode): El[] => [...view.querySelectorAll<El>(
  ".rows > :not(.run), .rows > .run > *")];
// A dump's rows (not the pictures of rows in the cards)
const ROWS = ".rows > .run > .wrow";
interface Item { text: string; k: string | null; muted: boolean;
  sep: string; seg?: number; id?: string; free?: boolean;
  // (a note about the bytes, not a value: "(unmapped)", "(anchor slot
  // for playerList)": its prose italic, a name in it as names are; `fixed`:
  // never cut, an anchor's)
  note?: Note; fixed?: boolean }
type Note = (string | { name: string })[];
// a note, as an item (one builder for every note)
const noteItem = (note: Note, sep: string, o: Partial<Item> = {}): Item =>
  ({ text: note.map((p) => typeof p === "string" ? p : p.name).join(""),
    note, sep, muted: false, free: true, k: null, ...o });
type Pop = El & { _what?: Item[] };

const esc = (s: unknown) => String(s).replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
// 0x0000…f39f…2266 -> 0xf39f…2266
const short = (h: string, keep = 4) => {
  const s = "0x" + (h.replace(/^0x0*/, "") || "0");
  return s.length <= keep * 2 + 4 ? s
    : `${s.slice(0, keep + 2)}…${s.slice(-keep)}`;
};
const shortKeys = (path: string) =>
  path.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`);
const all = <T extends Element = El>(e: ParentNode, q: string) =>
  [...e.querySelectorAll<T & El>(q)];

// Put a popover at an address: its left edge on the gutter's, its arrow
// on the address; near an edge of what clips it (the dump's box, or a
// box that scrolls), shift the body and keep the arrow where it is. Its
// width is the browser's (max-content); this caps it to the room.
function place(pop: El, a: El, beside = false) {
  let clip = { left: 0, right: document.documentElement.clientWidth };
  // (inside the dump's box, short of its right edge)
  const dump = pop.closest(".dump")?.getBoundingClientRect();
  if (dump) {
    // (its left edge may stand a little out, as the gutter's cards do)
    clip = { left: Math.max(0, dump.left - 12), right: Math.min(clip.right,
      dump.right - 12) };
  }
  for (let e = pop.parentElement?.parentElement; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      const r = e.getBoundingClientRect();
      clip = { left: Math.max(clip.left, r.left),
        right: Math.min(clip.right, r.right) };
      break;
    }
  }
  pop.style.maxWidth = `${clip.right - clip.left - 8}px`;
  const at = a.getBoundingClientRect();
  const box = pop.parentElement!.getBoundingClientRect();
  const w = pop.offsetWidth;
  const mid = at.left + at.width / 2;
  // 6px left of the gutter, as the cards; or (`beside`) just right of
  // it, over the bytes, clear of the addresses
  const g = a.closest(".addr")!.getBoundingClientRect();
  const gutter = beside ? g.right + 4 : g.left - 6;
  const left = Math.max(clip.left + 4, Math.min(gutter, clip.right - 4 - w));
  pop.style.left = `${left - box.left}px`;
  pop.style.setProperty("--ax", `${beside ? 8 : mid - left}px`);
  pop.classList.toggle("beside", beside);
}

// The lit rows of a dump, as runs: rows next to each other in the dump
// (consecutive addresses; a gap line ends a run). A row the value uses
// only in the other state counts too.
// In a walkthrough, a run takes in the slots next to it that the
// walkthrough touches (a record's two slots): its label stays in one
// place, under the whole block, from step to step, over no slot of it.
function runs(view: El): El[][] {
  const out: El[][] = [];
  let run: El[] | null = null;
  const span = data(view.querySelector(".wrow"))?.light.span;
  const lit = (st: ReturnType<typeof rowState>) =>
    st.on || st.only || st.known || st.gut;
  for (const el of lines(view)) {
    const st = el.classList.contains("wrow") ? rowState(el) : null;
    if (st && (lit(st) || st.rel || span?.has(slotOf(el)))) {
      // (a consulted row and a lit one: runs of their own)
      if (run && consulted(run[0]) !== consulted(el)) run = null;
      if (!run) out.push(run = []);
      run.push(el);
    } else if (!el.classList.contains("cmp")) {
      run = null;
    }
  }
  return out.filter((r) => r.some((e) => {
    const st = rowState(e);
    return lit(st) || st.rel;
  }));
}

// One name for a run of slots: "slot 0", "slots 0–2",
// "keccak(slot 0), 2 slots", or the names in turn
function runName(rows: El[]): string {
  // (an offset-addressed segment: its rows are only layout; the run is
  // the bytes it stands for, by their offsets)
  const loc = data(rows[0])?.l.location;
  if (loc && addressing(loc) === "offset") return rangeName(rows, loc);
  const names = rows.map((r) => r.dataset.name!);
  if (names.length === 1) return names[0];
  const plain = names.map((n) => n.match(/^(slot) (\S+)$/));
  if (plain.every(Boolean)) {
    return `${plain[0]![1]}s ${plain[0]![2]}–${plain.at(-1)![2]}`;
  }
  const ps = names.map((n) => n.match(/^(.*?)(?: \+ (\d+))?$/)!);
  const k = ps.map((p) => BigInt(p[2] ?? 0));
  if (ps.every((p, i) => p[1] === ps[0][1] && k[i] === k[0] + BigInt(i))) {
    return `${ps[0][1]}${k[0] ? ` + ${k[0]}` : ""}, ${names.length} slots`;
  }
  return names.join(" · ");
}

// A run of an offset-addressed segment's rows, by the bytes it stands
// for: the lit ones (else the one pointed at, else the rows), first to
// last ("calldata 0x0024–0x0043"; one byte: "memory 0x00df"); one whole
// row: its name
function rangeName(rows: El[], loc: string): string {
  const cells = rows.flatMap((r) => all(r, ":scope > .word .b[data-i]"));
  const pick = (f: (c: El) => boolean) => cells.filter(f);
  const on = pick((c) => byteLight(c).hl);
  const at = on.length ? on : pick((c) => c.classList.contains("at"));
  const xs = (at.length ? at : cells).map((c) =>
    Number(BigInt(c.closest<El>(".word")!.dataset.slot!)) + +c.dataset.i!);
  const [a, b] = [Math.min(...xs), Math.max(...xs)];
  if (rows.length === 1 && a % 32 === 0 && b - a === 31) {
    return rows[0].dataset.name!;
  }
  return rangeText(loc as Location, a, b);
}

// What a run of slots holds, as the pointer names it: each slot's
// values in byte order, " / " between slots; a value's other regions by
// their role (`name.length`; an array's own word alone: `length`);
// several slots in one colour: the value they make up, by its path. A
// name is a badge only where its own bytes are lit now, in their colour.
function whatIn(root: El, rowsIn: El[]): Item[] {
  // (the lit rows of a run, if some are: a run may take in rows an
  // earlier step found)
  const lit = rowsIn.filter((r) => rowState(r).on);
  // (in a walkthrough: only what the steps so far have read, the rows
  // whose bytes are lit; a slot only computed yet names nothing)
  const x0 = data(rowsIn[0]);
  const walk = !!x0?.light.walk;
  const read = rowsIn.filter((r) => rowLit(x0, x0?.light, r) &&
    !x0?.light.wholes?.has(slotOf(r)));
  if (walk && !read.length) return [];
  const rows = walk ? read : lit.length ? lit : rowsIn;
  // each row's owners, in byte order, and its runs of bytes no value
  // owns (`free`: one item a run, "(unmapped)")
  const perRow = rows.map((r) => {
    const os: { id: string; cells: El[]; free?: boolean }[] = [];
    for (const c of all(r, ":scope > .word .b[data-g]")) {
      if (!c.dataset.owners) {
        const id = `#free:${slotOf(r)}:${c.dataset.g}`;
        if (!os.some((o) => o.id === id)) os.push({ id, cells: [], free: true });
        os.find((o) => o.id === id)!.cells.push(c);
        continue;
      }
      for (const id of c.dataset.owners!.split("|")) {
        if (!os.some((o) => o.id === id)) os.push({ id, cells: [] });
        os.find((o) => o.id === id)!.cells.push(c);
      }
    }
    return os;
  });
  const owners = perRow.flat().filter((o) => !o.free);
  // (a slot the selection consulted for its number, its anchor: a note;
  // only that, if its bytes were not read)
  const r0 = rowsIn.length === 1 && rowState(rowsIn[0]).rel ? rowsIn[0]
    : null;
  const anchor = r0 && data(r0)?.light.anchors?.get(slotOf(r0));
  const anchorNote = anchor ? noteItem(["(anchor slot for ",
    { name: shortKeys(anchor) }, ")"], " · ", { fixed: true, seg: 0 })
    : null;
  if (anchorNote && !data(r0!)?.light.relReads?.has(slotOf(r0!))) {
    return [anchorNote];
  }
  if (!owners.length) {
    if (anchorNote) return [anchorNote];
    // (a row no value owns, pointed at: its bytes one "(unmapped)" run,
    // badged, as in a row that has values; not in a walkthrough)
    if (walk) return [];
    return perRow.flatMap((os, r) => os.filter((o) => o.free &&
      o.cells.some((c) => c.classList.contains("fl"))).map((o) =>
      ({ ...noteItem(["(unmapped)"], r ? " / " : " · ", { k: "pnone" }),
        seg: r, id: o.id })));
  }
  // (a length part names its value; another part, as vanilla, by its id)
  const path = (id: string) => id.replace(/#length$/, "");
  const ids = all(root, ".b[data-owners]")
    .flatMap((c) => c.dataset.owners!.split("|")).map(path);
  // a name's colour: its bytes' now (the selection's yellow, pk0, for a
  // lit byte with no child colour; a consulted value's, its related
  // classes); none where they are not lit
  const colour = (cells: El[]) => {
    const bs = cells.map(byteLight);
    const on = bs.filter((b) => b.hl);
    return on.length ? on[0].k : bs.find((b) => b.rel)?.rel ?? null;
  };
  // (muted where its bytes are: an echo)
  const muted = (cells: El[]) => {
    const on = cells.map(byteLight).filter((b) => b.hl);
    return on.length > 0 && on.every((b) => b.muted);
  };
  const item = (cells: El[], text: string, sep = " · "): Item =>
    ({ text, k: colour(cells), muted: muted(cells), sep });
  // (several slots in one colour: the value they make up, by its path)
  const ks = new Set(owners.map((o) => colour(o.cells)));
  const ps = [...new Set(owners.map((o) => path(o.id)))];
  let common = ps[0];
  while (common && !ps.every((p) => p === common ||
    p.startsWith(common + ".") || p.startsWith(common + "["))) {
    common = common.replace(/(\.[^.[\]]+|\[[^\]]*\])$/, "");
    if (!/[.[]/.test(common) && !ps.every((p) => p.startsWith(common))) {
      common = "";
    }
  }
  if (rows.length > 1 && ks.size <= 1) {
    return [item(owners.flatMap((o) => o.cells), common ? shortKeys(common)
      : ps.map(shortKeys).join(" · "))];
  }
  const parent = (p: string) =>
    p.match(/^(.*)(\.[^.[\]]+|\[[^\]]*\])$/)?.[1] ?? "";
  const base = rows.length > 1 ? common : null;
  const named = (p: string, one: boolean) => {
    if (base && p.startsWith(base) && p !== base) {
      return p.slice(base.length).replace(/^\./, "");
    }
    return one || parent(p) === "" ? shortKeys(p) : p.slice(
      parent(p).length).replace(/^\./, "");
  };
  const label = (o: { id: string }, one: boolean) => {
    const p = path(o.id);
    const own = ids.some((q) => q.startsWith(p + "["));
    if (one && own) return "length";
    if (o.id.endsWith("#length") || own) return `${named(p, one)}.length`;
    return named(p, one);
  };
  const out: Item[] = [];
  perRow.forEach((os, r) => {
    os.forEach((o, n) => {
      const sep = n === 0 && r ? " / " : " · ";
      // (no "(unmapped)" in a walkthrough: it is about where bytes are)
      if (o.free && walk) return;
      const x = o.free ? noteItem(["(unmapped)"], sep, { k: o.cells.some(
        (c) => c.classList.contains("fl")) ? "pnone" : null })
        : item(o.cells, label(o, owners.length === 1), sep);
      x.seg = r;
      // (a value running on into the next slot: named once)
      const prev = out.at(-1);
      if (prev && prev.id === o.id) return;
      x.id = o.id;
      out.push(x);
    });
  });
  // (read and an anchor: its names, then the note)
  if (anchorNote) out.push({ ...anchorNote, seg: out.at(-1)?.seg ?? 0 });
  return out;
}

// a note's prose (italic) and names (as names are)
const noteHtml = (note: Note) => note.map((p) => typeof p === "string"
  ? `<span class="pprose">${esc(p)}</span>`
  : `<span class="pnm">${esc(p.name)}</span>`).join("");

// The names a popover shows, `keep` of them (indices), in byte order,
// slot by slot (" / " between slots): a coloured one as a badge, the
// rest plain; "…" where names or slots were cut
function whatHtml(items: Item[], keep: number[]) {
  const kept = new Set(keep);
  const segs = [...new Set(items.map((x) => x.seg ?? 0))];
  const cut = '<span class="pcut">…</span>';
  const parts: string[] = [];
  for (const g of segs) {
    // (a cut "(unmapped)" leaves its "…", as any cut item)
    const idx = items.map((x, i) => [x, i] as const)
      .filter(([x]) => (x.seg ?? 0) === g).map(([, i]) => i);
    const on = idx.filter((i) => kept.has(i));
    if (!on.length) {
      if (parts.at(-1) !== cut) parts.push(cut);
      continue;
    }
    let seg = "";
    // (by place in the slot's shown items: a cut is a gap there)
    let last = idx[0] - 1;
    for (const i of on) {
      if (idx.indexOf(i) !== idx.indexOf(last) + 1) {
        seg += `${seg ? " · " : ""}${cut}`;
      }
      const x = items[i];
      // (bytes no value owns: pfree; badged, pointed at, in no colour)
      seg += `${seg ? " · " : ""}<code class="pname${x.free ? " pfree" : ""}${
        x.k ? ` pbadge ${x.k}` : ""}${x.k && x.muted ? " muted" : ""}">${
        x.note ? noteHtml(x.note) : esc(x.text)}</code>`;
      last = i;
    }
    if (last !== idx.at(-1)) seg += ` · ${cut}`;
    parts.push(seg);
  }
  return parts.join(" / ");
}

// Fit a popover's names to its room, by content only (never by CSS):
// plain names first, farthest from the coloured ones (with several
// slots, never a slot's first or last); one slot: then badges from the
// middle, keeping the first and last; several: then each slot down to
// its first and last, then the middle slots. Then the "how" part's
// addresses; then names from the middle; then none but "…"; then a
// badge's own addresses.
function fitWhat(pop: Pop) {
  const items = pop._what;
  const what = pop.querySelector(".pwhat");
  if (!items?.length || !what) return;
  const room = parseFloat(pop.style.maxWidth) || Infinity;
  const line = pop.querySelector<El>(".pop-how")!;
  const over = () => line.scrollWidth + 16 > room;
  let keep = items.map((_, i) => i);
  const segs = [...new Set(items.map((x) => x.seg ?? 0))];
  const segOf = (i: number) => items[i].seg ?? 0;
  // (a slot's first or last name)
  const ends = (i: number) => {
    const by = (j: number) => !items[j].free && segOf(j) === segOf(i);
    return !(items.some((_, j) => by(j) && j < i) &&
      items.some((_, j) => by(j) && j > i));
  };
  const C = keep.filter((i) => items[i].k);
  const near = (i: number) => C.length
    ? Math.min(...C.map((c) => Math.abs(c - i))) : i;
  const render = () => {
    what.innerHTML = whatHtml(items, keep);
  };
  const many = segs.length > 1;
  while (over()) {
    // (an "(unmapped)" first, then the plain names: the order of the
    // cuts; each leaves its "…"; never a fixed note, an anchor's)
    const free = keep.filter((i) => items[i].free && !items[i].k &&
      !items[i].fixed);
    const plain = free.length ? free
      : keep.filter((i) => !items[i].k && !items[i].fixed &&
        (!many || !ends(i)));
    if (plain.length) {
      // (the farthest from a coloured name; the later one on a tie)
      const far = plain.reduce((a, b) => near(b) >= near(a) ? b : a);
      keep = keep.filter((i) => i !== far);
    } else if (!many) {
      if (keep.length <= 2) break;
      keep.splice(Math.floor(keep.length / 2), 1);
    } else {
      // (the fullest slot, down by its middle name)
      const inner = segs.map((g) => keep.filter((i) => segOf(i) === g))
        .filter((l) => l.length > 2).sort((a, b) => b.length - a.length)[0];
      if (inner) {
        const m = inner[Math.floor(inner.length / 2)];
        keep = keep.filter((i) => i !== m);
      } else {
        // (a middle slot, whole)
        const mid = segs.slice(1, -1).filter((g) => keep.some((i) =>
          segOf(i) === g));
        if (!mid.length) break;
        const g = mid[Math.floor(mid.length / 2)];
        keep = keep.filter((i) => segOf(i) !== g);
      }
    }
    render();
  }
  const how = pop.querySelector(".phow");
  if (over() && how) {
    how.textContent = how.textContent!.replace(
      /0x[0-9a-f]+…([0-9a-f]{4})/g, "…$1");
  }
  while (over() && keep.length > 2) {
    keep.splice(Math.floor(keep.length / 2), 1);
    render();
  }
  if (over() && keep.length) {
    keep = [];
    render();
  }
  if (over()) {
    for (const c of all(pop, ".pname")) {
      c.textContent = c.textContent!.replace(
        /0x([0-9a-f]{3})[0-9a-f]*…[0-9a-f]*([0-9a-f]{3})/g, "0x$1…$2");
    }
  }
}

// The slot popover for a run: how its slots were found ("how : what",
// ", n slots" for several), and what the transaction did to them
function popFor(root: El, rows: El[], more: number): Pop {
  // (in a walkthrough: no facts of the transaction, which is not what it
  // is about; the keys by the names its steps use)
  const light = data(rows[0])?.light;
  const facts = light?.walk ? [] : [...new Set(rows.map((r) =>
    r.dataset.facts))].filter(Boolean);
  const pop = document.createElement("span") as Pop;
  pop.className = "pop";
  pop.setAttribute("role", "status");
  const what = whatIn(root, rows);
  const named = (t: string) => light?.names?.size ? t.replace(
    /0x[0-9a-f]{4}…[0-9a-f]{4}/g, (h) => light.names!.get(h) ?? h) : t;
  for (const w of what) w.text = named(w.text);
  pop._what = what;
  // (a run with one lit row names that row's values: "how : what")
  const one = rows.filter((r) => rowState(r).on).length === 1 &&
    rows.length > 1;
  // (in a walkthrough, a run with nothing read yet: the slots it has
  // computed, by their names; not the whole block it stands for)
  // (and a run with something read: the slots read, not the block)
  const onRows = rows.filter((r) => rowState(r).on);
  const readRows = rows.filter((r) => rowLit(data(r), light, r) &&
    !light?.wholes?.has(slotOf(r)));
  const shown = !light?.walk ? rows : readRows.length ? readRows
    : onRows.length ? onRows : rows;
  const [, how, n] = named(runName(shown)).match(/^(.*?)(, \d+ slots)?$/)!;
  const count = one ? "" : n;
  pop.innerHTML = `<span class="pop-how"><span class="phow">${esc(
    what.length ? how : named(runName(shown)))}</span>${what.length
    ? ` : <span class="pwhat">${whatHtml(what, what.map((_, i) => i))
    }</span>${count ?? ""}` : ""}${facts.length
    ? ` · ${esc(facts.join(" / "))}` : ""}${more ? ` · +${more} more`
    : ""}</span>`;
  return pop;
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right - 0.5 &&
  b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

// Where annotations may go: inside the content of every box around the
// dumps that scrolls or clips, as it is before they are added
function bounds(root: El): Rect[] {
  const out: Rect[] = [];
  for (let e = root.querySelector<El>(".views") ?? root;
    e && e !== document.body; e = e.parentElement!) {
    const cs = getComputedStyle(e);
    if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
    const r = e.getBoundingClientRect();
    const top = r.top + e.clientTop - e.scrollTop;
    const left = r.left + e.clientLeft - e.scrollLeft;
    out.push({ top, left, bottom: top + e.scrollHeight,
      right: left + e.scrollWidth });
  }
  return out;
}
// (a card's few px of padding may hang past the left edge)
const inside = (r: Rect, bs: Rect[]) => bs.every((b) =>
  r.top >= b.top - 0.5 && r.bottom <= b.bottom + 0.5 &&
  r.left >= b.left - 8 && r.right <= b.right + 0.5);
// What an annotation covers on screen
const rects = (el: El): Rect[] => [el.getBoundingClientRect()];

// The annotations of one dump, per run of lit rows: the slot popover
// (under the run; else over it; never over a lit row's address, lit
// bytes or another annotation; none where there is no room)
function annotate(root: El, v: El, taken: Rect[], room: Rect[]) {
  const runList = runs(v);
  if (!runList.length) return;
  const fits = (el: El) => {
    const rs = rects(el);
    if (rs.some((r) => taken.some((t) => overlaps(r, t)) ||
      !inside(r, room))) return false;
    taken.push(...rs);
    return true;
  };
  const labels = all(v, `${ROWS} > .addr`).filter((e) => {
    const st = rowState(e.closest<El>(".wrow")!);
    return st.on || st.only || st.known;
  }).map((e) => ({ row: e.closest<El>(".wrow")!,
    r: e.getBoundingClientRect() }));
  // (step 0 of a walkthrough: its slots, no labels)
  const quiet = !!data(v)?.light.quiet;
  for (const run of runList) {
    // the run's addresses, tinted as one rounded group in the gutter
    // (not at step 0, which has no labels: vanilla)
    if (!quiet) run.forEach((r, k) => r.querySelector(":scope > .addr")!
      .classList.add("grp", ...(k === 0 ? ["grp-top"] : []),
        ...(k === run.length - 1 ? ["grp-end"] : [])));
    if (!quiet) {
      const pop = popFor(root, run, 0);
      // (a run a walkthrough found at an earlier step: a muted label;
      // not the current step's gutters: those are its own)
      if (run.every((r) => rowState(r).known && !data(r)?.light.gutters.has(
        slotOf(r)))) pop.classList.add("kept");
      // (a run the selection only consulted: the same light label)
      if (consulted(run[0])) pop.classList.add("kept", "related");
      const ways = ["under", "over"];
      let placed = false;
      for (const way of ways) {
        const prow = way === "over" ? run[0] : run.at(-1)!;
        const addr = prow.querySelector<El>(".addr")!;
        pop.classList.toggle("under", way === "under");
        addr.append(pop);
        addr.classList.add("popped");
        // (in a view transition: it moves with its row, over the rows:
        // transition.ts)
        const a = prow.querySelector<El>(".a")!;
        place(pop, a);
        // (its names, cut to its room; then placed again, at its width)
        const over = () => pop.querySelector<El>(".pop-how")!.scrollWidth +
          16 > parseFloat(pop.style.maxWidth);
        if (over()) fitWhat(pop);
        // (still too wide, all its names cut: a narrow page. It wraps,
        // over the rows, rather than run out of its box)
        if (over()) pop.classList.add("wrap");
        place(pop, a);
        const r = pop.getBoundingClientRect();
        // (one rule for every label, muted or not; and never outside the
        // rows' box: nothing is above the first row, nor below the last:
        // vanilla 282d480)
        const rows = v.querySelector(".rows")!.getBoundingClientRect();
        const out = r.top < rows.top - 0.5 || r.bottom > rows.bottom + 0.5;
        if (!out && !labels.some((t) => !run.includes(t.row) &&
          overlaps(t.r, r)) && fits(pop)) {
          placed = true;
          break;
        }
        addr.classList.remove("popped");
      }
      if (!placed) pop.remove();
    }
  }
}

// Remove a dump's overlays
export function clearOverlays(root: El) {
  root.querySelectorAll(".pop, .bruler").forEach((p) =>
    p.remove());
  root.querySelectorAll(".addr.popped, .addr.grp").forEach((a) =>
    a.classList.remove("popped", "grp", "grp-top", "grp-end"));
}

// Draw the overlays of a dumps box (vanilla paint, after the lighting)
export function drawOverlays(root: El) {
  clearOverlays(root);
  const views = all(root, ".view").filter((v) => !v.hidden);
  const taken = all(root, ".view .rows .word .b[data-i]")
    .filter((c) => byteLight(c).hl).map((c) =>
      c.getBoundingClientRect() as Rect);
  const room = bounds(root);
  for (const v of views) annotate(root, v, taken, room);
  // a walkthrough step about bytes in a slot: their positions, 0 to 31,
  // over that slot (an overlay, like a popover)
  for (const v of views) {
    const at = (v as El & { _data?: ViewData })._data?.light.ruler;
    const row = at && v.querySelector<El>(`.wrow[data-slot="${at}"]`);
    const w = row && row.querySelector<El>(":scope > .word");
    if (!row || !w) continue;
    const el = document.createElement("div");
    el.className = "bruler";
    el.setAttribute("aria-hidden", "true");
    el.style.left = `${w.offsetLeft}px`;
    // (above the slot, over the "⋯" line before it, when there is one)
    // (a run's first row: the line before its run)
    if ((row.previousElementSibling ?? row.parentElement
      ?.previousElementSibling)?.classList.contains("gap")) {
      el.classList.add("above");
    }
    el.innerHTML = `<span class="blabel">byte</span><div class="bytes">${
      [0, 8, 16, 24].map((k) => `<span class="oct">${Array.from(
        { length: 8 }, (_, i) => `<span class="b">${k + i}</span>`).join("")
      }</span>`).join("")}</div>`;
    row.append(el);
    // (only where it covers no row's bytes and no label: a step's form
    // gives the positions too)
    const r = el.getBoundingClientRect();
    const rows = all(v, `${ROWS} > .word`).map((x) =>
      x.getBoundingClientRect() as Rect);
    if (taken.some((t) => overlaps(r, t)) || rows.some((t) =>
      overlaps(r, t))) el.remove();
    else taken.push(r);
  }
}
