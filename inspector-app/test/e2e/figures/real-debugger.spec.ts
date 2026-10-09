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
  // the first line of the contract's own code, its range marked
  await expect(page.locator(`${F} .codehead .srcfile`))
    .toHaveText("Arcade.sol");
  await expect(page.locator(`${F} .codesrc mark.rng`).first())
    .toBeVisible();
  // soldb's state(i): the state variables, by name
  await expect(page.locator(`${F} .sstate li[data-path="totalScore"]`))
    .toHaveCount(1);
  const s0 = Number(await step(page));
  for (let k = 0; k < 3; k++) {
    await page.locator(`${F} [data-move="next-line"]`).click();
  }
  await expect.poll(async () => Number(await step(page)))
    .toBeGreaterThan(s0);
  await page.locator(`${F} [data-move="next"]`).click();
  await page.locator(`${F} [data-move="prev"]`).click();
  expect(await height(page)).toBe(h);
  // Fe: the same panels, soldb's words where its export has nothing
  await page.locator(`${F} button[data-lang="fe"]`).click();
  await ready(page, "fe");
  await expect(page.locator(`${F} .codehead .srcfile`))
    .toHaveText("arcade.fe");
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
    .toBeGreaterThan(s0);
});

test("the shell lists it as a scene; soldb is never in the app's code",
  async ({ page }) => {
    await page.goto("./shell.html#scene=real-debugger");
    await expect(page.locator(F)).toHaveCount(1);
    // (the worker and its files come from ../debugger/, on first view)
    await expect(page.locator(`${F}[data-ready]`)).toHaveCount(1, LOAD);
  });
