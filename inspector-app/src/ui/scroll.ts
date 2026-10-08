// An element's nearest scroll container: the nearest ancestor that
// scrolls and has more than it shows; else the page's
export function scrollerOf(el: Element): Element {
  let box: Element | null = el.parentElement;
  while (box && !(/auto|scroll/.test(getComputedStyle(box).overflowY) &&
    box.scrollHeight > box.clientHeight)) box = box.parentElement;
  return box ?? document.scrollingElement ?? document.documentElement;
}

// Scrolls an element's nearest scroll container (the page's, if none)
// so that the element is at its top, below the container's
// scroll-padding-top and the element's scroll-margin-top: a host page
// with a sticky header sets its height there. Only that container
// scrolls; never the window by page offsets.
export function toTop(el: HTMLElement, instant = false) {
  const c = scrollerOf(el);
  const root = document.scrollingElement ?? document.documentElement;
  const px = (v: string) => parseFloat(v) || 0;
  const pad = px(getComputedStyle(c).scrollPaddingTop);
  const margin = px(getComputedStyle(el).scrollMarginTop);
  const at = c === root ? 0 : c.getBoundingClientRect().top + c.clientTop;
  const top = c.scrollTop + el.getBoundingClientRect().top - at - pad -
    margin;
  c.scrollTo({ top: Math.max(0, top), behavior: instant ? "auto"
    : "smooth" });
}
