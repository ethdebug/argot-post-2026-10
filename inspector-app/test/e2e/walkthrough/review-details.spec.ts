// The walkthrough review's smaller findings: a click in a walkthrough
// targets exactly what was clicked (C6); no card of the other state
// (V4); the pointer's edge labels in strips of their own (T3); one name
// for "how it was found" (C5)
import { test, expect, ready, select, row, V } from "../../page";
import { A, C } from "../../expect";

test("in a walkthrough, a click targets exactly what was clicked",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", "players");
    await page.locator('#details button[data-r="start"]').click();
    await row(page, `${A}.score`).click();
    await expect(page.locator("#details .rtitle"))
      .toHaveText('How the pointer finds players["alice"].score');
    await page.locator(`${V} .b[data-owners="${C}.combo"]`).first().click();
    await expect(page.locator("#details .rtitle"))
      .toHaveText('How the pointer finds players["carol, the un…"].combo');
  });

test("a walkthrough shows no card of the other state", async ({ page }) => {
  await ready(page);
  await select(page, "alice", A);
  await expect(page.locator("#tree .tcard")).not.toHaveCount(0);
  await page.locator('#details button[data-r="start"]').click();
  await expect(page.locator("#tree .tcard")).toHaveCount(0);
});

test("the pointer's edge labels cover none of its lines", async ({ page }) => {
  await ready(page);
  await select(page, "mid", "players");
  await page.locator('#details button[data-r="start"]').click();
  await page.locator('#dots .dot[data-n="4"]').click();
  const hit = await page.evaluate(() => {
    const box = document.querySelector("#ptr")!.getBoundingClientRect();
    return [...document.querySelectorAll(".pedge.on button")].some((b) => {
      const r = b.getBoundingClientRect();
      return r.bottom > box.top + 0.5 && r.top < box.bottom - 0.5;
    });
  });
  expect(hit).toBe(false);
});

test("one name for the feature: \"How it was found\"", async ({ page }) => {
  await ready(page, { memory: true });
  for (const h of ["#chow-h", "#mhow-h"]) {
    await expect(page.locator(h)).toHaveText("How it was found");
  }
  await expect(page.locator(".hownote")).toHaveCount(2);
});
