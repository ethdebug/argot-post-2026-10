// The annotated layer's popovers: the inspector's own (overlays.ts: its
// card, its arrow on the row's address, its "how : what", its fitting),
// one a note (engine/annotated.ts), under or over one of its value's
// runs of rows: engine/placement.ts chooses which, by what each place
// would hide. Overlays: nothing in the dump moves for them.
import type { Note } from "../engine/annotated";
import { choose, type Cell, type Rect } from "../engine/placement";
import {
  fitWhat, place, whatHtml, type Item, type Pop,
} from "./overlays";

type El = HTMLElement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const rect = (e: Element): Rect => {
  const r = e.getBoundingClientRect();
  return { l: r.left, r: r.right, t: r.top, b: r.bottom };
};

// The reveal's stagger: a note fades in this many ms after the one
// before it, all within 200ms (each fade 280ms: 500 at most)
export const stagger = (n: number) => n > 1 ? Math.min(40, 200 / (n - 1))
  : 0;

// a note's popover, at one place (anchored on a row's address, under or
// over it), fitted there; its box
function at(pop: Pop, row: El, way: "under" | "over",
  room: { left: number; right: number }) {
  const addr = row.querySelector<El>(":scope > .addr")!;
  pop.classList.toggle("under", way === "under");
  pop.classList.remove("wrap");
  pop.innerHTML = pop.dataset.full!;
  addr.append(pop);
  const a = addr.querySelector<El>(".a")!;
  place(pop, a, false, room);
  const over = () => pop.querySelector<El>(".pop-how")!.scrollWidth + 16 >
    parseFloat(pop.style.maxWidth);
  if (over()) fitWhat(pop);
  if (over()) pop.classList.add("wrap");
  place(pop, a, false, room);
  return rect(pop);
}

export function drawNotes(v: El, notes: Note[]) {
  v.querySelectorAll(".pop.note").forEach((p) => p.remove());
  v.querySelectorAll(".addr.popped").forEach((a) =>
    a.classList.remove("popped"));
  // (its room: from its dump's left edge to the figure's right one; it
  // never reaches back over another panel)
  const vb = v.getBoundingClientRect();
  const room = { left: Math.max(0, vb.left - 12), right: Math.min(
    document.documentElement.clientWidth, (v.closest(".lens") ?? v)
      .getBoundingClientRect().right) };
  const row = (h: string) => v.querySelector<El>(
    `.wrow[data-slot="${h}"]`);
  // each note's popover, and the places it may take
  const pops = notes.map((n, i) => {
    const pop = document.createElement("span") as Pop;
    pop.className = "pop note";
    pop.setAttribute("role", "note");
    pop._what = n.items.map((x, k): Item => ({ text: x.text, k: null,
      muted: false, seg: x.seg, sep: k && x.seg !== n.items[k - 1].seg
        ? " / " : " · " }));
    pop.dataset.full = `<span class="pop-how"><span class="phow">${
      esc(n.how)}</span> : <span class="pwhat">${whatHtml(pop._what,
      pop._what.map((_, k) => k))}</span></span>`;
    pop.style.setProperty("--d", `${Math.round(i * stagger(
      notes.length))}ms`);
    const places = n.runs.flatMap((run) => [
      { row: row(run.at(-1)!)!, way: "under" as const },
      { row: row(run[0])!, way: "over" as const }]).filter((p) => p.row);
    return { pop, places, rects: places.map((p) => at(pop, p.row, p.way,
      room)) };
  });
  // what a place would hide: the bytes (and abbreviated words)
  const cells: Cell[] = [...v.querySelectorAll<El>(
    ".wrow[data-slot] .word :is(.b, .ab)")].map((c) => ({ ...rect(c),
    unit: c.dataset.unit === undefined ? null : +c.dataset.unit,
    zero: c.classList.contains("z") }));
  // (inside the rows, and the room kept under them; never over the
  // first row's top: the panel's title)
  const rows = rect(v.querySelector(".rows")!);
  const bounds = { l: -Infinity, r: document.documentElement.clientWidth,
    t: rows.t, b: rect(v).b };
  const picks = choose(notes.map((n, i) => ({ units: n.units,
    places: pops[i].rects })), cells, bounds);
  pops.forEach((p, i) => {
    const k = picks[i];
    if (k < 0) {
      p.pop.remove();
      return;
    }
    at(p.pop, p.places[k].row, p.places[k].way, room);
    p.pop.closest(".addr")!.classList.add("popped");
  });
}
