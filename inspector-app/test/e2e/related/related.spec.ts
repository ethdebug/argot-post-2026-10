// The related view, as the post's storage figures show it (their scenes
// say "related": true): the selection's rows, its context rows, the
// tree, and a walkthrough in it
import type { Page } from "@playwright/test";
import { test, expect, ready, select, still } from "../../page";
import { A } from "../../expect";

// the storage dump's rows shown, by name
const rows = (page: Page) => page.locator(
  "#panel .view[data-side=after] .wrow[data-slot]").evaluateAll((rs) =>
  rs.map((r) => (r as HTMLElement).dataset.name));
const tree = (page: Page) => page.locator("#tree li[data-path]")
  .evaluateAll((ls) => ls.map((l) => (l as HTMLElement).dataset.path));
const ROSTER0 = "keccak(slot 0)";
const RECORD = "keccak(0x7099…79c8, slot 3)";
// (pitfall-nesting, `sel` selected from none, the pointer away)
const open = async (page: Page, sel: string | null) => {
  await ready(page, { width: 1280 });
  await select(page, null);
  if (sel !== null) await select(page, sel);
  await page.mouse.move(1, 1);
};

// (the related view: the related rows, and a row around each, always)
// (and slot 0, playerList's length: what holds the key, consulted too;
// slot 1 between: a gap row there would save no room)
const SIX = ["slot 0", "slot 1", "slot 2", "slot 3", ROSTER0,
  `${ROSTER0} + 1`, RECORD, `${RECORD} + 1`];

test("the scene's selection: its related rows", async ({ page }) => {
  await ready(page);
  expect(await rows(page)).toEqual(SIX);
  await open(page, `${A}.score`);
  expect(await rows(page)).toEqual(SIX);
});

test("nothing selected: every row", async ({ page }) => {
  await open(page, null);
  expect((await rows(page)).length).toBeGreaterThan(SIX.length);
});

test("the tree: the selection's path, and where its key came from",
  async ({ page }) => {
    await open(page, `${A}.score`);
    // (a record's field: its record whole, the siblings muted, not gone)
    await expect.poll(() => tree(page)).toEqual(["playerList", "playerList[0]",
      "players", A, ...["score", "combo", "bestCombo", "plays", "hits",
        "lastBlock", "name"].map((f) => `${A}.${f}`)]);
  });

test("hover moves nothing; a click selects, and the rows follow",
  async ({ page }) => {
    await open(page, `${A}.score`);
    await expect.poll(() => rows(page)).toEqual(SIX);
    await page.locator('#tree li[data-path="playerList"] > .row').hover();
    await page.locator('#tree li[data-path="playerList[0]"] > .row').hover();
    expect(await rows(page)).toEqual(SIX);
    // (consulted by the selection, so inside it: one click selects it)
    await page.locator('#tree li[data-path="playerList[0]"] > .row').click();
    await expect.poll(() => rows(page)).toEqual(["slot 0", "slot 1",
      ROSTER0, `${ROSTER0} + 1`]);
  });

test("a walkthrough in the related view: step 0 to found, the same rows",
  async ({ page }) => {
    // (pointer-walkthrough: players, at its step 0)
    await ready(page, { scene: "pointer-walkthrough", width: 1280 });
    const shown = await rows(page);
    await expect(page.locator("#details .rcount")).toHaveText("start");
    // (step 0: players' slots lit, in rows that are shown)
    const lit = () => page.locator(
      "#panel .view[data-side=after] .wrow:has(.b.hl)").evaluateAll((rs) =>
      rs.map((r) => (r as HTMLElement).dataset.name));
    expect((await lit()).every((r) => shown.includes(r))).toBe(true);
    await page.locator("#details").focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.locator("#details .rcount")).toHaveText(/^1\s*\//);
    const steps = Number((await page.locator("#details .rcount")
      .innerText()).match(/\/\s*(\d+)/)![1]);
    expect(steps).toBeGreaterThan(1);
    expect(await rows(page)).toEqual(shown);
    for (let i = 2; i <= steps; i++) {
      await page.keyboard.press("ArrowRight");
      await expect(page.locator("#details .rcount"))
        .toHaveText(new RegExp(`^${i}\\s*/\\s*${steps}$`));
      expect(await rows(page)).toEqual(shown);
    }
  });

