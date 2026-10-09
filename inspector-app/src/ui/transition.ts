// A change of which rows exist, animated (the related view: its toggle,
// and a deliberate selection that changes its rows), with the browser's
// View Transitions: the rows that stay move to their new places, the
// others fade, about 220 ms. No API, or reduced motion: at once.
// Hover and a walkthrough's steps never change the rows, so never
// animate. The rows carry their names as data-vt (`vtName`); they are
// set as view-transition-name only during a transition (a name makes
// its element a stacking context, which the popovers must not meet),
// and only on rows wholly inside what clips them (a row half out of the
// tree's box would show past it). The popovers move with their rows
// (named after them, drawn over the rows: data-vt-top), placed for the
// new rows before the new state is captured; the cards and the tray
// hide meanwhile.
import { flushSync } from "react-dom";
import type { Store } from "./store";
import type { LensState } from "./types";

type VT = { finished: Promise<void> };
type Doc = Document & { startViewTransition?: (f: () => void) => VT };

// A row's name, from its identity (the lens mount, the view, the
// address or path): a valid, page-unique ident
export function vtName(...parts: string[]): string {
  let h = 0x811c9dc5;
  for (const c of parts.join("|")) {
    h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  }
  return `vt-${h.toString(36)}-${parts.join("").length.toString(36)}`;
}

// whether `el` is wholly inside every box that clips it
function inView(el: HTMLElement): boolean {
  if (!el.offsetParent) return false;
  const r = el.getBoundingClientRect();
  for (let a = el.parentElement; a && a !== document.body;
    a = a.parentElement) {
    const cs = getComputedStyle(a);
    if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
    const b = a.getBoundingClientRect();
    if (r.top < b.top - 0.5 || r.bottom > b.bottom + 0.5 ||
      r.left < b.left - 0.5 || r.right > b.right + 0.5) return false;
  }
  return true;
}

// (the names over the others, in the old state or the new one: their
// groups' z-index, while it runs)
const topNames = new Set<string>();
let topStyle: HTMLStyleElement | null = null;

function names(on: boolean) {
  const seen = new Set<string>();
  for (const el of document.querySelectorAll<HTMLElement>("[data-vt]")) {
    const n = el.dataset.vt!;
    const ok = on && !seen.has(n) && inView(el);
    if (ok) seen.add(n);
    if (ok && el.dataset.vtTop !== undefined) topNames.add(n);
    el.style.viewTransitionName = ok ? n : "";
  }
  if (!on) topNames.clear();
  if (!topNames.size) return topStyle?.remove();
  topStyle ??= document.createElement("style");
  // (a popover moves, over the rows, and is never stretched: its old
  // and new pictures keep their size, at the box's top left, and cross-
  // fade; a balloon of one into the other's size is too much)
  const each = (pseudo: string) => [...topNames].map((n) =>
    `::view-transition-${pseudo}(${n})`).join(", ");
  topStyle.textContent = `${each("group")} { z-index: 10; }\n` +
    `${each("old")}, ${each("new")} { height: 100%; width: auto; ` +
    "object-fit: none; object-position: left top; }\n" +
    `${each("old")} { animation-name: vt-out; animation-duration: ` +
    "200ms; }\n" +
    `${each("new")} { animation-name: vt-in; animation-duration: 200ms; ` +
    "animation-delay: 120ms; animation-fill-mode: both; }";
  if (!topStyle.isConnected) document.head.append(topStyle);
}

// Run `change` (a state change React draws) as a view transition. A
// new one while one runs replaces it (the browser skips the old one,
// which then leaves the names and the class to the new one).
let running = 0;
export function transition(change: () => void): void {
  const doc = document as Doc;
  if (!doc.startViewTransition ||
    matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
    return change();
  }
  const root = document.documentElement;
  const mine = ++running;
  const done = () => {
    if (mine !== running) return;
    names(false);
    root.classList.remove("vt-run");
  };
  root.classList.add("vt-run");
  names(true);
  try {
    // (after the commit, the overlays drawn for it, a microtask later:
    // Dump.tsx schedule; then the new state is captured)
    const t = doc.startViewTransition(async () => {
      flushSync(change);
      await new Promise<void>((r) => queueMicrotask(r));
      names(true);
    });
    t.finished.finally(done);
  } catch {
    done();
    change();
  }
}

// Whether a change of a lens's state changes which rows the related
// view shows, deliberately: the view turned on or off, or (while it is
// on, with no walkthrough, in the same bookmark's showing) a selection
const rowsChange = (a: LensState, b: LensState) =>
  a.scene === b.scene && a.shows === b.shows &&
  ((a.related === undefined) !== (b.related === undefined) ||
    (!!b.related && Object.keys(b.links).some((k) => {
      const [x, y] = [a.links[k], b.links[k]];
      return x?.selection !== y?.selection && !x?.walk && !y?.walk;
    })));

// A lens's store whose changes of the related view's rows animate. The
// change waits for the transition's callback (the old rows are captured
// first); meanwhile every other change composes onto it, so a click
// then is never lost, and lands with it.
export function animated(store: Store<LensState>): Store<LensState> {
  let pending: LensState | null = null;
  return { ...store, set(f) {
    const prev = pending ?? store.get();
    const next = f(prev);
    if (next === prev) return;
    if (pending) {
      pending = next;
      return;
    }
    if (!rowsChange(prev, next)) return store.set(() => next);
    pending = next;
    transition(() => {
      const s = pending!;
      pending = null;
      store.set(() => s);
    });
  } };
}
