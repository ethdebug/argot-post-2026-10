// The dump's font: the largest at which its row fits the box (CSS,
// .views); a row's width in em, in this font, measured once for each
// layout (32 bytes a line, or 16 on a narrow box); again once the
// page's fonts are in (vanilla fitDumps, 00cd9a0). `me`: an element in
// the .dump box, with its rows.
import { useLayoutEffect, type RefObject } from "react";

// each fitted dump view's font, for its lens's cell size
const sizes = new WeakMap<Element, number>();

export function useFitDump(me: RefObject<HTMLElement | null>,
  shown: boolean, rows: number) {
  useLayoutEffect(() => {
    const fit = () => {
      const d = me.current?.closest<HTMLElement>(".dump");
      const row = me.current?.querySelector(".rows > .wrow");
      if (!d || !row || !shown || !d.clientWidth) return;
      const key = d.clientWidth < 560 ? "--k16" : "--k32";
      if (d.style.getPropertyValue(key)) return;
      const fs = parseFloat(getComputedStyle(row).fontSize);
      const w = row.querySelector(".word")!.getBoundingClientRect().right -
        row.getBoundingClientRect().left;
      if (w > 0) d.style.setProperty(key, (w / fs).toFixed(4));
    };
    fit();
    let live = true;
    document.fonts?.ready.then(() => {
      const d = me.current?.closest<HTMLElement>(".dump");
      // (only a shown view measures again: a hidden one's would clear
      // the box's measure and take none)
      if (!live || !d || !shown) return;
      d.style.removeProperty("--k32");
      d.style.removeProperty("--k16");
      fit();
    });
    addEventListener("resize", fit);
    // (in a lens: its cell size, --cell-fs, the smallest font its dumps
    // fit, and their line's height, --cell-lh; a panel that is not a fitted dump, such as an abbreviated
    // stack, takes it: one cell size for the whole lens)
    const d0 = me.current?.closest<HTMLElement>(".dump");
    const lens = d0?.closest<HTMLElement>(".lens");
    const seen = !lens || !d0 || typeof ResizeObserver === "undefined" ||
      !shown ? null : new ResizeObserver(() => {
        const v = me.current;
        if (!v || !lens.isConnected) return;
        sizes.set(v, parseFloat(getComputedStyle(v).fontSize));
        const all = [...lens.querySelectorAll<HTMLElement>(".dump .view")]
          .map((x) => sizes.get(x)).filter((x): x is number => !!x);
        if (!all.length) return;
        // (set after this layout, by a timer (a frame out of view gets
        // no animation frames): no resize loop; a change under
        // 0.05px ends it, as the columns settle)
        const f = Math.min(...all);
        // (and a line's height: a word's line, on one line or two)
        const b = v.querySelector(".word .bytes");
        const lh = b ? `${getComputedStyle(b).lineHeight}` : "";
        const was = parseFloat(lens.style.getPropertyValue("--cell-fs"));
        if (Math.abs(f - was) < 0.05 &&
          lens.style.getPropertyValue("--cell-lh") === lh) return;
        setTimeout(() => {
          lens.style.setProperty("--cell-fs", `${f}px`);
          if (lh) lens.style.setProperty("--cell-lh", lh);
        });
      });
    if (d0) seen?.observe(d0);
    return () => {
      live = false;
      removeEventListener("resize", fit);
      seen?.disconnect();
    };
  }, [me, shown, rows]);
}
