// The dump's font: the largest at which its row fits the box (CSS,
// .views); a row's width in em, in this font, measured once for each
// layout (32 bytes a line, or 16 on a narrow box); again once the
// page's fonts are in (vanilla fitDumps, 00cd9a0). `me`: an element in
// the .dump box, with its rows.
import { useLayoutEffect, type RefObject } from "react";

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
    return () => {
      live = false;
      removeEventListener("resize", fit);
    };
  }, [me, shown, rows]);
}
