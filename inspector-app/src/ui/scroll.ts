// Scrolling inside the inspector's own scroll container (the page's, if
// none): where it is, what of it is in view under the walkthrough's
// sticky panel, and the moves that bring things into that view. One
// place for every view's scrolling: the walkthrough panel's Start and
// steps, the tree's rows.

export interface Scroller {
  box: Element;          // the scrolling element
  root: boolean;         // the page's own
  pad: number;           // its scroll-padding-top (a host's sticky header)
}

const px = (v: string) => parseFloat(v) || 0;

// An element's nearest scroll container: the nearest ancestor that
// scrolls vertically and has more to show; else the page
export function scrollerOf(el: Element): Scroller {
  let box: Element | null = el.parentElement;
  while (box && !(/auto|scroll/.test(getComputedStyle(box).overflowY) &&
    box.scrollHeight > box.clientHeight)) box = box.parentElement;
  const root = document.scrollingElement ?? document.documentElement;
  const c = box ?? root;
  return { box: c, root: c === root,
    pad: px(getComputedStyle(c).scrollPaddingTop) };
}

const still = () =>
  !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// The container's top and bottom on screen, below its scroll-padding-top
export function viewOf(s: Scroller): { top: number; bottom: number } {
  if (s.root) return { top: s.pad, bottom: innerHeight };
  const r = s.box.getBoundingClientRect();
  return { top: r.top + s.box.clientTop + s.pad,
    bottom: r.top + s.box.clientTop + s.box.clientHeight };
}

// what sticks at the top during a walkthrough, in the order it stacks:
// the panel, then its section's dump headers under it (style.css)
const STUCK = ".wpanel.walking, .walkzone .words > h2, .walkzone .words " +
  ".relrow";

// The part of the container in view for `el`: below a walkthrough panel
// that is stuck at its top, and the headers stuck under it (`el`'s own
// scroll container's)
export function viewUnder(el: Element): { top: number; bottom: number } {
  const s = scrollerOf(el);
  const v = viewOf(s);
  for (const p of s.box.querySelectorAll(STUCK)) {
    if (getComputedStyle(p).position !== "sticky") continue;
    const r = p.getBoundingClientRect();
    if (r.height && r.top <= v.top + 1 && r.bottom > v.top) {
      v.top = Math.max(v.top, r.bottom);
    }
  }
  return v;
}

