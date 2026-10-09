import type { Page } from "@playwright/test";
import { test, expect, usable, select, type Win } from "../../page";
import { expected, defaults } from "../../expect";
import fs from "node:fs";

// (the storage inspector's scenes on the page: their files' captions,
// the summary, and moments)
const scenes = ["mid", "alice", "motd", "vyper"].map((id) => {
  const s = JSON.parse(fs.readFileSync(`scenes/${id}.json`, "utf8")) as
    { caption: string; timeline: unknown[] };
  return { id, summary: s.caption, points: s.timeline };
});


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

test("intro and summary follow the scene; one dump, the moment's",
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
      await expect(page.locator("#panel .view")).toHaveCount(1);
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

test("a scene of two moments: the later's dump and tree, its changes " +
  "marked; the timeline steps back to the earlier, in place",
async ({ page }) => {
  await page.goto("./");
  await usable(page);
  await page.locator('#picker button[data-id="alice"]').click();
  const score = page.locator(
    '#tree li[data-path$="c8].score"] > .row .val');
  await expect(score).toHaveText("60");
  await expect(score).toHaveClass(/\bchg\b/);
  const view = page.locator("#panel .view");
  await expect(view).toHaveCount(1);
  await expect(page.locator("#timeline .tline"))
    .toHaveText("after alice's third hit");
  // (totalScore, slot 2's last bytes: 140, then 170, the later's marked)
  const last = view.locator('.wrow[data-slot$="0002"] .b[data-i="31"]');
  await expect(last).toHaveText("aa");
  await expect(last).toHaveClass(/\bchg\b/);
  const y = (await view.boundingBox())!.y;
  await page.locator('#timeline [data-t="prev"]').click();
  await expect(page.locator("#timeline .tline"))
    .toHaveText("in the middle of the game");
  await expect(last).toHaveText("8c");
  await expect(score).toHaveText("30");
  expect((await view.boundingBox())!.y).toBe(y);
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
