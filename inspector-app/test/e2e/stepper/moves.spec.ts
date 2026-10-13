// The stepper's moves (TimelineBar.tsx, the moments' bar): ◀ ▶ ⏮, a
// dot, or ← → in the lens move through the trace steps between two
// moments, back or on, then rest on the moment; a click during a move
// goes on from where it is (none lost); the pages keep their heights,
// and their rows (memory's zero words fold away as they come and go);
// changed bytes flash (Element.animate on a byte); with reduced motion
// (the tests' default) a move is a jump, no flash. What it shows is
// recorded in the page (the bar's data-moment, each change; the rows,
// each frame): a move runs by the clock, a slow runner sees it end
// before a poll would
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";
import { STEPPER } from "../../expect";

type Seen = { moments: number[]; rows: string[]; flashes: number };
async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { seen: Seen };
    const bar = document.querySelector<HTMLElement>(".mbar")!;
    const seen: Seen = { moments: [], rows: [], flashes: 0 };
    w.seen = seen;
    const rows = new Set<string>();
    new MutationObserver(() => {
      const m = Number(bar.dataset.moment);
      if (seen.moments.at(-1) !== m) seen.moments.push(m);
    }).observe(bar, { attributes: true, attributeFilter: ["data-moment"] });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...a) {
      if (this.matches(".b, .ab")) seen.flashes++;
      return animate.apply(this, a);
    };
    // (each page's rows, but memory's; and every page's height)
    const f = () => {
      rows.add([...document.querySelectorAll(".dump .view")].map((v) =>
        `${v.matches("[data-location=memory]") ? ""
          : v.querySelectorAll(".wrow").length}/${Math.round(
          v.getBoundingClientRect().height)}`).join());
      seen.rows = [...rows];
      requestAnimationFrame(f);
    };
    f();
  });
}
const seen = (page: Page) => page.evaluate(() =>
  (window as unknown as { seen: Seen }).seen);
// (a move under way: the lens's box says so)
const still = (page: Page) => expect(page.locator(".lens"))
  .not.toHaveAttribute("data-playing", "", { timeout: 10_000 });
const open = async (page: Page, id: string) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./embed.html#scene=${id}`);
  await expect(page.locator(".mbar .dot.cur")).toHaveAttribute("data-k",
    "0");
  await expect(page.locator('.mbar [data-t="next"]')).toBeEnabled();
};
const marks = (page: Page) => page.locator(".mbar .dot").count();

for (const id of Object.values(STEPPER)) {
  test(`${id}: ▶ to the last moment and ⏮ back, through every step ` +
    "between, nothing moving", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, id);
    await record(page);
    const n = await marks(page);
    const next = page.locator('.mbar [data-t="next"]');
    for (let k = 1; k < n; k++) {
      await next.click();
      await expect(page.locator(".mbar .rcount")).toHaveText(`${k + 1} / ${
        n}`);
      await still(page);
    }
    await expect(page.locator(".mbar .dot").last()).toHaveClass(/cur/);
    let s = await seen(page);
    // (more steps than moments, each later than the one before)
    expect(s.moments.length).toBeGreaterThan(n);
    expect(s.moments.every((m, k) => !k || m > s.moments[k - 1]))
      .toBe(true);
    const end = s.moments.at(-1)!;
    // (and back, every step earlier than the one before, to the first)
    await page.evaluate(() => {
      (window as unknown as { seen: Seen }).seen.moments = [];
    });
    await page.locator('.mbar [data-t="first"]').click();
    await still(page);
    await expect(page.locator(".mbar .dot.cur")).toHaveAttribute("data-k",
      "0");
    s = await seen(page);
    expect(s.moments.length).toBeGreaterThan(2);
    expect(s.moments.every((m, k) => m < (k ? s.moments[k - 1] : end)))
      .toBe(true);
    expect(s.rows).toHaveLength(1);
    expect(s.flashes).toBeGreaterThan(0);
  });
}

test("a click during a move goes on from where it is; ← → too; none " +
  "lost", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await open(page, STEPPER.O2);
  const next = page.locator('.mbar [data-t="next"]');
  // (three presses, the next two during the first's move)
  await next.click();
  await next.click();
  await next.click();
  await still(page);
  await expect(page.locator(".mbar .rcount")).toHaveText("4 / 6");
  await page.locator(".mbar").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await still(page);
  await expect(page.locator(".mbar .rcount")).toHaveText("3 / 6");
});

test("reduced motion: a move is a jump, no flash", async ({ page }) => {
  await open(page, STEPPER.O2);
  await record(page);
  await page.locator('.mbar [data-t="next"]').click();
  await page.locator('.mbar [data-t="next"]').click();
  await expect(page.locator(".mbar .rcount")).toHaveText("3 / 6");
  const s = await seen(page);
  expect(s.moments).toHaveLength(2);
  expect(s.flashes).toBe(0);
});
