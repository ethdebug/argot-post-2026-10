// The related view: All | Related over the storage dump, its context
// rows, the hash, the tree, and a walkthrough in it
import { pick } from "../../pick";
import type { Page } from "@playwright/test";
import { test, expect, still, type Win } from "../../page";
import { A } from "../../expect";

const open = async (page: Page, hash: string) => {
  // (a new load each time: a change of the hash alone loads nothing)
  await page.goto("about:blank");
  await page.goto(`./#${hash}`);
  await page.waitForFunction(() => (window as Win).results?.done);
};
// the storage dump's rows shown, by name
const rows = (page: Page) => page.locator(
  "#panel .view:not([hidden]) .wrow[data-slot]").evaluateAll((rs) =>
  rs.map((r) => (r as HTMLElement).dataset.name));
const tree = (page: Page) => page.locator("#tree li[data-path]")
  .evaluateAll((ls) => ls.map((l) => (l as HTMLElement).dataset.path));
const rel = (page: Page) => page.evaluate(() =>
  new URLSearchParams(location.hash.slice(1)).get("rel"));
const ROSTER0 = "keccak(slot 0)";
const RECORD = "keccak(0x7099…79c8, slot 3)";

test("All | Related: on, ± 1 row, off; in the hash", async ({ page }) => {
  await open(page, `ex=mid&sel=${A}.score`);
  const all = await rows(page);
  expect(all.length).toBeGreaterThan(10);
  expect(await rel(page)).toBe(null);
  await page.locator('#related button[data-rows="related"]').click();
  await expect.poll(() => rows(page)).toEqual(["slot 3", ROSTER0, RECORD]);
  expect(await rel(page)).toBe("0");
  await page.locator("#related input[data-context]").check();
  await expect.poll(() => rows(page)).toEqual(["slot 2", "slot 3", ROSTER0,
    `${ROSTER0} + 1`, RECORD, `${RECORD} + 1`]);
  expect(await rel(page)).toBe("1");
  await page.locator('#related button[data-rows="all"]').click();
  await expect.poll(() => rows(page)).toEqual(all);
  expect(await rel(page)).toBe(null);
});

test("the hash: a reload keeps the view and its context", async ({ page }) => {
  await open(page, `ex=mid&sel=${A}.score&rel=1`);
  await expect(page.locator('#related button[data-rows="related"]'))
    .toHaveAttribute("aria-checked", "true");
  await expect(page.locator("#related input[data-context]")).toBeChecked();
  await expect.poll(() => rows(page)).toHaveLength(6);
});

test("the tree: the selection's path, and where its key came from",
  async ({ page }) => {
    await open(page, `ex=mid&sel=${A}.score&rel=0`);
    await expect.poll(() => tree(page)).toEqual(["playerList", "playerList[0]",
      "players", A, `${A}.score`]);
  });

test("nothing selected: every row, and a hint", async ({ page }) => {
  await open(page, "ex=mid&sel=");
  const all = await rows(page);
  await page.locator('#related button[data-rows="related"]').click();
  await expect(page.locator("#related .relhint")).toBeVisible();
  expect(await rows(page)).toEqual(all);
});

test("hover moves nothing; a click selects, and the rows follow",
  async ({ page }) => {
    await open(page, `ex=mid&sel=${A}.score&rel=0`);
    await expect.poll(() => rows(page)).toHaveLength(3);
    await page.locator('#tree li[data-path="playerList"] > .row').hover();
    await page.locator('#tree li[data-path="playerList[0]"] > .row').hover();
    expect(await rows(page)).toEqual(["slot 3", ROSTER0, RECORD]);
    // (not lit by the selection: the first click ends it, the second
    // selects: test/pick.ts)
    await pick(page.locator('#tree li[data-path="playerList[0]"] > .row'));
    await expect.poll(() => rows(page)).toEqual(["slot 0", ROSTER0]);
  });

