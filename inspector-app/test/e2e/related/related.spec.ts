// The related view: All | Related over the storage dump, its context
// rows, the hash, the tree, and a walkthrough in it
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
  "#panel .view[data-side=after] .wrow[data-slot]").evaluateAll((rs) =>
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
    // (consulted by the selection, so inside it: one click selects it)
    await page.locator('#tree li[data-path="playerList[0]"] > .row').click();
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
      "#panel .view[data-side=after] .wrow:has(.b.hl)").evaluateAll((rs) =>
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
      '#panel .view[data-side=after] .wrow[data-name^="keccak(slot 0)"]');
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
      `#panel .view[data-side=after] .wrow[data-name="${slot}"] .pop`);
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
    await expect(page.locator("#panel .view[data-side=after] " +
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

  // (each path on a fresh page, its caches cold: the transition's new
  // state holds the new rows (the old and new differ, a named row moves),
  // it runs its course, and the page ends where the click said)
  const spy = (page: Page) => page.evaluate(() => {
    type E = { inside?: number; before: number; ms?: number;
      moved?: number; groups?: number };
    const w = window as unknown as { vt: E[] };
    w.vt = [];
    const rows = () => document.querySelectorAll(
      "#panel .view[data-side=after] .wrow[data-slot]").length;
    type T = { ready: Promise<void>; finished: Promise<void> };
    type Start = (f: () => Promise<void>) => T;
    const d = document as unknown as { startViewTransition: Start };
    const s = d.startViewTransition.bind(d);
    d.startViewTransition = (f) => {
      const e: E = { before: rows() };
      const t0 = performance.now();
      w.vt.push(e);
      const t = s(async () => {
        await f();
        e.inside = rows();
      });
      t.ready.then(() => {
        // (the named rows' groups: those whose box moves)
        const gs = document.getAnimations().filter((a) =>
          /::view-transition-group\(vt-/.test(String((a.effect as
            KeyframeEffect | null)?.pseudoElement ?? "")));
        e.groups = gs.length;
        e.moved = gs.filter((a) => {
          const k = (a.effect as KeyframeEffect).getKeyframes();
          return k.length > 1 && k[0].transform !== k.at(-1)!.transform;
        }).length;
      }, () => {});
      t.finished.then(() => { e.ms = performance.now() - t0; });
      return t;
    };
  });
  const last = (page: Page) => page.evaluate(() => (window as unknown as
    { vt: { inside?: number; before: number; ms?: number; moved?: number;
      groups?: number }[] }).vt.at(-1)!);
  const paths: [string, string, (page: Page) => Promise<unknown>][] = [
    ["All to Related, a selection", `ex=mid&sel=${A}.score`, (page) =>
      page.locator('#related button[data-rows="related"]').click()],
    ["Related to All", `ex=mid&sel=${A}.score&rel=0`, (page) =>
      page.locator('#related button[data-rows="all"]').click()],
    ["in Related, a selection from none", "ex=mid&sel=&rel=0", (page) =>
      page.locator('#tree li[data-path="players"] > .row').click()],
    ["in Related, another selection", `ex=mid&sel=${A}&rel=0`, (page) =>
      page.locator('#tree li[data-path="playerList[0]"] > .row').click()],
    ["in Related, a clear", `ex=mid&sel=${A}&rel=0`, async (page) => {
      await page.locator('#tree li[data-path="playerList"] > .row')
        .focus();
      await page.keyboard.press("Escape");
    }],
  ];
  // (every host draws its lens the same way: the page, the shell's
  // scene, an embed; a selection from none in Related animates in each,
  // and runs its course: in Firefox too, which ends a transition whose
  // page is redrawn under it)
  for (const [host, url] of [["the page", "./#ex=mid&sel=&rel=1"],
    ["the shell", "./shell.html#scene=mid&ex=mid&sel=&rel=1"],
    ["an embed", "./embed.html#scene=mid"]]) {
    test(`${host}: a selection from none in Related animates, its course `
      + "run", async ({ page }) => {
      await page.goto(url);
      const pl = page.locator('li[data-path="playerList"] > .row').first();
      await pl.waitFor();
      const has = await page.evaluate(() =>
        "startViewTransition" in document);
      test.skip(!has, "no View Transitions here");
      // (an embed's hash says nothing of Related: on, and nothing
      // selected)
      const rel = page.locator('button[data-rows="related"]').first();
      if (await rel.getAttribute("aria-checked") === "false") {
        await rel.click();
        await still(page);
      }
      if (await page.locator(".row.sel").count()) {
        await page.locator(".row.sel").first().click();
        await still(page);
      }
      await spy(page);
      await pl.click();
      await expect.poll(async () => (await last(page))?.ms, { timeout:
        5000 }).toBeGreaterThan(0);
      const e = await last(page);
      expect(e.inside, "a change of rows").not.toBe(e.before);
      expect(e.ms, "its course run").toBeGreaterThan(350);
    });
  }

  for (const [name, hash, act] of paths) {
    test(`${name}: captured, moving, its course run (cold)`,
      async ({ page, browserName }) => {
        await open(page, hash);
        const has = await page.evaluate(() =>
          "startViewTransition" in document);
        test.skip(!has, "no View Transitions here");
        await spy(page);
        await act(page);
        await still(page);
        await expect.poll(async () => (await last(page))?.ms, { timeout:
          5000 }).toBeGreaterThan(0);
        const e = await last(page);
        const now = (await rows(page)).length;
        expect(e.inside, "the new state captured").toBe(now);
        expect(e.inside, "a change of rows").not.toBe(e.before);
        expect(e.ms, "its course run").toBeGreaterThan(350);
        // (a row moved: Chromium lists the groups' keyframes)
        if (browserName === "chromium") {
          expect(e.moved, "a named row moved").toBeGreaterThan(0);
        }
      });
  }

  test("rapid clicks are never lost: the last one wins",
    async ({ page }) => {
      await open(page, `ex=mid&sel=${A}.score`);
      const has = await page.evaluate(() => "startViewTransition" in
        document);
      test.skip(!has, "no View Transitions here");
      const rel = (k: string) => page.locator(
        `#related button[data-rows="${k}"]`).click();
      for (const k of ["related", "all", "related", "all", "related"]) {
        await rel(k);
      }
      await still(page);
      await expect(page.locator('#related button[data-rows="related"]'))
        .toHaveAttribute("aria-checked", "true");
      await expect.poll(() => rows(page)).toHaveLength(3);
    });
});