test("what a selection consulted: tinted in its record's colour, a light "
  + "popover; the anchor", async ({ page }) => {
  await open(page, "players");
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
  // (room under each key: each its own popover, why: a key)
  await expect(pop.filter({ hasText: "keccak(slot 0)" })).toHaveCount(3);
  await expect(pop.filter({ hasText: /^keccak\(slot 0\) : playerList\[0\] \(key for (players\[0x7099…79c8 \("alice"\)\]|alice's record)\)$/ })).toHaveCount(1);
  await expect(pop.filter({ hasText: "slot 3 : (anchor slot for players)" }))
    .toHaveCount(1);
  // (the selection's own: as before, lit, a black popover)
  await expect(page.locator(".pop:not(.kept)").filter({
    hasText: "keccak(0x7099…79c8, slot 3)" })).toHaveCount(1);
  // (a walkthrough, pointer-walkthrough's of players: its steps light, no
  // related treatment)
  await ready(page, { scene: "pointer-walkthrough", width: 1280 });
  await expect(page.locator("#panel .b.rel")).toHaveCount(0);
});

test("a consulted slot's role: anchor (a note), read (its names), both",
  async ({ page }) => {
    const pop = (slot: string) => page.locator(
      `#panel .view[data-side=after] .wrow[data-name="${slot}"] .pop`);
    // (players' record: slot 3's number only, the base of its hash)
    await open(page, A);
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
    await open(page, "playerList[0]");
    await expect(pop("slot 0")).toHaveText(
      "slot 0 : (length of playerList) · (anchor slot for playerList)");
    // (playerList itself: slot 0 is its own length, lit, as before)
    await open(page, "playerList");
    await expect(pop("slot 0")).not.toHaveClass(/related/);
    await expect(page.locator("#panel .view[data-side=after] " +
      '.wrow[data-name="slot 0"] .b.hl').first())
      .toBeVisible();
  });

test.describe("view transitions", () => {
  test.use({ reducedMotion: "no-preference" });
  // (the transitions started, counted)
  const count = (page: Page) => page.evaluate(() => {
    const w = window as unknown as { vts: number };
    w.vts = 0;
    const d = document as Document & { startViewTransition(f: () =>
      void): unknown };
    const s = d.startViewTransition.bind(d);
    d.startViewTransition = (f) => (w.vts++, s(f));
  });
  const n = (page: Page) => page.evaluate(() =>
    (window as unknown as { vts: number }).vts);
  const has = (page: Page) => page.evaluate(() =>
    "startViewTransition" in document);

  test("a change of the selection animates; hover and steps do not",
    async ({ page }) => {
      await open(page, `${A}.score`);
      test.skip(!await has(page), "no View Transitions here");
      await count(page);
      await page.locator('#tree li[data-path="playerList[0]"] > .row')
        .hover();
      await still(page);
      expect(await n(page)).toBe(0);
      await page.keyboard.press("Escape");
      await still(page);
      expect(await n(page)).toBe(1);
      await page.locator('#tree li[data-path="players"] > .row').click();
      await still(page);
      expect(await n(page)).toBe(2);
      // (and at rest: no names left)
      expect(await page.evaluate(() => [...document.querySelectorAll<
        HTMLElement>("[data-vt]")].filter((e) =>
        e.style.viewTransitionName).length)).toBe(0);
      await expect(page.locator(".vt-run")).toHaveCount(0);
      // (a walkthrough's steps: pointer-walkthrough's)
      await ready(page, { scene: "pointer-walkthrough", width: 1280 });
      await count(page);
      await page.locator('#details button[data-r="next"]').click();
      await still(page);
      await page.locator('#details button[data-r="next"]').click();
      await still(page);
      expect(await n(page)).toBe(0);
    });

  // (each path on a fresh page, its caches cold: the transition's new
  // state holds the new rows (the old and new differ, a named row moves),
  // it runs its course, and the page ends where the click said; in
  // Firefox too, which ends a transition whose page is redrawn under it)
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
  const paths: [string, string | null, (page: Page) => Promise<unknown>][] = [
    ["a selection from none", null, (page) =>
      page.locator('#tree li[data-path="playerList"] > .row').click()],
    ["another selection", A, (page) =>
      page.locator('#tree li[data-path="playerList[0]"] > .row').click()],
    ["a clear", A, async (page) => {
      await page.locator('#tree li[data-path="playerList"] > .row')
        .focus();
      await page.keyboard.press("Escape");
    }],
  ];
  for (const [name, sel, act] of paths) {
    test(`${name}: captured, moving, its course run (cold)`,
      async ({ page, browserName }) => {
        await open(page, sel);
        await still(page);
        test.skip(!await has(page), "no View Transitions here");
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
});