test("a walkthrough in the related view: step 0 to found, the same rows",
  async ({ page }) => {
    await open(page, `ex=mid&sel=${A}&rel=0`);
    const shown = await rows(page);
    expect(shown).toEqual(["slot 3", ROSTER0, RECORD, `${RECORD} + 1`]);
    await page.locator('#details button[data-r="start"]').click();
    await expect(page.locator("#details .rcount")).toHaveText("start");
    // (step 0: the record's slots lit, in rows that are shown)
    const lit = () => page.locator(
      "#panel .view:not([hidden]) .wrow:has(.b.hl)").evaluateAll((rs) =>
      rs.map((r) => (r as HTMLElement).dataset.name));
    await expect.poll(lit).toEqual(["slot 3", RECORD, `${RECORD} + 1`]);
    await page.locator("#details").focus();
    for (let i = 1; i <= 10; i++) {
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("#details .rcount"))
        .toHaveText(i === 10 ? "done" : new RegExp(`^${i}\\s*/\\s*9$`));
      expect(await rows(page)).toEqual(shown);
    }
  });

test("what a selection consulted: tinted in its record's colour, a light "
  + "popover; the anchor", async ({ page }) => {
  // (the same in All and in Related)
  for (const rel of ["", "&rel=0"]) {
    await open(page, `ex=mid&sel=players${rel}`);
    const playerList = page.locator(
      '#panel .view:not([hidden]) .wrow[data-name^="keccak(slot 0)"]');
    await expect(playerList).toHaveCount(3);
    await expect(playerList.first()).toHaveClass(/\brel\b/);
    // (alice's address, her record's colour, desaturated: blue)
    await expect(playerList.first().locator(".b.rel.pk1").first())
      .toBeVisible();
    await expect(page.locator(
      '#tree li[data-path="playerList[1]"] > .row')).toHaveClass(/rel pk2/);
    const pop = page.locator(".pop.kept.related");
    await expect(pop.filter({ hasText: "keccak(slot 0)" })).toHaveCount(1);
    await expect(pop.filter({ hasText: "slot 3 : (anchor slot for players)" }))
      .toHaveCount(1);
    // (the selection's own: as before, lit, a black popover)
    await expect(page.locator(".pop:not(.kept)").filter({
      hasText: "keccak(0x7099…79c8, slot 3)" })).toHaveCount(1);
  }
  // (a walkthrough: its steps light, no related treatment)
  await page.locator('#details button[data-r="start"]').click();
  await expect(page.locator("#panel .b.rel")).toHaveCount(0);
});

test("a consulted slot's role: anchor (a note), read (its names), both",
  async ({ page }) => {
    const pop = (slot: string) => page.locator(
      `#panel .view:not([hidden]) .wrow[data-name="${slot}"] .pop`);
    // (players' record: slot 3's number only, the base of its hash)
    await open(page, `ex=mid&sel=${A}`);
    await expect(pop("slot 3")).toHaveText(
      "slot 3 : (anchor slot for players)");
    await expect(pop("slot 3")).toHaveClass(/kept related/);
    await expect(page.locator('#panel .wrow[data-name="slot 3"] .b.rel'))
      .toHaveCount(0);
    // (the identifier in the note: upright, as names are)
    expect(await pop("slot 3").locator(".pnm").evaluate((e) =>
      getComputedStyle(e).fontStyle)).toBe("normal");
    // (playerList[0]: slot 0's length bounds the list (read), its number is
    // the data's base (anchor): both)
    await open(page, "ex=mid&sel=playerList[0]");
    await expect(pop("slot 0")).toHaveText(
      "slot 0 : length · (anchor slot for playerList)");
    // (playerList itself: slot 0 is its own length, lit, as before)
    await open(page, "ex=mid&sel=playerList");
    await expect(pop("slot 0")).not.toHaveClass(/related/);
    await expect(page.locator("#panel .view:not([hidden]) " +
      '.wrow[data-name="slot 0"] .b.hl').first())
      .toBeVisible();
  });

