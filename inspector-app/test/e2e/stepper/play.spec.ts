// The stepper's play (TimelineBar.tsx): ▶ steps through the
// transaction a trace step at a time, ⏸ while it plays; a second press,
// ← or a mark stops it; the dumps' rows stay put from the first step to
// the last (the frame's height: embed-stable.spec.ts); changed bytes
// flash, with no flash under reduced motion (the tests' default)
import { test, expect } from "../../page";
import { STEPPER } from "../../expect";

const step = (s: string | null) => Number(/trace step (\d+)/.exec(s ?? "")
  ?.[1] ?? NaN);

for (const id of Object.values(STEPPER)) {
  test(`${id}: plays to the end, a step at a time, nothing moving`,
    async ({ page }) => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`./embed.html#scene=${id}`);
      await expect(page.locator(".tbar .tmark.cur")).toHaveAttribute(
        "data-k", "0");
      const play = page.locator('.tbar [data-t="play"]');
      // (every frame: the dumps' rows, and the flashes running)
      await page.evaluate(() => {
        const w = window as unknown as Record<string, unknown>;
        const rows = new Set<string>();
        let flashes = 0;
        const f = () => {
          rows.add([...document.querySelectorAll(".dump .view, " +
            "[data-view$=':stack']")].map((v) =>
            v.querySelectorAll(".wrow").length).join());
          flashes = Math.max(flashes, document.getAnimations()
            .filter((a) => a instanceof Animation && !(a instanceof
              CSSTransition) && !(a instanceof CSSAnimation)).length);
          w.seen = { rows: [...rows], flashes };
          requestAnimationFrame(f);
        };
        f();
      });
      await play.click();
      await expect(play).toHaveAttribute("aria-pressed", "true");
      await expect(play).toHaveText("⏸");
      // (it steps: one trace step, then later ones)
      await expect.poll(async () => step(await page.locator(".tbar .tline")
        .textContent())).toBeGreaterThan(0);
      await expect(play).toHaveAttribute("aria-pressed", "false",
        { timeout: 20_000 });
      await expect(page.locator(".tbar .tline")).toHaveText(
        "after carol joins");
      const seen = await page.evaluate(() => (window as unknown as
        { seen: { rows: string[]; flashes: number } }).seen);
      expect(seen.rows).toHaveLength(1);
      expect(seen.flashes).toBeGreaterThan(0);
    });
}

test("a second press pauses; ← steps and stops it; no flash under " +
  "reduced motion", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`./embed.html#scene=${STEPPER.O2}`);
  await expect(page.locator(".tbar .tmark.cur")).toHaveAttribute(
    "data-k", "0");
  await page.evaluate(() => {
    const w = window as unknown as { flashes: number };
    w.flashes = 0;
    const f = () => {
      w.flashes += document.getAnimations().filter((a) =>
        !(a instanceof CSSTransition) && !(a instanceof CSSAnimation))
        .length;
      requestAnimationFrame(f);
    };
    f();
  });
  const play = page.locator('.tbar [data-t="play"]');
  const line = page.locator(".tbar .tline");
  await play.click();
  await expect.poll(async () => step(await line.textContent()))
    .toBeGreaterThan(0);
  await play.click();
  await expect(play).toHaveAttribute("aria-pressed", "false");
  const at = await line.textContent();
  await page.waitForTimeout(300);
  await expect(line).toHaveText(at!);
  expect(await page.evaluate(() => (window as unknown as
    { flashes: number }).flashes)).toBe(0);
  // (again, then ←: one step back, stopped)
  await play.click();
  await expect.poll(async () => step(await line.textContent()))
    .toBeGreaterThan(step(at));
  await page.locator(".tbar").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(play).toHaveAttribute("aria-pressed", "false");
  const back = await line.textContent();
  await page.waitForTimeout(300);
  await expect(line).toHaveText(back!);
});
