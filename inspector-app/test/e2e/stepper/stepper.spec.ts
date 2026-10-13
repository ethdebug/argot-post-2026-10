// The bugc stepper (T8.1): carol's join, stepped; `name`, a calldata
// reference, lights the call's bytes, NAME_C, in the calldata dump
import { test, expect } from "../../page";
import { pick } from "../../pick";
import { NAME_C, STEPPER } from "../../expect";

for (const id of Object.values(STEPPER)) {
  test(`${id}: the name, sliced from the call, lights its bytes ` +
    "in calldata; its walkthrough reads the reference's word",
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`./embed.html#scene=${id}`);
    await expect(page.locator(".mbar .dot.cur")).toHaveAttribute(
      "data-k", "0");
    // (-O 0: its second moment; -O 2: its first, carol's join)
    if (id === STEPPER.O0) {
      await page.locator('.mbar [data-t="next"]').click();
      await expect(page.locator(".mbar .rcap"))
        .toHaveText("the name, sliced from the call");
    }
    await pick(page.locator('li[data-path="name"] > .row'));
    // (the call's bytes 68 to 101: NAME_C, lit in the calldata dump)
    const lit = await page.locator('[data-view$=":calldata"] .b.hl')
      .evaluateAll((bs) => bs.map((b) => {
        const w = (b.closest(".word") as HTMLElement).dataset.slot!;
        return parseInt(w, 16) + Number((b as HTMLElement).dataset.i);
      }).sort((a, b) => a - b));
    const n = Buffer.byteLength(NAME_C);
    expect(lit).toEqual(Array.from({ length: n }, (_, k) => 68 + k));
    await page.locator('button[data-r="start"]').click();
    await page.locator(".rdots .dot").last().click();
    await expect(page.locator(".wpanel .rcap")).toContainText("name");
  });
}

// The figure fills its frame at every width a host gives it, nothing
// past its right edge (the code's long lines wrap in their pane)
for (const id of Object.values(STEPPER)) {
  for (const width of [358, 960, 1216]) {
    test(`${id} at ${width}px: nothing wider than the frame`,
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`./embed.html#scene=${id}`);
        await expect(page.locator(".mbar .dot.cur")).toHaveCount(1);
        await expect(page.locator("pre.src .line").first()).toBeVisible();
        const over = await page.evaluate(() => [...document
          .querySelectorAll("#embed *")].filter((e) =>
          e.getBoundingClientRect().right > innerWidth + 0.5)
          .map((e) => `${e.tagName}.${e.className}`).slice(0, 5));
        expect(over).toEqual([]);
      });
  }
}
