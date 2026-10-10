// The program x-ray (scene program-xray): the compilers' own program
// entries for Arcade's play(), solc's and Fe's side by side; pointing at
// an instruction shows its entry and lights its range, in its column;
// the box holds its height
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const F = "[data-figure=program-xray]";
const col = (lang: string) => `${F} .xcol[data-lang="${lang}"]`;
const lit = (page: Page, lang: string) => page.locator(
  `${col(lang)} .codesrc mark.rng`).allTextContents().then((t) =>
  t.join(""));
const entry = (page: Page, lang: string) =>
  page.locator(`${col(lang)} .xjson`);
// (the entry's text as it reads: its popovers left out)
const yaml = (page: Page, lang: string) => entry(page, lang)
  .evaluate((e) => {
    const c = e.cloneNode(true) as HTMLElement;
    c.querySelectorAll(".xpop").forEach((p) => p.remove());
    return c.textContent ?? "";
  });
const height = (page: Page) => page.locator(F).evaluate((e) =>
  Math.round(e.getBoundingClientRect().height));

for (const width of [790, 358]) {
  test(`at ${width}px: solc's and Fe's entries for play(), as written; ` +
    "a row pointed at or chosen shows its entry and lights its range",
  async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./embed.html#scene=program-xray");
    await expect(page.locator(`${F}[data-ready]`)).toHaveCount(1);
    const h = await height(page);
    // both open at the plays update: solc's PUSH with its bytes, Fe's
    // with none and its own fields
    await expect(entry(page, "sol")).toHaveAttribute("data-offset",
      "4432");
    await expect.poll(() => yaml(page, "sol"))
      .toContain('arguments: [ "0x1177" ]');
    await expect.poll(() => lit(page, "sol")).toBe("player.plays += 1");
    await expect(entry(page, "fe")).toHaveAttribute("data-offset", "6463");
    await expect.poll(() => yaml(page, "fe"))
      .toContain("classification: source_mapped");
    await expect.poll(() => yaml(page, "fe")).toContain("fe_origin_key:");
    await expect.poll(() => yaml(page, "fe")).not.toContain("arguments");
    await expect.poll(() => lit(page, "fe")).toMatch(/^store\.plays\.set\(/);
    // (a field's popover: what it is)
    const range = `${col("sol")} [data-field="context.code.range"]`;
    await page.locator(`${range} > .xname`).click();
    await expect(page.locator(`${range} > .xpop`)).toBeVisible();
    // a row chosen: its entry and range, in its column only
    const row = page.locator(`${col("fe")} .xrows li[data-offset="6401"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await expect(entry(page, "fe")).toHaveAttribute("data-offset", "6401");
    await expect.poll(() => lit(page, "fe")).toBe("names.len(key: me)");
    await expect(entry(page, "sol")).toHaveAttribute("data-offset",
      "4432");
    // one with no context (Fe's synthetic code): its entry, nothing lit
    const bare = page.locator(`${col("fe")} .xrows li.absent`).first();
    await bare.scrollIntoViewIfNeeded();
    await bare.click();
    await expect.poll(() => yaml(page, "fe")).not.toContain("context:");
    await expect(page.locator(`${col("fe")} .codesrc mark.rng`))
      .toHaveCount(0);
    // the keys move the choice in a focused list
    const was = await entry(page, "sol").getAttribute("data-offset");
    await page.locator(`${col("sol")} .xrows`).focus();
    await page.keyboard.press("ArrowDown");
    await expect(entry(page, "sol")).not.toHaveAttribute("data-offset",
      was!);
    expect(await height(page)).toBe(h);
    // ↺ Reset: both back at the plays update
    await page.locator(".reset").click();
    await expect(entry(page, "sol")).toHaveAttribute("data-offset",
      "4432");
    await expect(entry(page, "fe")).toHaveAttribute("data-offset", "6463");
    await expect(page.locator(".reset")).not.toHaveAttribute("data-shown");
  });
}

// (pointing, with a mouse, previews a row; leaving the list goes back)
test("a row pointed at previews; the choice stays", async ({ page }) => {
  await page.setViewportSize({ width: 790, height: 900 });
  await page.goto("./embed.html#scene=program-xray");
  const row = page.locator(`${col("sol")} .xrows li[data-offset="4438"]`);
  await row.hover();
  await expect(entry(page, "sol")).toHaveAttribute("data-offset", "4438");
  await expect.poll(() => lit(page, "sol")).toBe("1");
  await page.mouse.move(0, 0);
  await expect(entry(page, "sol")).toHaveAttribute("data-offset", "4432");
});
