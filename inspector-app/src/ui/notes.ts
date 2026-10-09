// The annotated figure's popovers: the inspector's own card, arrow,
// "how : what" and badges (a value badged in the colour its bytes are
// lit in, as its popovers do), placed freely for this figure only
// (engine/placement.ts): the arrow at the centre of a run of the
// value's bytes, the card over or under it, on several lines or one.
// Overlays: nothing in the dump moves for them.
import type { Note, Unit } from "../engine/annotated";
import { place, type Cell, type Rect, type Target } from
  "../engine/placement";
import { fitWhat, whatHtml, type Item, type Pop } from "./overlays";

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
  if (!notes.length) return;
  const layer = document.createElement("div");
  layer.className = "notes";
  v.append(layer);
  // (every place in the layer's own coordinates: what the cards are
  // positioned in)
  const vb = layer.getBoundingClientRect();
  const view = rel(v.getBoundingClientRect(), vb);
  const rows = rel(v.querySelector(".rows")!.getBoundingClientRect(), vb);
  // (the stack's may reach to the figure's edge; the dumps' stay in
  // their panel)
  // (up to the next panel on its right, if one is beside it)
  const lens = v.closest(".lens") ?? v;
  const mine = v.getBoundingClientRect();
  const beside = [...lens.querySelectorAll(".view")].map((x) =>
    x.getBoundingClientRect()).filter((r) => r.left >= mine.right - 1 &&
    r.top < mine.bottom && r.bottom > mine.top).map((r) => r.left - 8);
  const edge = v.classList.contains("abbr") ? Math.min(document
    .documentElement.clientWidth - 4, lens.getBoundingClientRect().right
    - 4, ...beside) - vb.left : view.r;
  const bounds = { l: rows.l - 8, r: edge, t: rows.t, b: view.b };
  // (a phone: the figure narrow, not the panel)
  const narrow = document.documentElement.clientWidth < 560;
  // each byte (and abbreviated word): what a card would hide
  const cells: Cell[] = [...v.querySelectorAll<El>(
    ".rows .word :is(.b, .ab)")].map((c) => ({
    ...rel(c.getBoundingClientRect(), vb),
    unit: c.dataset.unit === undefined ? null : +c.dataset.unit,
    zero: c.classList.contains("z") }));
  // each note's cards, measured; its targets, the run with the most
  // digits first
  const made = notes.map((n, i) => {
    const s = shapes(n, units);
    const pops = [s.several, s.one].map((html, k) => {
      const pop = document.createElement("span") as Pop;
      pop.className = "pop note under";
      pop.setAttribute("role", "note");
      pop.dataset.units = n.units.join(" ");
      pop.innerHTML = html;
      if (k === 1) pop._what = s.what;
      pop.dataset.r = String(rank[i]);
      pop.style.visibility = "hidden";
      layer.append(pop);
      // (one line: cut to its room, as the popovers are)
      if (k === 1) {
        pop.style.maxWidth = `${bounds.r - bounds.l}px`;
        fitWhat(pop);
        // (every name cut: whole again, wrapped; still too wide: it
        // wraps, as the popovers do)
        if (!pop.querySelector(".pwhat .pname")) pop.innerHTML = html;
        if (pop.querySelector<El>(".pop-how")!.scrollWidth + 16 >
          bounds.r - bounds.l) pop.classList.add("wrap");
        // (each badge's value, as the several-line shape's say it)
        for (const b of pop.querySelectorAll<El>(".pwhat .pbadge")) {
          const it = n.items.find((x) => x.text === b.textContent);
          if (it?.unit !== undefined) b.dataset.unit = String(it.unit);
        }
      }
      return pop;
    });
    // (a run's bytes: its rows' words', or, flowing (memory's 16 a
    // line), the bytes of its words)
    // (and, after them, each of its rows alone: a card may sit inside
    // its own value's run, over its own bytes, when nothing else fits)
    const targets: Target[] = [...n.runs, ...n.runs.length > 0 ? n.runs
      .filter((r) => r.length > 1).flatMap((r) => r.map((h) => [h]))
      : []].map((run) => {
      const all = run.flatMap((h) => [...v.querySelectorAll<El>(
        `.word[data-slot="${h}"] :is(.b, .ab), .b[data-row="${h}"]`)]);
      const mine = all.filter((c) =>
        n.units.includes(+(c.dataset.unit ?? -1)));
      const digits = mine.filter((c) => !c.classList.contains("z"));
      const xs = (digits.length ? digits : mine).map((c) =>
        rel(c.getBoundingClientRect(), vb));
      const ys = all.map((c) => rel(c.getBoundingClientRect(), vb));
      return { x: (Math.min(...xs.map((r) => r.l)) +
        Math.max(...xs.map((r) => r.r))) / 2,
      t: Math.min(...ys.map((r) => r.t)), b: Math.max(...ys.map((r) =>
        r.b)) };
    }).filter((t) => Number.isFinite(t.x) && Number.isFinite(t.t));
    // (its first run first: a record's own slots before its name's)
    return { pops, targets };
  });
  // (the arrow's reach, as the card's CSS draws it under a row)
  const probe = made[0]?.pops[0];
  let reach: number | undefined;
  if (probe) {
    const a = document.createElement("span");
    a.className = "nanchor";
    a.style.top = "0px";
    a.style.height = "0px";
    layer.append(a);
    a.append(probe);
    reach = probe.getBoundingClientRect().top - a.getBoundingClientRect().top;
    layer.append(probe);
    a.remove();
  }
  const spots = place(made.map((m, i) => ({ units: notes[i].units,
    shapes: m.pops.map((p) => ({ w: p.offsetWidth, h: p.offsetHeight,
      // (each name the one line cut, a little worse)
      cost: 12 * (notes[i].items.length - p.querySelectorAll(
        ".pwhat .pname").length) * (p._what ? 1 : 0) })),
    targets: m.targets })), cells, bounds, { narrow, reach });
  made.forEach((m, i) => {
    const s = spots[i];
    m.pops.forEach((p, k) => s && k === s.shape ? undefined : p.remove());
    if (!s) return;
    const pop = m.pops[s.shape];
    const g = m.targets[s.target];
    // (an anchor as tall as the run, as a row's address is for the
    // inspector's popovers: the card's CSS puts it over or under it)
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
