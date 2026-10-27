// The storage tree's groups (vanilla 2ff37ec's collapse checks), in the
// storage inspector's figure (pitfall-nesting), and its alignment with
// the dump
import type { Page } from "@playwright/test";
import { test, expect, ready, select, still } from "../../page";
import { A, B } from "../../expect";

const chev = (page: Page, p: string) =>
  page.locator(`#tree li[data-path="${p}"] > .chev`);
const st = (page: Page) => page.evaluate(() => {
  const li = document.querySelector('#tree li[data-path="players"]')!;
  return { shut: li.classList.contains("collapsed"),
    aria: li.querySelector(":scope > .chev")!.getAttribute("aria-expanded"),
    kids: (li.querySelector(":scope > ul") as HTMLElement).offsetHeight,
    hues: [...document.querySelectorAll(
      "#panel .view[data-side=after] .b.hl")].filter((b) =>
      /\bpk\d/.test(b.className)).length,
    lit: document.querySelectorAll("#panel .view[data-side=after] .b.hl")
      .length,
    sel: (document.querySelector("#tree .row.sel")?.parentElement as
      HTMLElement | undefined)?.dataset.path,
    dump: JSON.stringify([...document.querySelectorAll(
      "#panel .view[data-side=after] .wrow")].map((r) => {
      const b = r.getBoundingClientRect();
      return [b.left, b.top + scrollY].map(Math.round);
    })) };
});

// (the related view: the dump shows the rows of the selection's shown
// rows, so a group shut shows fewer; open again, as it was)
test("groups collapse by their chevron; open again, the dump as it was",
  async ({ page }) => {
    await ready(page);
    await select(page, "players");
    await page.mouse.move(1, 1);
    const s0 = await st(page);
    await chev(page, "players").click();
    await page.mouse.move(1, 1);
    const s1 = await st(page);
    await chev(page, "players").focus();
    await page.keyboard.press("Enter");
    const s2 = await st(page);
    await page.keyboard.press(" ");
    const s3 = await st(page);
    await select(page, null);
    await page.locator(
      `#panel .view[data-side=after] .b[data-owners="${A}.score"]`)
      .first().click();
    const s4 = await st(page);
    expect([s0.shut, s0.aria, s0.hues > 0]).toEqual([false, "true", true]);
    expect([s1.shut, s1.aria, s1.kids, s1.hues, s1.lit, s1.sel])
      .toEqual([true, "false", 0, 0, s0.lit, "players"]);
    expect([s2.shut, s2.aria, s2.hues > 0]).toEqual([false, "true", true]);
    expect(s2.dump).toBe(s0.dump);
    expect(s3.shut).toBe(true);
    expect([s4.shut, s4.sel]).toEqual([false, `${A}.score`]);
  });

test("a chevron points at its row; a hidden row lights its ancestor",
  async ({ page }) => {
    await ready(page);
    await select(page, null);
    await chev(page, "playerList").hover();
    await expect(page.locator('#tree li[data-path="playerList"] > .row'))
      .toHaveClass(/\bhl\b/);
    await expect(page.locator("#panel .view[data-side=after] .b.hl"))
      .toHaveCount(92);
    await chev(page, "playerList").click();
    await page.locator(
      '#panel .view[data-side=after] .b[data-owners="playerList[0]"]')
      .first().hover();
    await expect(page.locator('#tree li[data-path="playerList"] > .row'))
      .toHaveClass(/\bhl\b/);
    await chev(page, "playerList").click();
    // (an inner group keeps its state when its parent closes and opens)
    await chev(page, A).click();
    await chev(page, "players").click();
    await chev(page, "players").click();
    expect(await page.evaluate((x) => x.map((p) => document.querySelector(
      `#tree li[data-path="${p}"]`)!.classList.contains("collapsed")),
    [A, B])).toEqual([true, false]);
  });

test("a group opens and closes with a short height animation; none with "
  + "reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await select(page, null);
  // (the group's animation itself, caught as it starts, in the same
  // task as the click (a MutationObserver: the style the animation
  // sets, or the group's new rows), and awaited to its end: its height
  // keyframes and its duration, never heights sampled at times)
  const animation = () => page.evaluate(() => new Promise<{
    heights: string[]; duration: number }>((ok) => {
    const q = '#tree li[data-path="playerList"] > ul';
    const tree = document.querySelector("#tree")!;
    const look = () => {
      const a = document.getAnimations().find((x) =>
        (x.effect as KeyframeEffect | null)?.target?.matches(q));
      if (!a) return;
      seen.disconnect();
      const e = a.effect as KeyframeEffect;
      void a.finished.then(() => ok({
        heights: e.getKeyframes().map((k) => String(k.height)),
        duration: Number(e.getTiming().duration) }));
    };
    const seen = new MutationObserver(look);
    seen.observe(tree, { subtree: true, childList: true, attributes: true,
      attributeFilter: ["style", "class"] });
  }));
  const ul = page.locator('#tree li[data-path="playerList"] > ul');
  const full = await ul.evaluate((e) => e.scrollHeight);
  let anim = animation();
  await chev(page, "playerList").click();
  expect(await anim).toEqual({ heights: [`${full}px`, "0px"],
    duration: 180 });
  await expect(page.locator('#tree li[data-path="playerList"]'))
    .toHaveClass(/\bcollapsed\b/);
  anim = animation();
  await chev(page, "playerList").click();
  expect(await anim).toEqual({ heights: ["0px", `${full}px`],
    duration: 180 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await chev(page, "playerList").click();
  await expect(page.locator('#tree li[data-path="playerList"]'))
    .toHaveClass(/\bcollapsed\b/, { timeout: 50 });
});

test("quick chevron clicks during the animation end in the right state",
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await ready(page);
    await select(page, null);
    const li = page.locator('#tree li[data-path="playerList"]');
    await chev(page, "playerList").click();
    await chev(page, "playerList").click();
    await still(page);
    await expect(li).not.toHaveClass(/\bcollapsed\b/);
    await expect(chev(page, "playerList")).toHaveAttribute("aria-expanded",
      "true");
    await chev(page, "playerList").click();
    await chev(page, "playerList").click();
    await chev(page, "playerList").click();
    await still(page);
    await expect(li).toHaveClass(/\bcollapsed\b/);
    // (a selection made meanwhile, at its bytes, is not hidden by a late
    // close)
    await chev(page, "players").click();
    await page.locator(
      `#panel .view[data-side=after] .b[data-owners="${A}.score"]`)
      .first().click();
    await still(page);
    await expect(page.locator("#tree .row.sel")).toHaveCount(1);
    await expect(page.locator('#tree li[data-path="players"]'))
      .not.toHaveClass(/\bcollapsed\b/);
  });

// (two columns, from 910px: embed.css)
for (const scene of ["pitfall-nesting", "pointer-walkthrough"]) {
  test(`${scene} in two columns: the tree's first row level with the ` +
    "dump's first line", async ({ page }) => {
    await ready(page, { scene, width: 1216 });
    await still(page);
    const d = await page.evaluate(() => {
      const r = (q: string) => document.querySelector(q)!
        .getBoundingClientRect();
      return r("#panel .view .rows > *").top - r("#tree li .row").top;
    });
    expect(Math.abs(d)).toBeLessThanOrEqual(1);
  });
}
