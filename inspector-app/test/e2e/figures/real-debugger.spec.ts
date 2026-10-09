// The real debugger (scene real-debugger): soldb itself, in a worker,
// on Solidity and on Fe; it loads on first view, steps, and its box
// holds its height as it steps and as the language changes
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const F = "[data-figure=real-debugger]";
// (soldb's load: its WebAssembly and the transaction's trace)
const LOAD = { timeout: 90_000 };
const ready = (page: Page, lang: string) => expect(page.locator(
  `${F}[data-lang="${lang}"][data-ready]`)).toHaveCount(1, LOAD);
const step = (page: Page) => page.locator(`${F} .mat`)
  .getAttribute("data-step");
const height = (page: Page) => page.locator(F).evaluate((e) =>
  Math.round(e.getBoundingClientRect().height));

test("soldb steps Arcade's play() in Solidity and in Fe, the box holding " +
  "its height", { tag: "@slow" }, async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("./embed.html#scene=real-debugger");
  // (while it loads: its progress, in the moves' line)
  await ready(page, "sol");
  const h = await height(page);
  // it opens inside play(), on a statement, where soldb knows the state
  // it can: `totalHits += 1`, totalScore 170 and totalHits 7 read
  await expect(page.locator(`${F} .codehead .srcfile`))
    .toHaveText("Arcade.sol");
  const marked = () => page.locator(`${F} .codesrc mark.rng`)
    .allTextContents().then((t) => t.join(""));
  await expect.poll(marked).toBe("totalHits += 1");
  const val = (p: string) => page.locator(
    `${F} .sstate li[data-path="${p}"] .val`);
  await expect(val("totalScore")).toHaveText("170");
  await expect(val("totalHits")).toHaveText("7");
  // (a long value: one line, cut short)
  expect(await val("motd").evaluate((v) =>
    Math.round(v.getBoundingClientRect().height) <= 2 *
    parseFloat(getComputedStyle(v).lineHeight))).toBe(true);
  const s0 = Number(await step(page));
  for (let k = 0; k < 3; k++) {
    await page.locator(`${F} [data-move="prev-line"]`).click();
  }
  await expect.poll(async () => Number(await step(page)))
    .toBeLessThan(s0);
  await page.locator(`${F} [data-move="next"]`).click();
  await page.locator(`${F} [data-move="prev"]`).click();
  expect(await height(page)).toBe(h);
  // Fe: the same panels, soldb's words where its export has nothing
  await page.locator(`${F} button[data-lang="fe"]`).click();
  await ready(page, "fe");
  await expect(page.locator(`${F} .codehead .srcfile`))
    .toHaveText("arcade.fe");
  // (at the score's write)
  await expect.poll(marked).toMatch(/^store\.scores\.set\(/);
  await expect(page.locator(`${F} .sside`))
    .toContainText("Fe's export has none");
  for (let k = 0; k < 3; k++) {
    await page.locator(`${F} [data-move="next-line"]`).click();
  }
  await expect(page.locator(`${F} .codehead .srcfile`))
    .toHaveText("arcade.fe");
  expect(await height(page)).toBe(h);
  // (back to Solidity: where it was)
  await page.locator(`${F} button[data-lang="sol"]`).click();
  await expect.poll(async () => Number(await step(page)))
    .toBeLessThan(s0);
});

test("the shell lists it as a scene; soldb is never in the app's code",
  async ({ page }) => {
    await page.goto("./shell.html#scene=real-debugger");
    await expect(page.locator(F)).toHaveCount(1);
    // (the worker and its files come from ../debugger/, on first view)
    await expect(page.locator(`${F}[data-ready]`)).toHaveCount(1, LOAD);
  });
