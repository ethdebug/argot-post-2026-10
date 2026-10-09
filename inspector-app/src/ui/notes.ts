// The annotated figure's popovers: the inspector's own card, arrow,
// "how : what" and badges (a value badged in the colour its bytes are
// lit in, as its popovers do), placed freely for this figure only
// (engine/placement.ts): the arrow at the centre of a run of the
// value's bytes, the card over or under it, on several lines or one.
// Overlays: nothing in the dump moves for them.
import type { Note, Unit } from "../engine/annotated";
import {
  place, roomUnder, type Cell, type Rect, type Target,
} from "../engine/placement";
import { whatHtml, type Item, type Pop } from "./overlays";

type El = HTMLElement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// a name, as the popovers write one: a badge in its value's colour, or
// plain
const pname = (text: string, u?: number, k?: number | string) =>
  u === undefined ? `<code class="pname">${esc(text)}</code>`
    : `<code class="pname pbadge pk${k}" data-unit="${u}">${esc(text)}${
      ""}</code>`;

// A note's card, "how : what", its items but those dropped (`drop` up
// to `level`); a note with no items, its name's badge alone (a stack
// item's)
function shapes(n0: Note, units: Unit[], level = 0) {
  const n = { ...n0, items: n0.items.filter((x) => !x.drop ||
    x.drop > level) };
  const k = (u?: number) => u === undefined ? undefined : units[u].k;
  const how = pname(n.how, n.badge, k(n.badge));
  if (!n.items.length) {
    const one = `<span class="pop-how">${how}</span>`;
    return { several: one, one, what: [] as Item[] };
  }
  const lines = [...new Set(n.items.map((x) => x.line))].map((l) =>
    n.items.filter((x) => x.line === l).map((x) => pname(x.text, x.unit,
      k(x.unit)))
      .join(" · "));
  const several = [how, ...lines].map((l) =>
    `<span class="pop-how">${l}</span>`).join("");
  const what: Item[] = n.items.map((x, i) => ({ text: x.text,
    k: x.unit === undefined ? null : `pk${k(x.unit)}`, muted: false,
    seg: x.seg, sep: i && x.seg !== n.items[i - 1].seg ? " / " : " · " }));
  const one = `<span class="pop-how"><span class="phow">${how}</span> : ${
    ""}<span class="pwhat">${whatHtml(what, what.map((_, i) => i))
  }</span></span>`;
  return { several, one, what };
}

const rel = (r: DOMRect, o: DOMRect): Rect => ({ l: r.left - o.left,
  r: r.right - o.left, t: r.top - o.top, b: r.bottom - o.top });

