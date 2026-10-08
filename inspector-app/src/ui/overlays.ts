// The dumps' overlays (vanilla panel.js at d235617: paint's second half,
// annotate, popFor, whatIn, whatHtml, fitWhat, place, block, fit, the
// tray): drawn on the rendered dumps after each render, from what each
// view lights (its Light and Layout, which the Dump puts on its element:
// `ViewData`); the DOM gives only geometry and the cards' pictures. They
// are overlays: nothing in the dumps moves for them.
import type { Hex, Layout, Light } from "../engine/types";
import { byteKey } from "../engine/hex";

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
  const on = rowLit(x, x?.light, r) || x?.light.at?.row === slotOf(r);
  const only = !on && rowLit(x, x?.there, r);
  return { on, only, known: !on && !only && !!x?.light.known?.has(slotOf(r)),
    gut: !on && !only && !!x?.light.gutters.has(slotOf(r)) };
}
// a byte's lighting, from its view's Light
function byteLight(c: El) {
  const x = data(c);
  const w = c.closest<El>(".word");
  if (!x || !w) return { hl: false, k: null as string | null, muted: false };
  const key = byteKey(x.l.location, w.dataset.slot as Hex, +c.dataset.i!);
  const hl = x.light.bytes.has(key);
  const ids = (c.dataset.owners ?? "").split("|").filter(Boolean);
  const k = hl ? ids.map((id) => x.light.colours.get(id.replace(/#[a-z]+$/,
    ""))).find((y) => y !== undefined) : undefined;
  const muted = hl && ((x.light.focus !== undefined && !!k &&
    k !== x.light.focus) || !!x.light.dim?.has(key));
  return { hl, k: !hl ? null : typeof k === "number" && k ? `pk${k}` : "pk0",
    muted };
}
type Rect = { top: number; left: number; bottom: number; right: number };
interface Item { text: string; k: string | null; muted: boolean;
  sep: string; seg?: number; id?: string }
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
function runs(view: El): El[][] {
  const out: El[][] = [];
  let run: El[] | null = null;
  for (const el of [...view.querySelector(".rows")!.children] as El[]) {
    const st = el.classList.contains("wrow") ? rowState(el) : null;
    if (st && (st.on || st.only || st.known || st.gut)) {
      if (!run) out.push(run = []);
      run.push(el);
    } else if (!el.classList.contains("cmp")) {
      run = null;
    }
  }
  return out;
}

// One name for a run of slots: "slot 0", "slots 0–2",
// "keccak(slot 0), 2 slots", or the names in turn
function runName(rows: El[]): string {
  const names = rows.map((r) => r.dataset.name!);
  if (names.length === 1) return names[0];
  const plain = names.map((n) => n.match(/^(slot|word) (\S+)$/));
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

// What a run of slots holds, as the pointer names it: each slot's
// values in byte order, " / " between slots; a value's other regions by
// their role (`name.length`; an array's own word alone: `length`);
// several slots in one colour: the value they make up, by its path. A
// name is a badge only where its own bytes are lit now, in their colour.
function whatIn(root: El, rowsIn: El[]): Item[] {
  // (the lit rows of a run, if some are: a run may take in rows an
  // earlier step found)
  const lit = rowsIn.filter((r) => rowState(r).on);
  const rows = lit.length ? lit : rowsIn;
  // each row's owners, in byte order
  const perRow = rows.map((r) => {
    const os: { id: string; cells: El[] }[] = [];
    for (const c of all(r, ":scope > .word .b[data-owners]")) {
      for (const id of c.dataset.owners!.split("|")) {
        if (!os.some((o) => o.id === id)) os.push({ id, cells: [] });
        os.find((o) => o.id === id)!.cells.push(c);
      }
    }
    return os;
  });
  const owners = perRow.flat();
  if (!owners.length) return [];
  // (a length part names its value; another part, as vanilla, by its id)
  const path = (id: string) => id.replace(/#length$/, "");
  const ids = all(root, ".b[data-owners]")
    .flatMap((c) => c.dataset.owners!.split("|")).map(path);
  // a name's colour: its bytes' now (the selection's yellow, pk0, for a
  // lit byte with no child colour); none where they are not lit
  const colour = (cells: El[]) => {
    const on = cells.map(byteLight).filter((b) => b.hl);
    return on.length ? on[0].k : null;
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
      const x = item(o.cells, label(o, owners.length === 1), n === 0 && r
        ? " / " : " · ");
      x.seg = r;
      // (a value running on into the next slot: named once)
      const prev = out.at(-1);
      if (prev && prev.id === o.id) return;
      x.id = o.id;
      out.push(x);
    });
  });
  return out;
}

