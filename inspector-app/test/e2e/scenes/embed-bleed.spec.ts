// Nothing drawn is cut at the frame's sides: in every scene's embed, no
// box with a fill, a border or an outer shadow, nor a box that clips
// (a tree's, whose room reaches out of its column for its rows' bars),
// reaches past the document's sides (the root keeps that room)
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "../../page";

const ids = fs.readdirSync(path.resolve("scenes"))
  .filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));

for (const width of [838, 390]) {
  test(`every embed scene at ${width}px: nothing cut at the sides`,
    async ({ page }) => {
      test.setTimeout(30_000 + ids.length * 15_000);
      await page.setViewportSize({ width, height: 900 });
      for (const id of ids) {
        await page.goto(`./embed.html#scene=${id}`);
        await expect(page.locator("#embed .view").first())
          .toBeVisible({ timeout: 20_000 });
        await page.waitForTimeout(500);
        const cut = await page.evaluate(() => {
          const cw = document.documentElement.clientWidth;
          const out: string[] = [];
          for (const [e, pse] of [...document.querySelectorAll("#embed *")]
            .flatMap((x) => [[x, ""], [x, "::before"], [x, "::after"]] as
              const)) {
            const c = getComputedStyle(e, pse || null);
            if (c.visibility === "hidden" || c.display === "none") continue;
            if (pse && (c.content === "none" || c.content === "normal")) {
              continue;
            }
            let r = e.getBoundingClientRect();
            // (an absolute pseudo-element: its box from its insets, over
            // its element's)
            if (pse) {
              if (c.position !== "absolute") continue;
              const px = (v: string) => v.endsWith("px") ? parseFloat(v) : 0;
              r = new DOMRect(r.left + px(c.left), r.top,
                r.width - px(c.left) - px(c.right), r.height || 1);
            }
            if (!r.width || !r.height) continue;
            let [l, rt] = [r.left, r.right];
            // (an outer shadow: its offset, blur and spread)
            for (const s of c.boxShadow === "none" ? [] :
              c.boxShadow.split(/,(?![^(]*\))/)) {
              if (/inset/.test(s)) continue;
              const [x, , b = 0, sp = 0] = (s.replace(/rgba?\([^)]*\)/, "")
                .match(/-?[\d.]+px/g) ?? []).map(parseFloat);
              l = Math.min(l, r.left + x - b - sp);
              rt = Math.max(rt, r.right + x + b + sp);
            }
            // (or a tree's box, or a box that clips what it holds: room
            // past its column for its rows' bars and caps, past the frame)
            const drawn = e.matches(".tree") || c.overflowX !== "visible" ||
              c.backgroundColor !== "rgba(0, 0, 0, 0)" ||
              c.boxShadow !== "none" || parseFloat(c.borderLeftWidth) > 0 ||
              parseFloat(c.borderRightWidth) > 0;
            if (drawn && (l < -0.5 || rt > cw + 0.5)) {
              out.push(`${e.tagName}.${[...e.classList].join(".")}${pse} ` +
                `${l.toFixed(1)}..${rt.toFixed(1)} of ${cw}`);
            }
          }
          return out;
        });
        expect(cut, id).toEqual([]);
      }
    });
}
