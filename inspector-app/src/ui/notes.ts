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

// A note's two shapes: its `how` on a line of its own and its items a
// line each group; or one line, "how : what", fitted as the popovers
// are (overlays.ts fitWhat)
function shapes(n: Note, units: Unit[]) {
  const k = (u?: number) => u === undefined ? undefined : units[u].k;
  const how = pname(n.how, n.badge, k(n.badge));
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
  // (inside its panel's rows, side to side; the stack's, to the next
  // panel on its right or the figure's edge)
  const lens = v.closest(".lens") ?? v;
  const mine = v.getBoundingClientRect();
  const beside = [...lens.querySelectorAll(".view")].map((x) =>
    x.getBoundingClientRect()).filter((r) => r.left >= mine.right - 1 &&
    r.top < mine.bottom && r.bottom > mine.top).map((r) => r.left - 8);
  const rows0 = rowsBox();
  const right = v.classList.contains("abbr") ? Math.min(document
    .documentElement.clientWidth - 4, lens.getBoundingClientRect().right
    - 4, ...beside) - vb.left : rows0.r;
  const room = right - rows0.l;
  const narrow = document.documentElement.clientWidth < 560;
  // each note's card: one line when it fits its room, else its value's
  // name on a line and its parts after, wrapping (never cut)
  const pops = notes.map((n, i) => {
    const s = shapes(n, units);
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
    if (pop.offsetWidth > room) {
      pop.innerHTML = s.several;
      pop.classList.add("wrap");
    }
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
    const h = pops[i].offsetHeight;
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
  const bounds = { l: rows.l - 8, r: rows.l + room, t: rows.t, b: view.b };
  const cells: Cell[] = [...v.querySelectorAll<El>(
    ".rows .word :is(.b, .ab)")].map((c) => ({
    ...rel(c.getBoundingClientRect(), vb),
    unit: c.dataset.unit === undefined ? null : +c.dataset.unit,
    zero: c.classList.contains("z") }));
  const forbid = [...v.querySelectorAll<El>(".rows .addr .a")].map((a) =>
    rel(a.getBoundingClientRect(), vb));
  const targets = notes.map((n, i) => {
    const order = [chosen[i].k, ...n.runs.map((_, k) => k).filter((k) =>
      k !== chosen[i].k)];
    return order.map((k): Target => {
      const all = runEls(n.runs[k]);
      const own = all.filter((c) => n.units.includes(+(c.dataset.unit ??
        -1)));
      const digits = own.filter((c) => !c.classList.contains("z"));
      const xs = (digits.length ? digits : own).map((c) =>
        rel(c.getBoundingClientRect(), vb));
      const ys = all.map((c) => rel(lineOf(c).getBoundingClientRect(), vb));
      return { x: (Math.min(...xs.map((r) => r.l)) +
        Math.max(...xs.map((r) => r.r))) / 2,
      t: Math.min(...ys.map((r) => r.t)),
      b: Math.max(...ys.map((r) => r.b)) };
    }).filter((t) => Number.isFinite(t.x) && Number.isFinite(t.t));
  });
  const spots = place(notes.map((n, i) => ({ units: n.units,
    shapes: [{ w: pops[i].offsetWidth, h: pops[i].offsetHeight }],
    targets: targets[i] })), cells, bounds, { narrow, reach, forbid });
  pops.forEach((pop, i) => {
    const s = spots[i];
    if (!s) {
      pop.remove();
      return;
    }
    const g = targets[i][s.target];
    const anchor = document.createElement("span");
    anchor.className = "nanchor";
    anchor.style.top = `${g.t}px`;
    anchor.style.height = `${g.b - g.t}px`;
    anchor.append(pop);
    layer.append(anchor);
    pop.classList.toggle("under", s.way === "under");
    pop.style.left = `${s.box.l}px`;
    pop.style.setProperty("--ax", `${s.ax}px`);
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