// The names a popover shows, `keep` of them (indices), in byte order,
// slot by slot (" / " between slots): a coloured one as a badge, the
// rest plain; "…" where names or slots were cut
function whatHtml(items: Item[], keep: number[]) {
  const kept = new Set(keep);
  const segs = [...new Set(items.map((x) => x.seg ?? 0))];
  const cut = '<span class="pcut">…</span>';
  const parts: string[] = [];
  for (const g of segs) {
    const idx = items.map((x, i) => [x, i] as const)
      .filter(([x]) => (x.seg ?? 0) === g).map(([, i]) => i);
    const on = idx.filter((i) => kept.has(i));
    if (!on.length) {
      if (parts.at(-1) !== cut) parts.push(cut);
      continue;
    }
    let seg = "";
    let last = idx[0] - 1;
    for (const i of on) {
      if (i !== last + 1) seg += `${seg ? " · " : ""}${cut}`;
      const x = items[i];
      seg += `${seg ? " · " : ""}<code class="pname${x.k ? ` pbadge ${x.k}`
        : ""}${x.k && x.muted ? " muted" : ""}">${esc(x.text)}</code>`;
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
  const ends = (i: number) => !(items.some((_, j) => segOf(j) === segOf(i) &&
    j < i) && items.some((_, j) => segOf(j) === segOf(i) && j > i));
  const C = keep.filter((i) => items[i].k);
  const near = (i: number) => C.length
    ? Math.min(...C.map((c) => Math.abs(c - i))) : i;
  const render = () => {
    what.innerHTML = whatHtml(items, keep);
  };
  const many = segs.length > 1;
  while (over()) {
    const plain = keep.filter((i) => !items[i].k && (!many || !ends(i)));
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
  const facts = [...new Set(rows.map((r) => r.dataset.facts))]
    .filter(Boolean);
  const pop = document.createElement("span") as Pop;
  pop.className = "pop";
  pop.setAttribute("role", "status");
  const what = whatIn(root, rows);
  pop._what = what;
  // (a run with one lit row names that row's values: "how : what")
  const one = rows.filter((r) => rowState(r).on).length === 1 &&
    rows.length > 1;
  const [, how, n] = runName(rows).match(/^(.*?)(, \d+ slots)?$/)!;
  const count = one ? "" : n;
  pop.innerHTML = `<span class="pop-how"><span class="phow">${esc(
    what.length ? how : runName(rows))}</span>${what.length
    ? ` : <span class="pwhat">${whatHtml(what, what.map((_, i) => i))
    }</span>${count ?? ""}` : ""}${facts.length ? ` · ${esc(facts.join(
    " / "))}` : ""}${more ? ` · +${more} more` : ""}</span>`;
  return pop;
}

// A compare block for a run: a picture of the same rows in the OTHER
// dump (cloned as drawn there), cropped to the words where a lit byte
// differs; under the run in Before, over it in After
function block(root: El, rows: El[], side: string, label: string) {
  const other = side === "before" ? "after" : "before";
  const twins = rows.map((r) => {
    const t = root.querySelector<El>(`.view[data-side="${other}"] ` +
      `.wrow[data-slot="${r.dataset.slot}"]`);
    if (!t) return null;
    const cells = (x: El) => all(x, ":scope > .word .b");
    const [mine, theirs] = [cells(r), cells(t)];
    const at = [...mine, ...theirs].filter((c) => byteLight(c).hl)
      .map((c) => +c.dataset.i!);
    return at.some((i) => mine[i]?.textContent !== theirs[i]?.textContent)
      ? t : null;
  }).filter(Boolean) as El[];
  if (!twins.length) return null;
  const el = document.createElement("div");
  el.className = `cmp ${side}`;
  el.dataset.label = label;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<span class="cmp-tag">${esc(label)}</span>` +
    `<div class="cmp-frame"><div class="cmp-photo"></div></div>`;
  const photo = el.querySelector(".cmp-photo")!;
  for (const t of twins) {
    const c = t.cloneNode(true) as El;
    c.querySelectorAll(".pop, .cmp").forEach((x) => x.remove());
    for (const x of [c, ...all(c, "*")]) {
      for (const a of ["tabindex", "role", "aria-label", "title",
        "data-slot", "data-side", "data-owners", "data-g", "data-name",
        "data-facts", "data-full"]) x.removeAttribute(a);
    }
    c.dataset.of = t.dataset.slot; // which slot it pictures
    photo.append(c);
  }
  return el;
}

// Size and place a block: whole words, from the gutter to the end of the
// 32 bytes; the picture's columns stay on the run's columns
function fit(el: El, rows: El[]) {
  const row = rows[0].getBoundingClientRect();
  el.querySelector<El>(".cmp-photo")!.style.width = `${row.width}px`;
  // 6px of room left of the addresses (CSS), 3px right of the bytes
  el.querySelector<El>(".cmp-frame")!.style.width = `${row.width + 9}px`;
  el.style.left = "0px";
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
const rects = (el: El): Rect[] => all(el, ".cmp-frame, .cmp-tag")
  .map((e) => e.getBoundingClientRect() as Rect)
  .concat(el.classList.contains("pop") ? [el.getBoundingClientRect()] : []);

export interface OverlayNames {
  before: string; after: string;
  dumps: { before: string; after: string };
}
const NAMES: OverlayNames = { before: "before", after: "after",
  dumps: { before: "Before", after: "After" } };

// The annotations of one dump, per run of lit rows: the slot popover
// (over the run in Before, under it in After; else the other way; never
// over a lit row's address, lit bytes or another annotation), and the
// compare block; one with no room goes, labelled, to the tray
function annotate(root: El, v: El, compare: boolean, names: OverlayNames,
  tray: El, taken: Rect[], room: Rect[], force?: Set<string>) {
  const runList = runs(v);
  if (!runList.length) return [];
  const side = v.dataset.side ?? "after";
  const other = side === "before" ? "after" : "before";
  const fits = (el: El) => {
    const rs = rects(el);
    if (rs.some((r) => taken.some((t) => overlaps(r, t)) ||
      !inside(r, room))) return false;
    taken.push(...rs);
    return true;
  };
  const labels = all(v, ".rows > .wrow > .addr").filter((e) => {
    const st = rowState(e.closest<El>(".wrow")!);
    return st.on || st.only || st.known;
  }).map((e) => ({ row: e.closest<El>(".wrow")!,
    r: e.getBoundingClientRect() }));
  const pinned: { run: El[]; el: El }[] = [];
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
      const ways = side === "before" ? ["over", "under"]
        : ["under", "over"];
      let placed = false;
      for (const way of ways) {
        const prow = way === "over" ? run[0] : run.at(-1)!;
        const addr = prow.querySelector<El>(".addr")!;
        pop.classList.toggle("under", way === "under");
        addr.append(pop);
        addr.classList.add("popped");
        const a = prow.querySelector<El>(".a")!;
        place(pop, a);
        // (its names, cut to its room; then placed again, at its width)
        if (pop.querySelector<El>(".pop-how")!.scrollWidth + 16 >
          parseFloat(pop.style.maxWidth)) fitWhat(pop);
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
    const el = compare && block(root, run, side, names[other]);
    if (!el) continue;
    (side === "before" ? run.at(-1)! : run[0]).append(el);
    fit(el, run);
    if (run.some((r) => force?.has(r.dataset.slot!)) || !fits(el)) {
      el.classList.add("pinned");
      pinned.push({ run, el });
    }
  }
  for (const { run, el } of pinned) {
    const card = document.createElement("div");
    card.className = "pin";
    card.dataset.side = side;
    card.innerHTML = `<p class="pin-head">${esc(names.dumps[side as
      "before"])} dump · ${esc(runName(run))} · ${el.classList.contains(
      "pop") ? "how the slots were found" : `the bytes ${esc(names[other as
      "before"])}`} (no room beside the lit rows)</p>`;
    card.append(el);
    tray.append(card);
    if (el.classList.contains("cmp")) fit(el, run);
  }
  return pinned;
}

// Remove a dump's overlays
export function clearOverlays(root: El) {
  root.querySelectorAll(".pop, .cmp, .tray, .pin, .bruler").forEach((p) =>
    p.remove());
  root.querySelectorAll(".addr.popped, .addr.grp").forEach((a) =>
    a.classList.remove("popped", "grp", "grp-top", "grp-end"));
}

// Draw the overlays of a dumps box (vanilla paint, after the lighting):
// `cards`: the other state's picture beside each lit run
export function drawOverlays(root: El, o: { cards: boolean;
  names?: Partial<OverlayNames> }) {
  clearOverlays(root);
  const views = all(root, ".view").filter((v) => !v.hidden);
  const lit = () => all(root, ".view .rows .word .b[data-i]")
    .filter((c) => byteLight(c).hl).map((c) =>
      c.getBoundingClientRect() as Rect);
  const compare = o.cards && lit().length > 0;
  const names = { ...NAMES, ...o.names };
  // The tray is the same for Before and After: lay the hidden dump out
  // for a moment, and note the runs whose cards would not fit there
  const force = new Set<string>();
  const hidden = all(root, ".view").filter((v) => v.hidden);
  if (compare && hidden.length === 1) {
    const hv = hidden[0];
    hv.hidden = false;
    const dry = annotate(root, hv, compare, names,
      document.createElement("div"), lit(), bounds(root));
    for (const { run, el } of dry) {
      if (el.classList.contains("cmp")) {
        for (const r of run) force.add(r.dataset.slot!);
      }
    }
    clearOverlays(hv);
    hv.hidden = true;
  }
  const tray = document.createElement("div");
  tray.className = "tray";
  const taken = lit();
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
    if (row.previousElementSibling?.classList.contains("gap")) {
      el.classList.add("above");
    }
    el.innerHTML = `<span class="blabel">byte</span><div class="bytes">${
      [0, 8, 16, 24].map((k) => `<span class="oct">${Array.from(
        { length: 8 }, (_, i) => `<span class="b">${k + i}</span>`).join("")
      }</span>`).join("")}</div>`;
    row.append(el);
    taken.push(el.getBoundingClientRect());
  }
  const room = bounds(root);
  (root.querySelector(".views") ?? root).append(tray);
  for (const v of views) {
    annotate(root, v, compare, names, tray, taken, room, force);
  }
  if (!tray.childElementCount) tray.remove();
  else {
    // over the dumps' columns, at the bottom of the window
    const r = root.getBoundingClientRect();
    tray.style.left = `${Math.max(8, r.left)}px`;
    tray.style.width = `${Math.min(r.width,
      document.documentElement.clientWidth - 16)}px`;
  }
}
