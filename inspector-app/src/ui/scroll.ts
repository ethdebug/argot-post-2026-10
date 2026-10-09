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
