import type { Page } from "@playwright/test";
import { test, expect, usable, select, type Win } from "../../page";
import { expected, defaults } from "../../expect";
import fs from "node:fs";

const all = JSON.parse(fs.readFileSync("../demos/inspector/fixtures/index.json",
  "utf8")) as { id: string; summary: string; points: string[];
    lens?: string }[];
// (the storage inspector's scenes: Raw bytes is the raw lens's)
const scenes = all.filter((s) => !s.lens);


test("each scene's values, via window.select", async ({ page }) => {
  await page.goto("./");
  await usable(page);
  for (const id of ["mid", "alice", "motd", "vyper"]) {
    expect(await select(page, id, null)).toBe(true);
    const got = await page.evaluate((x) =>
      (window as Win).results.decoded[x], id);
    for (const [p, b, a] of expected[id]) {
      expect([got[p]?.before, got[p]?.after], `${id} ${p}`).toEqual([b, a]);
    }
  }
  expect(await page.evaluate(() => (window as Win).results.errors))
    .toEqual([]);
});

test("intro and summary follow the scene; one-point hides mode",
  async ({ page }) => {
    await page.goto("./");
    await usable(page);
    for (const s of scenes) {
      await page.locator(`#picker button[data-id="${s.id}"]`).click();
      await expect(page.locator(`#picker button[data-id="${s.id}"]`))
        .toHaveAttribute("aria-checked", "true");
      await expect(page.locator(`#intros [data-scene="${s.id}"]`))
        .toBeVisible();
      await expect(page.locator("#intros [data-scene]:visible"))
        .toHaveCount(1);
      await expect(page.locator("#summary")).toHaveText(s.summary);
      const single = s.points.length === 1;
      await expect(page.locator("#mode")).toBeVisible({ visible: !single });
      if (single) {
        await expect(page.locator("main")).toHaveAttribute("data-single",
          "");
      } else {
        await expect(page.locator("main")).not.toHaveAttribute(
          "data-single");
      }
      // the scene's default selection, in the mode it opens with
      const [mode, sel] = defaults[s.id];
      await expect(page.locator(`#panel .view[data-side="${mode}"]`))
        .toBeVisible();
      await expect(page.locator("#tree .row.sel"))
        .toHaveCount(1);
      await expect(page.locator(`#tree li[data-path="${sel}"] > .row`))
        .toHaveAttribute("aria-pressed", "true");
    }
  });

test("Before | After shows the other side's dump and values",
  async ({ page }) => {
    await page.goto("./");
    await usable(page);
    await page.locator('#picker button[data-id="alice"]').click();
    const score = page.locator(
      '#tree li[data-path$="c8].score"] > .row .val');
    await expect(score).toHaveText("60");
    await expect(score).toHaveClass(/\bchg\b/);
    await page.locator('#mode button[data-mode="before"]').click();
    await expect(page.locator('#mode button[data-mode="before"]'))
      .toHaveAttribute("aria-checked", "true");
    await expect(page.locator('#panel .view[data-side="before"]'))
      .toBeVisible();
    await expect(page.locator('#panel .view[data-side="after"]'))
      .toBeHidden();
    await expect(score).toHaveText("30");
  });

test("the Vyper scene shows Vyper's words, owned by nobody",
  async ({ page }) => {
    await page.goto("./");
    await usable(page);
    await select(page, "vyper");
    const vy = page.locator(
      '#panel .view:not([hidden]) .wrow[data-name^="Vyper\'s keccak"]');
    await expect(vy).toHaveCount(25);
    await expect(vy.locator(".b[data-owners]")).toHaveCount(0);
  });

test("the dump and the tree are always shown: at rest, with a selection, "
  + "in a walkthrough, in every scene", async ({ page }) => {
  await page.goto("./");
  await usable(page);
  const shown = () => page.evaluate(() => ["#panel .view:not([hidden]) .rows",
    "#tree"].every((q) => {
    const r = document.querySelector(q)?.getBoundingClientRect();
    return !!r && r.width > 50 && r.height > 50;
  }));
  for (const s of scenes) {
    await select(page, s.id, null);
    expect(await shown(), `${s.id} at rest`).toBe(true);
    await select(page, s.id);
    expect(await shown(), `${s.id} selected`).toBe(true);
    await page.locator('#details button[data-r="start"]').click();
    expect(await shown(), `${s.id} walking`).toBe(true);
    await page.keyboard.press("Escape");
  }
});
