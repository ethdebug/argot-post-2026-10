// The dumps' overlays (vanilla panel.js at d235617: paint's second half,
// annotate, popFor, whatIn, whatHtml, fitWhat, place, block, fit, the
// tray): drawn on the rendered dumps after each render, from what the
// views lit (their classes: .b.hl, .pkN, .muted, .wrow.on, .gut). They
// are overlays: nothing in the dumps moves for them.
type El = HTMLElement;
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
    if (el.classList.contains("wrow") && (el.classList.contains("on") ||
      el.classList.contains("only") || el.classList.contains("known") ||
      el.classList.contains("gut"))) {
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
  const lit = rowsIn.filter((r) => r.classList.contains("on"));
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
  const path = (id: string) => id.replace(/#length$/, "");
  const ids = all(root, ".b[data-owners]")
    .flatMap((c) => c.dataset.owners!.split("|")).map(path);
  // a name's colour: its bytes' now (the selection's yellow, pk0, for a
  // lit byte with no child colour); none where they are not lit
  const colour = (cells: El[]) => {
    const on = cells.filter((c) => c.classList.contains("hl"));
    if (!on.length) return null;
    return [...on[0].classList].find((x) => /^pk\d$/.test(x)) ?? "pk0";
  };
  // (muted where its bytes are: an echo)
  const muted = (cells: El[]) => cells.some((c) =>
    c.classList.contains("hl")) && cells.filter((c) =>
    c.classList.contains("hl")).every((c) => c.classList.contains("muted"));
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
  const one = rows.filter((r) => r.classList.contains("on")).length === 1 &&
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
    const at = [...mine, ...theirs].filter((c) => c.classList.contains("hl"))
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
  const words = all(v, ".rows > .wrow > .word").map((e) =>
    ({ row: e.closest<El>(".wrow")!, r: e.getBoundingClientRect() }));
  const labels = all(v, ".rows > .wrow:is(.on, .only, .known) > .addr")
    .map((e) => ({ row: e.closest<El>(".wrow")!,
      r: e.getBoundingClientRect() }));
  const pinned: { run: El[]; el: El }[] = [];
  for (const run of runList) {
    // the run's addresses, tinted as one rounded group in the gutter
    run.forEach((r, k) => r.querySelector(":scope > .addr")!.classList.add(
      "grp", ...(k === 0 ? ["grp-top"] : []),
      ...(k === run.length - 1 ? ["grp-end"] : [])));
    {
      const pop = popFor(root, run, 0);
      // (a run a walkthrough found at an earlier step: a muted label)
      if (run.every((r) => r.classList.contains("known") &&
        !r.classList.contains("gut"))) pop.classList.add("kept");
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
        const kept = pop.classList.contains("kept") && words.some((t) =>
          !run.includes(t.row) && overlaps(t.r, r));
        if (!kept && !labels.some((t) => !run.includes(t.row) &&
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
  root.querySelectorAll(".pop, .cmp, .tray, .pin").forEach((p) => p.remove());
  root.querySelectorAll(".addr.popped, .addr.grp").forEach((a) =>
    a.classList.remove("popped", "grp", "grp-top", "grp-end"));
}

// Draw the overlays of a dumps box (vanilla paint, after the lighting):
// `cards`: the other state's picture beside each lit run
export function drawOverlays(root: El, o: { cards: boolean;
  names?: Partial<OverlayNames> }) {
  clearOverlays(root);
  const views = all(root, ".view").filter((v) => !v.hidden);
  const lit = () => all(root, ".b.hl").map((c) =>
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
