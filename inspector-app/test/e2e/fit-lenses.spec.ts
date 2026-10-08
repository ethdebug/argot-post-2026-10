// The shell's Phase 2 fit lenses get the same interaction rules as the
// page: hover a plain fill (no caps), the rest steps back, caps on a
// selection; chevrons at the row's right end
import { test, expect, type Page } from "@playwright/test";

const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
const open = async (page: Page, lens: string) => {
  await page.goto(`./shell.html#lens=${lens}`);
  await expect(page.locator(".view .b[data-owners]").first())
    .toBeAttached();
};
const look = (page: Page) => page.evaluate(() => {
  const lit = [...document.querySelectorAll<HTMLElement>(".view .b.hl")];
  const rest = [...document.querySelectorAll<HTMLElement>(
    ".view:not([hidden]) .rows .b:not(.hl):not(.at)")];
  return { lit: lit.length,
    capped: lit.filter((b) => getComputedStyle(b).boxShadow !== "none")
      .length,
    back: rest.length > 0 && rest.every((b) =>
      +getComputedStyle(b).opacity < 0.5) };
});

for (const lens of ["alice-plays", "vyper"]) {
  test(`${lens}: hover plain, the rest steps back; a selection capped`,
    async ({ page }) => {
      await open(page, lens);
      await page.locator(`.tree li[data-path="${A}.score"] > .row`).first()
        .hover();
      const h = await look(page);
      expect(h.lit).toBeGreaterThan(0);
      expect([h.capped, h.back]).toEqual([0, true]);
      await page.locator(`.tree li[data-path="${A}.score"] > .row`).first()
        .click();
      await page.mouse.move(1, 1);
      const s = await look(page);
      expect(s.capped).toBe(s.lit);
    });

  test(`${lens}: a chevron at its row's right end`, async ({ page }) => {
    await open(page, lens);
    const g = await page.evaluate((a) => {
      const li = document.querySelector(`.tree li[data-path="${a}"]`)!;
      const r = li.querySelector(":scope > .row")!.getBoundingClientRect();
      const c = li.querySelector(":scope > .chev")!.getBoundingClientRect();
      return { right: r.right - c.right < 20, middle: Math.abs((c.top +
        c.bottom) / 2 - (r.top + r.bottom) / 2) < 2 };
    }, A);
    expect(g).toEqual({ right: true, middle: true });
  });
}

test("players-walk: opens at step 0 of players, and walks", async ({ page }) => {
  await page.goto("./shell.html#lens=players-walk");
  const count = page.locator(".rbar .rcount");
  await expect(count).toHaveText("0 / 12");
  await expect(page.locator(".view .b.hl")).not.toHaveCount(0);
  await page.locator('.rbar button[data-r="next"]').click();
  await expect(count).toHaveText("1 / 12");
  await expect(page.locator(".dtext .rcap")).toContainText("The keys");
});
