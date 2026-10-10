// The program x-ray (scene program-xray): the compilers' own program
// entries for Arcade's play(), solc's or Fe's by the picker; pointing at
// an instruction shows its entry and lights its range; the box holds
// its height
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const F = "[data-figure=program-xray]";
const entry = (page: Page) => page.locator(`${F} .xentry pre`);
// (the entry's text as it reads, a line a line: its popovers left out)
const yaml = (page: Page) => entry(page).evaluate((e) => {
  const c = e.cloneNode(true) as HTMLElement;
  c.querySelectorAll(".xpop").forEach((p) => p.remove());
  return [...c.querySelectorAll(".line")].map((l) => l.textContent)
    .join("\n");
});
const lit = (page: Page) => page.locator(`${F} .codesrc mark.rng`)
  .allTextContents().then((t) => t.join(""));
// (where the range's first row is in the code panel: out of view, a
// fifth to a half of the way down, or elsewhere in view)
const place = (page: Page) => page.locator(`${F} .codesrc`)
  .evaluate((p) => {
    const m = [...p.querySelectorAll("mark.rng")].find((x) =>
      !x.closest(".ind"));
    if (!m) return "none";
    const b = p.getBoundingClientRect(), r = m.getBoundingClientRect();
    const y = (r.top - b.top) / b.height;
    return r.bottom < b.top || r.top > b.bottom ? "out"
      : y >= 0.2 && y <= 0.55 ? "third" : "in";
  });
const height = (page: Page) => page.locator(F).evaluate((e) =>
  Math.round(e.getBoundingClientRect().height));
const row = (page: Page, offset: number) =>
  page.locator(`${F} .xrows li[data-offset="${offset}"]`);

for (const width of [1024, 358]) {
  test(`at ${width}px: solc's and Fe's entries for play(), keys in the ` +
    "format's order, values as written; a row chosen shows its entry " +
    "and lights its range", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./embed.html#scene=program-xray");
    await expect(page.locator(`${F}[data-ready]`)).toHaveCount(1);
    const h = await height(page);
    // solc, at `player.plays += 1`: its PUSH's bytes, the range banded
    await expect(entry(page)).toHaveAttribute("data-offset", "4432");
    await expect.poll(() => yaml(page)).toMatch(new RegExp(
      "^offset: 4432\\noperation:\\n  mnemonic: PUSH2\\n" +
      '  arguments: \\[ "0x1177" \\]\\ncontext:\\n'));
    await expect.poll(() => entry(page).evaluate((e) => [...e
      .querySelectorAll(".line")].findIndex((l) => l.matches(".on"))))
      .toBe(7);
    await expect.poll(() => yaml(page))
      .toContain("    range: { offset: 1220, length: 17 }");
    await expect.poll(() => lit(page)).toBe("player.plays += 1");
    await expect(page.locator(`${F} .xentry .plabel`))
      .toContainText("Instruction at 4432");
    // (a field's popover: what it is)
    const range = `${F} .xname[data-id="context.code.range"]`;
    await page.locator(range).click();
    await expect(page.locator(`${range} > .xpop`)).toBeVisible();
    // a range off the code panel's screen, chosen: brought into view, a
    // third of the way down
    const far = page.locator(`${F} .xrows li:not(.absent)`).last();
    await far.scrollIntoViewIfNeeded();
    await page.locator(`${F} .codesrc`).evaluate((p) => {
      p.scrollTop = 0;
    });
    expect(await place(page)).toBe("out");
    await far.click();
    await expect.poll(() => place(page)).toBe("third");
    // the keys move the choice in a focused list
    const was = await entry(page).getAttribute("data-offset");
    await page.locator(`${F} .xrows`).focus();
    await page.keyboard.press("ArrowUp");
    await expect(entry(page)).not.toHaveAttribute("data-offset", was!);
    const solAt = await entry(page).getAttribute("data-offset");
    // Fe: the plays update, the same shape, no PUSH bytes; its own
    // fields one line, opened in place
    await page.locator(`${F} button[data-lang="fe"]`).click();
    await expect(entry(page)).toHaveAttribute("data-offset", "6463");
    await expect.poll(() => yaml(page)).toMatch(new RegExp(
      "^offset: 6463\\noperation:\\n  mnemonic: PUSH2\\ncontext:\\n"));
    await expect.poll(() => lit(page)).toMatch(/^store\.plays\.set\(/);
    await expect.poll(() => yaml(page)).toContain("+3 Fe-specific fields");
    await expect.poll(() => yaml(page)).not.toContain("classification");
    await page.locator(`${F} .xtoggle`).click();
    await expect.poll(() => yaml(page))
      .toContain("classification: source_mapped");
    // one with no context: its entry, the code panel muted, nothing lit
    const bare = page.locator(`${F} .xrows li.absent`).first();
    await bare.scrollIntoViewIfNeeded();
    await bare.click();
    await expect.poll(() => yaml(page)).not.toContain("context:");
    await expect(page.locator(`${F} .code[data-none]`)).toHaveCount(1);
    await expect(page.locator(`${F} .codesrc mark.rng`)).toHaveCount(0);
    // a row chosen: its entry and its range
    await row(page, 6401).scrollIntoViewIfNeeded();
    await row(page, 6401).click();
    await expect(entry(page)).toHaveAttribute("data-offset", "6401");
    await expect.poll(() => lit(page)).toBe("names.len(key: me)");
    expect(await height(page)).toBe(h);
    // (back to solc: where it was)
    await page.locator(`${F} button[data-lang="sol"]`).click();
    await expect(entry(page)).toHaveAttribute("data-offset", solAt!);
    // ↺ Reset: solc, at the plays update
    await page.locator(".reset").click();
    await expect(page.locator(`${F}[data-lang="sol"]`)).toHaveCount(1);
    await expect(entry(page)).toHaveAttribute("data-offset", "4432");
    await expect(page.locator(".reset")).not.toHaveAttribute("data-shown");
  });
}

// (pointing, with a mouse, previews a row; leaving the list goes back)
test("a row pointed at previews; the choice stays", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("./embed.html#scene=program-xray");
  await row(page, 4438).hover();
  await expect(entry(page)).toHaveAttribute("data-offset", "4438");
  await expect.poll(() => lit(page)).toBe("1");
  await page.mouse.move(0, 0);
  await expect(entry(page)).toHaveAttribute("data-offset", "4432");
});
