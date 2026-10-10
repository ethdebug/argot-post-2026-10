// The program x-ray (scene program-xray): the compiler's own program
// entries for Arcade's play(), from solc and from Fe; pointing at an
// instruction shows its entry and lights its range; the moves skip
// instructions with no range; the box holds its height
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const F = "[data-figure=program-xray]";
const lit = (page: Page) => page.locator(`${F} .codesrc mark.rng`)
  .allTextContents().then((t) => t.join(""));
const entry = (page: Page) => page.locator(`${F} .xjson`);
// (the entry's text as it reads: its popovers left out)
const yaml = (page: Page) => entry(page).evaluate((e) => {
  const c = e.cloneNode(true) as HTMLElement;
  c.querySelectorAll(".xpop").forEach((p) => p.remove());
  return c.textContent ?? "";
});
const height = (page: Page) => page.locator(F).evaluate((e) =>
  Math.round(e.getBoundingClientRect().height));

test("solc's and Fe's entries for play(), as written: a row pointed at " +
  "shows its entry and lights its range", async ({ page }) => {
  await page.setViewportSize({ width: 1216, height: 800 });
  await page.goto("./embed.html#scene=program-xray");
  await expect(page.locator(`${F}[data-ready]`)).toHaveCount(1);
  const h = await height(page);
  // it opens at solc's first instruction of `player.plays += 1`, its
  // PUSH's bytes as solc writes them
  await expect(entry(page)).toHaveAttribute("data-offset", "4432");
  await expect.poll(() => yaml(page)).toContain('arguments: [ "0x1177" ]');
  await expect.poll(() => yaml(page)).toContain(
    "range: { length: 17, offset: 1220 }");
  await expect.poll(() => lit(page)).toBe("player.plays += 1");
  // (each field's popover: what it is)
  await page.locator(`${F} [data-field="context.code.range"] > .xname`)
    .hover();
  await expect(page.locator(
    `${F} [data-field="context.code.range"] > .xpop`)).toBeVisible();
  // the switch: Fe's entry, its own fields kept, no PUSH bytes
  await page.locator(`${F} button[data-lang="fe"]`).click();
  await expect(page.locator(`${F} .codehead .srcfile`).last())
    .toHaveText("arcade.fe");
  await expect(entry(page)).toHaveAttribute("data-offset", "6463");
  await expect.poll(() => yaml(page))
    .toContain("classification: source_mapped");
  await expect.poll(() => yaml(page)).toContain("fe_origin_key:");
  await expect.poll(() => yaml(page)).not.toContain("arguments");
  await expect.poll(() => lit(page)).toMatch(/^store\.plays\.set\(/);
  // pointing at another instruction: its entry, its range
  const row = page.locator(`${F} .xrows li[data-offset="6401"]`);
  await row.scrollIntoViewIfNeeded();
  await row.hover();
  await expect(entry(page)).toHaveAttribute("data-offset", "6401");
  await expect.poll(() => lit(page)).toBe("names.len(key: me)");
  // one with no range (Fe's synthetic code): its entry, nothing lit
  const bare = page.locator(`${F} .xrows li.absent`).first();
  await bare.scrollIntoViewIfNeeded();
  await bare.hover();
  await expect.poll(() => yaml(page)).not.toContain("context:");
  await expect(page.locator(`${F} .codesrc mark.rng`)).toHaveCount(0);
  // the moves: each lands on an instruction with a range
  await page.mouse.move(0, 0);
  for (let k = 0; k < 12; k++) {
    await page.locator(`${F} [data-move="next"]`).click();
    expect(await lit(page)).not.toBe("");
  }
  expect(await height(page)).toBe(h);
  // ↺ Reset: Solidity, its opening instruction
  await page.locator(".reset").click();
  await expect(page.locator(`${F}[data-lang="sol"]`)).toHaveCount(1);
  await expect(entry(page)).toHaveAttribute("data-offset", "4432");
  await expect(page.locator(".reset")).not.toHaveAttribute("data-shown");
});
