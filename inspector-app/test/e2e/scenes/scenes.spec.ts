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

test("intro and summary follow the scene; one moment: one dump",
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
      await expect(page.locator("#panel .view")).toHaveCount(single ? 1 : 2);
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

test("a scene of two moments: the earlier's dump above the later's, " +
  "each titled by its moment; the tree at the later, its changes marked",
async ({ page }) => {
  await page.goto("./");
  await usable(page);
  await page.locator('#picker button[data-id="alice"]').click();
  const score = page.locator(
    '#tree li[data-path$="c8].score"] > .row .val');
  await expect(score).toHaveText("60");
  await expect(score).toHaveClass(/\bchg\b/);
  const [before, after] = ["before", "after"].map((x) =>
    page.locator(`#panel .view[data-side=${x}]`));
  await expect(before).toBeVisible();
  await expect(after).toBeVisible();
  await expect(before.locator(".view-name")).toBeVisible();
  await expect(before.locator(".view-name"))
    .toHaveText("Storage in the middle of the game");
  await expect(after.locator(".view-name"))
    .toHaveText("Storage after alice's third hit");
  expect((await before.boundingBox())!.y)
    .toBeLessThan((await after.boundingBox())!.y);
  // (totalScore, slot 2's last bytes: 140, then 170, the later's marked)
  const last = (v: typeof before) => v.locator(
    '.wrow[data-slot$="0002"] .b[data-i="31"]');
  await expect(last(before)).toHaveText("8c");
  await expect(last(after)).toHaveText("aa");
  await expect(last(after)).toHaveClass(/\bchg\b/);
});

test("the Vyper scene shows Vyper's words, owned by nobody",
  async ({ page }) => {
    await page.goto("./");
    await usable(page);
    await select(page, "vyper");
    const vy = page.locator(
      '#panel .view[data-side=after] .wrow[data-name^="Vyper\'s keccak"]');
    await expect(vy).toHaveCount(25);
    await expect(vy.locator(".b[data-owners]")).toHaveCount(0);
  });

test("the dump and the tree are always shown: at rest, with a selection, "
  + "in a walkthrough, in every scene", async ({ page }) => {
  await page.goto("./");
  await usable(page);
  const shown = () => page.evaluate(() => ["#panel .view[data-side=after] .rows",
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