// Scroll the container by `dy`; resolves once it has stopped moving
export function scrollBy(s: Scroller, dy: number, instant = still()):
  Promise<void> {
  const from = s.box.scrollTop;
  const to = Math.max(0, Math.min(from + dy,
    s.box.scrollHeight - s.box.clientHeight));
  if (Math.abs(to - from) < 1) return Promise.resolve();
  s.box.scrollTo({ top: to, behavior: instant ? "auto" : "smooth" });
  if (instant) return Promise.resolve();
  // (the end of a smooth scroll: no "scrollend" in every browser, so the
  // position: at its end, or still for two frames once it has moved (a
  // browser may start it a frame late); at most a second)
  return new Promise((done) => {
    const t0 = performance.now();
    let last = from;
    let same = 0;
    let moved = false;
    const tick = () => {
      const y = s.box.scrollTop;
      moved ||= Math.abs(y - from) >= 0.5;
      same = Math.abs(y - last) < 0.5 ? same + 1 : 0;
      last = y;
      if (Math.abs(y - to) < 1 || (moved && same >= 2) ||
        performance.now() - t0 > 1000) done();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

// Bring an element to the top of its scroll container, below its
// scroll-padding-top and the element's scroll-margin-top
export function toTop(el: HTMLElement, instant = still()): Promise<void> {
  const s = scrollerOf(el);
  const margin = px(getComputedStyle(el).scrollMarginTop);
  // (whole pixels, up: the panel then sticks, rather than stopping a
  // fraction of a pixel short of it)
  return scrollBy(s, Math.ceil(el.getBoundingClientRect().top -
    viewOf(s).top - margin), instant);
}

// Bring a block of rows (their screen boxes) into the part of the
// container in view under the sticky panel, with `gap` px of room:
// only if some of it is out of view; as little as it takes, or its top
// first when it is taller than the view
export function intoView(el: Element, rects: DOMRect[], gap = 24,
  instant = still()): Promise<void> {
  if (!rects.length) return Promise.resolve();
  const dy = moveFor({ top: Math.min(...rects.map((r) => r.top)),
    bottom: Math.max(...rects.map((r) => r.bottom)) }, viewUnder(el), gap);
  return dy ? scrollBy(scrollerOf(el), dy, instant) : Promise.resolve();
}

type Span = { top: number; bottom: number };
// How far to scroll so a block is in a view, with `gap` of room: none
// when it is in view; else as little as it takes, or (taller than the
// view, or above it) its top `gap` below the view's top
export function moveFor(b: Span, v: Span, gap: number): number {
  if (b.top >= v.top && b.bottom <= v.bottom) return 0;
  const room = v.bottom - v.top - 2 * gap;
  return b.bottom - b.top > room || b.top < v.top ? b.top - v.top - gap
    : b.bottom - v.bottom + gap;
}

// (the transitions' easing, ui/transition.ts and the CSS's:
// cubic-bezier(0.4, 0, 0.2, 1), over their 420ms)
const EASE_MS = 420;
function ease(t: number): number {
  // (x(s) = t for s, by bisection; then y(s))
  const bz = (s: number, a: number, b: number) =>
    3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  let lo = 0, hi = 1;
  for (let k = 0; k < 20; k++) {
    const m = (lo + hi) / 2;
    if (bz(m, 0.4, 0.2) < t) lo = m;
    else hi = m;
  }
  return bz((lo + hi) / 2, 0, 1);
}
const going = new WeakMap<Element, { to: number; frame: number }>();

// A box's glide stopped where it is
export function stopGlide(box: Element) {
  const now = going.get(box);
  if (now) cancelAnimationFrame(now.frame);
  going.delete(box);
}

// A box's scroll to `to`, in the transitions' time and easing (at once
// under reduced motion, or `instant`); a scroll already on its way there
// left alone, one elsewhere retargeted
export function glide(box: Element, to: number, instant = still()) {
  to = Math.round(Math.max(0, Math.min(to, box.scrollHeight -
    box.clientHeight)));
  const now = going.get(box);
  if (now && Math.abs(now.to - to) < 1) return;
  if (now) cancelAnimationFrame(now.frame);
  going.delete(box);
  const from = box.scrollTop;
  if (Math.abs(to - from) < 1) return;
  if (instant) {
    box.scrollTop = to;
    return;
  }
  const t0 = performance.now();
  const tick = () => {
    const t = Math.min(1, (performance.now() - t0) / EASE_MS);
    box.scrollTop = from + (to - from) * ease(t);
    if (t < 1) going.set(box, { to, frame: requestAnimationFrame(tick) });
    else going.delete(box);
  };
  going.set(box, { to, frame: requestAnimationFrame(tick) });
}

// Where a box's scroll brings a run of its content (`top`..`bottom`, from
// its content's top) to the middle of its view (`h` tall, the box's as
// it is or will be); a run too tall for it clear of its edges, its top a
// `row` below the view's top. None (undefined) when the run is already in view and
// clear of its edges by `clear` (an edge with nothing past it needs no
// room)
export function centring(box: Element, run: { top: number;
  bottom: number }, o: { row: number; clear: number; h?: number }):
  number | undefined {
  const h = o.h ?? box.clientHeight;
  const max = Math.max(0, box.scrollHeight - h);
  const y = Math.min(box.scrollTop, max);
  const topOk = run.top >= y + o.clear || (y <= 0 && run.top >= 0);
  const botOk = run.bottom <= y + h - o.clear ||
    (y >= max - 0.5 && run.bottom <= y + h);
  if (topOk && botOk) return undefined;
  const to = run.bottom - run.top <= h - 2 * o.clear
    ? (run.top + run.bottom) / 2 - h / 2 : run.top - o.row;
  return Math.max(0, Math.min(max, Math.round(to)));
}