test.describe("view transitions", () => {
  test.use({ reducedMotion: "no-preference" });
  test("a deliberate change of the rows animates; hover and steps do not",
    async ({ page }) => {
      await open(page, `ex=mid&sel=${A}.score`);
      const has = await page.evaluate(() => "startViewTransition" in document);
      test.skip(!has, "no View Transitions here");
      await page.evaluate(() => {
        const w = window as unknown as { vts: number };
        w.vts = 0;
        const d = document as Document & { startViewTransition(f: () =>
          void): unknown };
        const s = d.startViewTransition.bind(d);
        d.startViewTransition = (f) => (w.vts++, s(f));
      });
      const n = () => page.evaluate(() =>
        (window as unknown as { vts: number }).vts);
      const settle = () => still(page);
      await page.locator('#related button[data-rows="related"]').click();
      await settle();
      expect(await n()).toBe(1);
      await expect.poll(() => rows(page)).toHaveLength(3);
      await page.locator('#tree li[data-path="playerList[0]"] > .row').hover();
      await settle();
      expect(await n()).toBe(1);
      await page.keyboard.press("Escape");
      await settle();
      expect(await n()).toBe(2);
      await page.locator('#tree li[data-path="players"] > .row').click();
      await settle();
      expect(await n()).toBe(3);
      await page.locator('#details button[data-r="start"]').click();
      await settle();
      await page.locator('#details button[data-r="next"]').click();
      await settle();
      expect(await n()).toBe(3);
      // (and at rest: no names left, the popovers back)
      expect(await page.evaluate(() => [...document.querySelectorAll<
        HTMLElement>("[data-vt]")].filter((e) =>
        e.style.viewTransitionName).length)).toBe(0);
      await page.keyboard.press("Escape");
      await settle();
      await page.locator('#related button[data-rows="all"]').click();
      await settle();
      expect(await n()).toBe(4);
      await expect(page.locator(".vt-run")).toHaveCount(0);
    });

  test("each one captures its new rows, runs to its end, and rapid "
    + "clicks are never lost", async ({ page }) => {
    await open(page, `ex=mid&sel=${A}.score`);
    const has = await page.evaluate(() => "startViewTransition" in document);
    test.skip(!has, "no View Transitions here");
    // (each: the rows in its new state, and whether it ran its course)
    await page.evaluate(() => {
      const w = window as unknown as { vt: { inside?: number;
        ms?: number }[] };
      w.vt = [];
      const rows = () => document.querySelectorAll(
        "#panel .view:not([hidden]) .wrow[data-slot]").length;
      type Start = (f: () => Promise<void>) => { finished: Promise<void> };
      const d = document as unknown as { startViewTransition: Start };
      const s = d.startViewTransition.bind(d);
      d.startViewTransition = (f) => {
        const e: { inside?: number; ms?: number } = {};
        const t0 = performance.now();
        w.vt.push(e);
        const t = s(async () => {
          await f();
          e.inside = rows();
        });
        t.finished.then(() => { e.ms = performance.now() - t0; });
        return t;
      };
    });
    const log = () => page.evaluate(() =>
      (window as unknown as { vt: { inside?: number; ms?: number }[] }).vt);
    const rel = (k: string) => page.locator(
      `#related button[data-rows="${k}"]`).click();
    // (the toggle and a selection from none: their rows are drawn in
    // the commit the transition captures, not a load later)
    await rel("related");
    await still(page);
    await page.keyboard.press("Escape");
    await still(page);
    await page.locator('#tree li[data-path="players"] > .row').click();
    await still(page);
    const [on, , sel] = await log();
    expect(on.inside).toBe(3);
    expect(sel.inside).toBe((await rows(page)).length);
    // (none cut short: each runs about its 400 ms)
    expect(on.ms).toBeGreaterThan(350);
    expect(sel.ms).toBeGreaterThan(350);
    // (four clicks in a row: each one lands; the last one wins)
    for (const k of ["all", "related", "all", "related"]) await rel(k);
    await still(page);
    expect((await log()).length).toBe(7);
    await expect(page.locator('#related button[data-rows="related"]'))
      .toHaveAttribute("aria-checked", "true");
    expect((await rows(page)).length).toBe(sel.inside);
  });
});
