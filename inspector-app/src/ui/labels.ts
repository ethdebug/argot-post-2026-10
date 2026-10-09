// The annotated layer's labels, drawn over a dump (an overlay: nothing
// in the dump moves for them). The DOM gives the geometry: each row's
// lines of byte cells (a phone's word has two), the "⋯" gap lines and
// the margin's room; engine/placement.ts says where each label goes.
import type { Group, Part, Unit } from "../engine/annotated";
import { place, type Ask, type Cell, type Line } from "../engine/placement";
import { lines as dumpLines } from "./overlays";

type El = HTMLElement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const html = (ps: Part[]) => ps.map((p) => p.k === undefined
  ? `<span>${esc(p.text)}</span>`
  : `<span class="ak pk${p.k}">${esc(p.text)}</span>`).join("");

// (the gap between a margin label and the dump: its leader line)
const LEAD = 14;

// The reveal's stagger: a unit fades in this many ms after the one
// before it, all of them within 200ms (and each fade 280ms: 500 at most)
export const stagger = (n: number) => n > 1 ? Math.min(40, 200 / (n - 1))
  : 0;

// a view's lines, relative to its box: rows' lines of cells (their units
// from data-unit; zero from .z) and gap lines over the rows' bytes
function geometry(v: El) {
  const box = v.getBoundingClientRect();
  const out: (Line & { top: number; height: number })[] = [];
  const rowLines = new Map<string, string[]>();
  const bytes = v.querySelector<El>(".wrow[data-slot] .word")
    ?.getBoundingClientRect();
  for (const el of dumpLines(v)) {
    const r = el.getBoundingClientRect();
    if (el.classList.contains("gap")) {
      if (el.classList.contains("room") || !bytes) continue;
      out.push({ id: `gap:${out.length}`, kind: "gap",
        x0: bytes.left - box.left, x1: bytes.right - box.left,
        top: r.top - box.top, height: r.height });
      continue;
    }
    const slot = el.dataset.slot;
    if (!slot) continue;
    const cells = [...el.querySelectorAll<El>(":scope > .word .b")];
    const by = new Map<number, { cells: Cell[]; top: number;
      height: number }>();
    for (const c of cells) {
      const cr = c.getBoundingClientRect();
      const k = Math.round(cr.top - box.top);
      if (!by.has(k)) by.set(k, { cells: [], top: cr.top - box.top,
        height: cr.height });
      by.get(k)!.cells.push({ x0: cr.left - box.left, x1: cr.right - box.left,
        unit: c.dataset.unit === undefined ? null : +c.dataset.unit,
        zero: c.classList.contains("z") });
    }
    // (a word abbreviated: one line, no cells to put a label in)
    if (!by.size) {
      by.set(0, { cells: [], top: r.top - box.top, height: r.height });
    }
    const ids: string[] = [];
    [...by.values()].forEach((x, k) => {
      const id = `${slot}:${k}`;
      ids.push(id);
      out.push({ id, kind: "row", cells: x.cells, top: x.top,
        height: x.height });
    });
    rowLines.set(slot, ids);
  }
  return { box, lines: out, rowLines };
}

// Draw a dump's labels: each group's, its main label first (`units`:
// whose labels are hand-written, and their order, for the fade's
// stagger)
export function drawLabels(v: El, units: Unit[], groups: Group[]) {
  v.querySelector(":scope > .alabels")?.remove();
  if (!groups.length) return;
  const layer = document.createElement("div");
  layer.className = "alabels";
  v.append(layer);
  const { box, lines, rowLines } = geometry(v);
  // each label's texts, measured in place
  const order = [...groups.filter((g) => g.main),
    ...groups.filter((g) => !g.main)];
  const els = order.map((g) => g.label.map((ps) => {
    const el = document.createElement("span");
    el.className = `alabel${units[g.unit].hand ? " hand" : ""}${
      g.main ? "" : " more"}`;
    el.innerHTML = html(ps);
    el.style.visibility = "hidden";
    layer.append(el);
    return el;
  }));
  const widths = els.map((es) => es.map((e) => e.getBoundingClientRect()
    .width));
  const asks: Ask[] = order.map((g, i) => ({ unit: g.unit,
    lines: g.rows.flatMap((r) => rowLines.get(r) ?? []), widths: widths[i] }));
  // the margin: right of the rows, as far as the figure goes
  const rows = v.querySelector<El>(".rows")!.getBoundingClientRect();
  const end = (v.closest<El>(".lens") ?? document.body)
    .getBoundingClientRect().right;
  const mx = rows.right - box.left + LEAD;
  const spots = place(lines, asks, { margin: end - rows.right - LEAD - 4 });
  const step = stagger(units.length);
  for (const [i, es] of els.entries()) {
    const s = spots.find((x) => x.ask === i);
    es.forEach((e, k) => k !== s?.variant && e.remove());
    const e = s && es[s.variant];
    if (!s || !e) continue;
    const line = lines.find((l) => l.id === s.line)!;
    const h = e.getBoundingClientRect().height;
    e.style.visibility = "";
    e.style.left = `${s.kind === "margin" ? mx : s.x}px`;
    e.style.top = `${line.top + (line.height - h) / 2}px`;
    e.style.setProperty("--d", `${Math.round(order[i].unit * step)}ms`);
    e.dataset.unit = String(order[i].unit);
    e.dataset.kind = s.kind;
    if (s.kind === "margin") e.classList.add("margin");
  }
}
