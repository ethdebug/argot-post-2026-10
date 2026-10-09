import { test, expect } from "../../page";
import type { Page } from "@playwright/test";

// The walkthrough's start button ("How it was found") readable in every
// theme the host may ask for: its ink against its fill, at least 4.5:1
// (WCAG AA), by the OS's preference and by the host's theme= over it;
// in the figure's frame and in the panel's own frame.

const lum = (c: string) => {
  const [r, g, b] = c.match(/[\d.]+/g)!.slice(0, 3).map((v) => {
    const s = +v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};
const contrast = async (page: Page, url: string) => {
  await page.goto(url);
  const b = page.locator('button[data-r="start"]');
  await expect(b).toBeVisible({ timeout: 20_000 });
  const [ink, fill] = await b.evaluate((e) => {
    const c = getComputedStyle(e);
    return [c.color, c.backgroundColor];
  });
  // (an opaque fill: a see-through one would be the page's)
  expect(fill).toMatch(/^rgb\(/);
  return ratio(ink, fill);
};

for (const [os, theme] of [["light", ""], ["dark", ""], ["light", "dark"],
  ["dark", "light"]] as const) {
  test(`"How it was found" readable: OS ${os}` +
    (theme ? `, host ${theme}` : ""), async ({ page }) => {
    await page.emulateMedia({ colorScheme: os });
    const t = theme ? `&theme=${theme}` : "";
    expect(await contrast(page, `./embed.html#scene=mid${t}`))
      .toBeGreaterThanOrEqual(4.5);
    // (the panel's own frame: its figure's frame sends it the model)
    await page.setContent(`<iframe src="${new URL(
      `./embed-panel.html#scene=mid&channel=t${t}`, page.url())}"></iframe>` +
      `<iframe src="${new URL(`./embed.html#scene=mid&panel=external` +
      `&channel=t${t}`, page.url())}"></iframe>`);
    const panel = page.frameLocator("iframe").first();
    const b = panel.locator('.pshown button[data-r="start"]');
    await expect(b).toBeVisible({ timeout: 20_000 });
    const [ink, fill] = await b.evaluate((e) => {
      const c = getComputedStyle(e);
      return [c.color, c.backgroundColor];
    });
    expect(ratio(ink, fill)).toBeGreaterThanOrEqual(4.5);
    // (and its text the host's theme: dark text on a dark host is not)
    const want = (theme || os) === "dark";
    expect(lum(await panel.locator("body").evaluate((e) =>
      getComputedStyle(e).color)) > 0.4).toBe(want);
  });
}
