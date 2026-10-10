// The stepper's play (TimelineBar.tsx): ▶ steps through the
// transaction a trace step at a time, ⏸ while it plays; a second press,
// or ←, stops it; the dumps' rows stay put from the first step to the
// last (the frame's height: embed-stable.spec.ts); changed bytes flash
// (Element.animate on a byte), none under reduced motion (the tests'
// default). What it shows is recorded in the page as it plays (the
// bar's data-moment, each change; the rows, each frame): the play runs
// by the clock, a slow runner sees it end before a poll would
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";
import { STEPPER } from "../../expect";

type Seen = { moments: number[]; rows: string[]; flashes: number;
  pressed: string[] };
// (`then`: what the page does itself at the play's first step, so the
// reader's press lands while it plays, however slow the runner)
async function record(page: Page, then?: "pause" | "left") {
  await page.evaluate((then) => {
    const w = window as unknown as { seen: Seen };
    const bar = document.querySelector<HTMLElement>(".tbar")!;
    const play = bar.querySelector<HTMLElement>('[data-t="play"]')!;
    const seen: Seen = { moments: [], rows: [], flashes: 0, pressed: [] };
    w.seen = seen;
    const rows = new Set<string>();
    let acted = false;
    new MutationObserver(() => {
      const m = Number(bar.dataset.moment);
      if (seen.moments.at(-1) !== m) seen.moments.push(m);
      const p = play.getAttribute("aria-pressed")!;
      if (seen.pressed.at(-1) !== p) seen.pressed.push(p);
      // (the first step the play shows)
      if (then && !acted && p === "true" && seen.moments.length > 1) {
        acted = true;
        if (then === "pause") play.click();
        else bar.dispatchEvent(new KeyboardEvent("keydown",
          { key: "ArrowLeft", bubbles: true }));
      }
    }).observe(bar, { attributes: true, subtree: true,
      attributeFilter: ["data-moment", "aria-pressed"] });
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...a) {
      if (this.matches(".b, .ab")) seen.flashes++;
      return animate.apply(this, a);
    };
    const f = () => {
      rows.add([...document.querySelectorAll(".dump .view, " +
        "[data-view$=':stack']")].map((v) =>
        v.querySelectorAll(".wrow").length).join());
      seen.rows = [...rows];
      requestAnimationFrame(f);
    };
    f();
  }, then);
}
const seen = (page: Page) => page.evaluate(() =>
  (window as unknown as { seen: Seen }).seen);

const open = async (page: Page, id: string) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./embed.html#scene=${id}`);
  await expect(page.locator(".tbar")).toHaveAttribute("data-moment", "0");
  await expect(page.locator('.tbar [data-t="play"]')).toBeVisible();
};

for (const id of Object.values(STEPPER)) {
  test(`${id}: plays to the end, a step at a time, nothing moving`,
    async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await open(page, id);
      await record(page);
      const play = page.locator('.tbar [data-t="play"]');
      await play.click();
      // (played, and stopped at its end)
      await expect.poll(async () => (await seen(page)).pressed,
        { timeout: 30_000 }).toEqual(["true", "false"]);
      await expect(play).toHaveText("⏵");
      await expect(page.locator(".tbar .tline")).toHaveText(
        "after carol joins");
      const s = await seen(page);
      // (steps between its start and its end, each later than the one
      // before; how many: the runner's frames, the newest each frame)
      expect(s.moments.length).toBeGreaterThan(2);
      expect(s.moments.every((m, k) => !k || m > s.moments[k - 1]))
        .toBe(true);
      expect(s.rows).toHaveLength(1);
      expect(s.flashes).toBeGreaterThan(0);
    });
}

test("a second press pauses; ← steps and stops it; no flash under " +
  "reduced motion", async ({ page }) => {
  await open(page, STEPPER.O2);
  const play = page.locator('.tbar [data-t="play"]');
  const bar = page.locator(".tbar");
  // (paused at its first step)
  await record(page, "pause");
  await play.click();
  await expect.poll(async () => (await seen(page)).pressed)
    .toEqual(["true", "false"]);
  const at = (await seen(page)).moments.at(-1)!;
  expect(at).toBeGreaterThan(0);
  await page.waitForTimeout(500);
  await expect(bar).toHaveAttribute("data-moment", String(at));
  await expect(play).toHaveText("⏵");
  expect((await seen(page)).flashes).toBe(0);
  // (again; ← at its first step: a step back from there, stopped)
  await record(page, "left");
  await play.click();
  await expect.poll(async () => (await seen(page)).pressed)
    .toEqual(["true", "false"]);
  const s = await seen(page);
  const first = s.moments[1];
  expect(first).toBeGreaterThan(at);
  expect(s.moments.at(-1)).toBe(first - 1);
  await page.waitForTimeout(500);
  await expect(bar).toHaveAttribute("data-moment", String(first - 1));
});
