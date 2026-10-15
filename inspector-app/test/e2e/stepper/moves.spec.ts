// The stepper's moves (TimelineBar.tsx, the moments' bar): ◀ ▶ ⏮, a
// dot, or ← → in the lens move through the trace steps between two
// moments, back or on, then rest on the moment; a click during a move
// goes on from where it is (none lost); the figure keeps its height,
// and the pages their room together (they fold and open, memory's zero
// words fold away, as they come and go);
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
    // (the figure's height, and the pages' together: the room they
    // share as they fold and open)
    const f = () => {
      rows.add([document.querySelector("#embed"), document.querySelector(
        ".lens > [data-area=wide]")].map((v) => Math.round(v!
        .getBoundingClientRect().height)).join());
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
  // (a first load: the scene's run loaded, decoded; a cold browser's
  // takes a while)
  await expect(page.locator(".mbar .dot.cur")).toHaveAttribute("data-k",
    "0", { timeout: 20_000 });
  await expect(page.locator('.mbar [data-t="next"]')).toBeEnabled();
  // (settled: its fonts in, its type fitted to them, as the embed waits
  // before its first height)
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
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
  // (alice's play: five moments)
  await page.locator('.mbar [role=tab][data-tx="12"]').click();
  await expect(page.locator(".mbar .rcount")).toHaveText("1 / 5");
  const next = page.locator('.mbar [data-t="next"]');
  // (three presses, the next two during the first's move)
  await next.click();
  await next.click();
  await next.click();
  await still(page);
  await expect(page.locator(".mbar .rcount")).toHaveText("4 / 5");
  await page.locator(".mbar").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await still(page);
  await expect(page.locator(".mbar .rcount")).toHaveText("3 / 5");
});

// The transactions, tabs across the figure's top: a tab, a cut to its
// first moment, ← → between the tabs; the moments' bar steps inside the
// shown one alone, ◀ and ▶ stopping at its ends; Reset, the first
// one's first moment
test("transactions: tabs; stepping stays inside one; Reset",
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await open(page, STEPPER.O2);
    const tx = (n: number) => page.locator(`.mbar [role=tab][data-tx="${n}"]`);
    const count = page.locator(".mbar .rcount");
    const next = page.locator('.mbar [data-t="next"]');
    const prev = page.locator('.mbar [data-t="prev"]');
    await expect(tx(3)).toHaveAttribute("aria-selected", "true");
    await expect(count).toHaveText("1 / 2");
    await expect(prev).toBeDisabled();
    await next.click();
    await still(page);
    await expect(count).toHaveText("2 / 2");
    await expect(next).toBeDisabled();
    // (the arrow key at the end: no step into the next transaction)
    await page.locator(".mbar").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("End");
    await still(page);
    await expect(tx(3)).toHaveAttribute("aria-selected", "true");
    await expect(count).toHaveText("2 / 2");
    // (the other transaction: a cut, its first moment; ◀ disabled)
    await record(page);
    await tx(12).click();
    await expect(tx(12)).toHaveAttribute("aria-selected", "true");
    await expect(count).toHaveText("1 / 5");
    await expect(prev).toBeDisabled();
    expect((await seen(page)).moments).toHaveLength(1);
    await page.locator(".mbar").focus();
    await page.keyboard.press("End");
    await still(page);
    await expect(count).toHaveText("5 / 5");
    await page.keyboard.press("Home");
    await still(page);
    await expect(count).toHaveText("1 / 5");
    await expect(tx(12)).toHaveAttribute("aria-selected", "true");
    // (← → on the tabs: the other transaction)
    await tx(12).focus();
    await page.keyboard.press("ArrowLeft");
    await expect(tx(3)).toHaveAttribute("aria-selected", "true");
    await expect(count).toHaveText("1 / 2");
    await page.keyboard.press("ArrowRight");
    await expect(tx(12)).toHaveAttribute("aria-selected", "true");
    await expect(count).toHaveText("1 / 5");
    // (Reset: the first transaction, its first moment)
    await next.click();
    await still(page);
    await page.locator(".reset").click();
    await expect(tx(3)).toHaveAttribute("aria-selected", "true");
    await expect(count).toHaveText("1 / 2");
  });

test("reduced motion: a move is a jump, no flash", async ({ page }) => {
  await open(page, STEPPER.O2);
  await record(page);
  await page.locator('.mbar [role=tab][data-tx="12"]').click();
  await page.locator('.mbar [data-t="next"]').click();
  await page.locator('.mbar [data-t="next"]').click();
  await expect(page.locator(".mbar .rcount")).toHaveText("3 / 5");
  const s = await seen(page);
  expect(s.moments).toHaveLength(3);
  expect(s.flashes).toBe(0);
});
