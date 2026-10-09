// The timeline bar (addendum §5) and the union of rows (§4): a scene's
// moments, stepped by ◀ ▶, keys, a mark; nothing moves as they change
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";
import { A, MOTD } from "../../expect";

const T = "#timeline";
const open = async (page: Page, scene: string) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`./shell.html#scene=${scene}`);
  await expect(page.locator(".view .wrow").first()).toBeVisible();
};
const cur = (page: Page) => page.locator(`${T} .tmark.cur`)
  .getAttribute("data-k");
const val = (page: Page, path: string) =>
  page.locator(`li[data-path="${path}"] > .row .val`).first();

test("◀ ▶ step the moments, disabled at the ends; the line names the " +
  "moment", async ({ page }) => {
  await open(page, "alice");
  // (alice opens at her hit's after: moment 1)
  await expect.poll(() => cur(page)).toBe("1");
  await expect(page.locator(`${T} [data-t="next"]`)).toBeDisabled();
  await expect(page.locator(`${T} .tline`))
    .toHaveText("after alice's third hit");
  await expect(val(page, `${A}.score`)).toHaveText("60");
  await page.locator(`${T} [data-t="prev"]`).click();
  await expect.poll(() => cur(page)).toBe("0");
  await expect(page.locator(`${T} [data-t="prev"]`)).toBeDisabled();
  await expect(page.locator(`${T} .tline`))
    .toHaveText("in the middle of the game");
  await expect(val(page, `${A}.score`)).toHaveText("30");
  // (a mark: there)
  await page.locator(`${T} .tmark[data-k="1"]`).click();
  await expect.poll(() => cur(page)).toBe("1");
  // (the track: a segment a transaction, a dashed tail)
  await expect(page.locator(`${T} .tseg`)).toHaveCount(14);
  await expect(page.locator(`${T} .ttail`)).toHaveCount(1);
});

test("← → Home End in the lens; a walkthrough's keys win",
  async ({ page }) => {
    await open(page, "motd");
    await expect.poll(() => cur(page)).toBe("1");
    await page.locator(T).focus();
    await page.keyboard.press("End");
    await expect.poll(() => cur(page)).toBe("1");
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => cur(page)).toBe("0");
    await expect(val(page, "motd")).toHaveText(`"${MOTD[0]}"`);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => cur(page)).toBe("1");
    await expect(val(page, "motd")).toHaveText(`"${MOTD[1]}"`);
    // (in a walkthrough: the keys are its steps)
    await page.locator('#details button[data-r="start"]').click();
    await expect(page.locator("#details.replaying")).toHaveCount(1);
    await page.keyboard.press("ArrowLeft");
    await expect.poll(() => cur(page)).toBe("1");
  });

test("nothing moves as the moments change: the bar, the dumps, the tree " +
  "keep their boxes (the union of rows)", async ({ page }) => {
  await open(page, "motd");
  // (the moment's own dump: the earlier one, shown for a selection at a
  // moment with one before it, is the moment before's)
  const boxes = () => page.evaluate((T) => [T, '[data-view$=":after"]',
    ".treebox"].map((q) => {
    const r = document.querySelector(q)!.getBoundingClientRect();
    return [Math.round(r.top), Math.round(r.height)].join();
  }), T);
  await expect.poll(() => cur(page)).toBe("1");
  await page.waitForTimeout(300);
  const b1 = await boxes();
  await page.locator(`${T} [data-t="prev"]`).click();
  await expect(val(page, "motd")).toHaveText(`"${MOTD[0]}"`);
  await page.waitForTimeout(300);
  expect(await boxes()).toEqual(b1);
});

test("one moment: the line alone; no buttons, no track", async ({ page }) => {
  await open(page, "mid");
  await expect(page.locator(`${T}.one .tline`))
    .toHaveText("in the middle of the game");
  await expect(page.locator(`${T} button`)).toHaveCount(0);
});