// (`rank`: each note's value's place in the reveal's sequence)
export function drawNotes(v: El, notes: Note[], units: Unit[],
  rank: number[]) {
  v.querySelector(":scope > .notes")?.remove();
  // (the room kept before: let go, to measure afresh)
  for (const e of v.querySelectorAll<El>("[data-room]")) {
    e.style.marginBottom = "";
    delete e.dataset.room;
  }
  if (!notes.length) return;
  const layer = document.createElement("div");
  layer.className = "notes";
  v.append(layer);
  const vb0 = () => layer.getBoundingClientRect();
  let vb = vb0();
  const rowsBox = () => rel(v.querySelector(".rows")!.getBoundingClientRect(),
    vb);
  // (inside its panel's rows, side to side; the stack's, inside its
  // box, beside its words)
  const rows0 = rowsBox();
  const right = v.classList.contains("abbr")
    ? rel(v.getBoundingClientRect(), vb).r - 4 : rows0.r;
  const room = right - rows0.l;
  const narrow = document.documentElement.clientWidth < 560;
  // each note's card, one line: the cards that may leave items out (a
  // record's combo, then its bestCombo) all at the fewest left out that
  // lets every one of them fit its room; else wrapping (never cut)
  const drops = notes.filter((n) => n.items.some((x) => x.drop));
  const top = Math.max(0, ...notes.flatMap((n) => n.items.map((x) =>
    x.drop ?? 0)));
  const fits = (level: number) => drops.every((n) => {
    const t = document.createElement("span");
    t.className = "pop note";
    t.style.cssText = "visibility:hidden;width:max-content";
    t.innerHTML = shapes(n, units, level).one;
    layer.append(t);
    const ok = t.offsetWidth <= room;
    t.remove();
    return ok;
  });
  let level = 0;
  while (level < top && !fits(level)) level++;
  v.dataset.dropped = String(level);
  const beside = v.classList.contains("abbr");
  const pops = notes.map((n, i) => {
    const s = shapes(n, units, level);
    const pop = document.createElement("span") as Pop;
    pop.className = "pop note under";
    pop.setAttribute("role", "note");
    pop.dataset.units = n.units.join(" ");
    pop.dataset.r = String(rank[i]);
    pop.style.visibility = "hidden";
    pop.innerHTML = s.one;
    // (its own width, never its box's: max-content)
    pop.style.width = "max-content";
    layer.append(pop);
    // (too wide for its panel: wrapped, "how : what" flowing on as few
    // lines as its room takes; a storage card's room is kept in the
    // figure, which a host pins: the fewest lines)
    if (pop.offsetWidth > room) pop.classList.add("wrap");
    if (beside) pop.classList.add("right");
    pop.style.maxWidth = `${room}px`;
    // (its size as placed: a later change, its type fitted, redraws)
    pop.dataset.w = String(pop.offsetWidth);
    for (const b of pop.querySelectorAll<El>(".pwhat .pbadge")) {
      const it = n.items.find((x) => x.text === b.textContent);
      if (it?.unit !== undefined) b.dataset.unit = String(it.unit);
    }
    return pop;
  });
  // a run's elements (its rows; flowing, memory's lines that hold its
  // words) and its value's bytes
  const runEls = (run: string[]) => run.flatMap((h) => [...v.querySelectorAll<
    El>(`.word[data-slot="${h}"] :is(.b, .ab), .b[data-row="${h}"]`)]);
  const lineOf = (c: El) => c.closest<El>(".wrow")!;
  const lines = () => [...v.querySelectorAll<El>(".rows .wrow, .rows .gap")]
    .map((e) => { const r = rel(e.getBoundingClientRect(), vb);
      return { e, t: r.t, b: r.b,
        // (a row with an address is no room: a card covers neither its
        // bytes nor its address)
        // (a row no value owns is room: its bytes are no value's)
        lit: !!e.querySelector("[data-unit]") }; });
  // (the arrow's reach, as the card's CSS draws it under a row)
  let reach = 8;
  {
    const a = document.createElement("span");
    a.className = "nanchor";
    a.style.top = "0px";
    a.style.height = "0px";
    layer.append(a);
    a.append(pops[0]);
    reach = pops[0].getBoundingClientRect().top - a.getBoundingClientRect()
      .top;
    layer.append(pops[0]);
    a.remove();
  }
  // each card's run: the one with the most free space under it (the
  // first on a tie); the room it lacks there, kept under that run's
  // last line (in both states: nothing moves when it shows)
  const ls = lines();
  const chosen = notes.map((n, i) => {
    const h = beside ? -Infinity : pops[i].offsetHeight;
    const opts = n.runs.map((run, k) => {
      const els = runEls(run);
      const last = els.map(lineOf).reduce((a, b) =>
        rel(b.getBoundingClientRect(), vb).b > rel(a.getBoundingClientRect(),
          vb).b ? b : a);
      const b = rel(last.getBoundingClientRect(), vb).b;
      return { k, last, need: roomUnder(b, h, ls.filter((x) =>
        x.t >= b - 0.5), reach) };
    });
    return opts.reduce((a, b) => b.need < a.need ? b : a);
  });
  for (const c of chosen) {
    if (!c.need) continue;
    const was = parseFloat(c.last.style.marginBottom) || 0;
    c.last.style.marginBottom = `${was + c.need}px`;
    c.last.dataset.room = "";
  }
  // then, in the figure as it now is: place each card under its run
  vb = vb0();
  const rows = rowsBox();
  const view = rel(v.getBoundingClientRect(), vb);
  const bounds = { l: rows.l - 8, r: right, t: rows.t, b: view.b };
  const cells: Cell[] = [...v.querySelectorAll<El>(
    ".rows .word :is(.b, .ab)")].map((c) => ({
    ...rel(c.getBoundingClientRect(), vb),
    unit: c.dataset.unit === undefined ? null : +c.dataset.unit,
    zero: c.classList.contains("z") }));
  // (the addresses of the rows that hold a value's bytes: a card may lie
  // over an unused row, its address too, never a value's)
  const forbid = [...v.querySelectorAll<El>(".rows .addr .a")].filter((a) =>
    a.closest(".wrow")?.querySelector("[data-unit]")).map((a) =>
    rel(a.getBoundingClientRect(), vb));
  const targets = notes.map((n, i) => {
    const order = [chosen[i].k, ...n.runs.map((_, k) => k).filter((k) =>
      k !== chosen[i].k)];
    return order.map((k): Target => {
      const wordBox = (c: El) => rel(c.getBoundingClientRect(), vb);
      const all = runEls(n.runs[k]);
      const own = all.filter((c) => n.units.includes(+(c.dataset.unit ??
        -1)));
      const digits = own.filter((c) => !c.classList.contains("z"));
      const xs = (digits.length ? digits : own).map((c) =>
        rel(c.getBoundingClientRect(), vb));
      const ys = all.map((c) => rel(lineOf(c).getBoundingClientRect(), vb));
      // (beside: at the item's word, its middle)
      if (beside) {
        const wb = own.map(wordBox);
        return { x: wb[0].r, r: wb[0].r, t: wb[0].t, b: wb[0].b };
      }
      return { x: (Math.min(...xs.map((r) => r.l)) +
        Math.max(...xs.map((r) => r.r))) / 2,
      t: Math.min(...ys.map((r) => r.t)),
      b: Math.max(...ys.map((r) => r.b)) };
    }).filter((t) => Number.isFinite(t.x) && Number.isFinite(t.t));
  });
  const spots = place(notes.map((n, i) => ({ units: n.units,
    ...beside ? { side: "right" as const } : {},
    shapes: [{ w: pops[i].offsetWidth, h: pops[i].offsetHeight }],
    targets: targets[i] })), cells, bounds, { narrow, reach, forbid });
  pops.forEach((pop, i) => {
    const s = spots[i];
    if (!s) {
      pop.remove();
      return;
    }
    const g = targets[i][s.target];
    // (the arrow's tip on its target, the card's line counted: --ax and
    // --ay are from the card's padding box)
    const line = parseFloat(getComputedStyle(pop).borderLeftWidth) || 0;
    pop.dataset.tx = String(s.way === "right" ? g.r : g.x);
    pop.dataset.ty = String((g.t + g.b) / 2);
    if (s.way === "right") {
      pop.style.left = `${s.box.l}px`;
      pop.style.top = `${s.box.t}px`;
      pop.style.setProperty("--ay", `${s.ax - line}px`);
      pop.style.visibility = "";
      return;
    }
    const anchor = document.createElement("span");
    anchor.className = "nanchor";
    anchor.style.top = `${g.t}px`;
    anchor.style.height = `${g.b - g.t}px`;
    anchor.append(pop);
    layer.append(anchor);
    pop.classList.toggle("under", s.way === "under");
    pop.style.left = `${s.box.l}px`;
    pop.style.setProperty("--ax", `${s.ax - line}px`);
    pop.style.visibility = "";
  });
}

// A value hovered (a unit; null: none): the other values' popovers the
// light, kept kind, their badges muted, as the inspector's are
export function hoverNotes(v: El, hover: number | null) {
  for (const pop of v.querySelectorAll<El>(".pop.note")) {
    const off = hover !== null && !pop.dataset.units!.split(" ")
      .includes(String(hover));
    pop.classList.toggle("kept", off);
    pop.querySelectorAll(".pbadge").forEach((b) =>
      b.classList.toggle("muted", off));
  }
}
