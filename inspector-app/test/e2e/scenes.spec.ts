import { test, expect, type Page } from "@playwright/test";
import { expected, defaults } from "../expect";
import fs from "node:fs";

const scenes = JSON.parse(fs.readFileSync("static/fixtures/index.json",
  "utf8")) as { id: string; summary: string; points: string[] }[];

type W = Window & typeof globalThis & {
  select(id: string, view?: { mode?: string; sel?: string | null }):
    Promise<boolean>;
  results: { done: boolean; errors: string[];
    decoded: Record<string, Record<string, { before?: string;
      after?: string }>> };
};
const ready = (page: Page) => page.waitForFunction(() =>
  (window as unknown as W).results?.done);

test("each scene's values, via window.select", async ({ page }) => {
  await page.goto("./");
  await ready(page);
  for (const id of ["mid", "alice", "motd", "vyper"]) {
    expect(await page.evaluate((x) => (window as unknown as W)
      .select(x, { sel: null }), id)).toBe(true);
    const got = await page.evaluate((x) =>
      (window as unknown as W).results.decoded[x], id);
    for (const [p, b, a] of expected[id]) {
      expect([got[p]?.before, got[p]?.after], `${id} ${p}`).toEqual([b, a]);
    }
  }
  expect(await page.evaluate(() => (window as unknown as W).results.errors))
    .toEqual([]);
});

test("intro and summary follow the scene; one-point hides mode",
  async ({ page }) => {
    await page.goto("./");
    await ready(page);
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
    await ready(page);
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
    await ready(page);
    await page.evaluate(() => (window as unknown as W).select("vyper"));
    const vy = page.locator(
      '#panel .view:not([hidden]) .wrow[data-name^="Vyper\'s keccak"]');
    await expect(vy).toHaveCount(25);
    await expect(vy.locator(".b[data-owners]")).toHaveCount(0);
  });
