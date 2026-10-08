// Mirrors bin/run.mjs's collapse and edge-button checks (vanilla
// 2ff37ec), on the parity page
import { test, expect, type Page } from "@playwright/test";
import { A, B, C } from "../expect";

type W = { select(id: string, view?: { sel?: string | null }):
  Promise<boolean>; results: { done: boolean } };
const w = (page: Page) => page as unknown as Page;
const select = (page: Page, sel: string | null) => page.evaluate((x) =>
  (window as unknown as W).select("mid", { sel: x }), sel);
const ready = async (page: Page) => {
  await w(page).goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
};
const chev = (page: Page, p: string) =>
  page.locator(`#tree li[data-path="${p}"] > .chev`);
const st = (page: Page) => page.evaluate(() => {
  const li = document.querySelector('#tree li[data-path="players"]')!;
  return { shut: li.classList.contains("collapsed"),
    aria: li.querySelector(":scope > .chev")!.getAttribute("aria-expanded"),
    kids: (li.querySelector(":scope > ul") as HTMLElement).offsetHeight,
    hues: [...document.querySelectorAll(
      "#panel .view:not([hidden]) .b.hl")].filter((b) =>
      /\bpk\d/.test(b.className)).length,
    lit: document.querySelectorAll("#panel .view:not([hidden]) .b.hl")
      .length,
    sel: (document.querySelector("#tree .row.sel")?.parentElement as
      HTMLElement | undefined)?.dataset.path,
    dump: JSON.stringify([...document.querySelectorAll(
      "#panel .view:not([hidden]) .wrow")].map((r) => {
      const b = r.getBoundingClientRect();
      return [b.left, b.top + scrollY].map(Math.round);
    })) };
});

test("groups collapse by their chevron; the dump never moves",
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
      `#panel .view:not([hidden]) .b[data-owners="${A}.score"]`)
      .first().click();
    const s4 = await st(page);
    expect([s0.shut, s0.aria, s0.hues > 0]).toEqual([false, "true", true]);
    expect([s1.shut, s1.aria, s1.kids, s1.hues, s1.lit, s1.sel])
      .toEqual([true, "false", 0, 0, s0.lit, "players"]);
    expect(s1.dump).toBe(s0.dump);
    expect([s2.shut, s2.aria, s2.hues > 0]).toEqual([false, "true", true]);
    expect(s3.shut).toBe(true);
    expect([s4.shut, s4.sel]).toEqual([false, `${A}.score`]);
    expect(s4.dump).toBe(s0.dump);
  });

test("a chevron points at its row; a hidden row lights its ancestor",
  async ({ page }) => {
    await ready(page);
    await select(page, null);
    await chev(page, "roster").hover();
    await expect(page.locator('#tree li[data-path="roster"] > .row'))
      .toHaveClass(/\bhl\b/);
    await expect(page.locator("#panel .view:not([hidden]) .b.hl"))
      .toHaveCount(92);
    await chev(page, "roster").click();
    await page.locator(
      '#panel .view:not([hidden]) .b[data-owners="roster[0]"]')
      .first().hover();
    await expect(page.locator('#tree li[data-path="roster"] > .row'))
      .toHaveClass(/\bhl\b/);
    await chev(page, "roster").click();
    // (an inner group keeps its state when its parent closes and opens)
    await chev(page, A).click();
    await chev(page, "players").click();
    await chev(page, "players").click();
    expect(await page.evaluate((x) => x.map((p) => document.querySelector(
      `#tree li[data-path="${p}"]`)!.classList.contains("collapsed")),
    [A, B])).toEqual([true, false]);
  });

test("a lit row out of the tree's view: a circle button on the edge",
  async ({ page }) => {
    await ready(page);
    await select(page, null);
    // (the real layout: the tree box as tall as the dump, scrolling
    // inside itself)
    await page.evaluate(() => {
      document.querySelector("#tree")!.scrollTop = 0;
    });
    const pill = (x: string) => page.evaluate((way) => {
      const p = document.querySelector(`#edge-${way}`)!;
      const t = document.querySelector("#tree")!.getBoundingClientRect();
      const r = p.getBoundingClientRect();
      return !p.classList.contains("on") ? null : {
        text: p.textContent!.trim(), title: p.hasAttribute("title"),
        inside: r.top >= t.top - 1 && r.bottom <= t.bottom + 1,
        round: getComputedStyle(p).borderTopLeftRadius === "50%" &&
          Math.abs(r.width - r.height) < 1 && r.width < 40,
        centred: Math.abs((r.left + r.right) / 2 - (t.left + t.right) / 2)
          < 12 };
    }, x);
    const tops = () => page.evaluate(() => JSON.stringify([
      ...document.querySelectorAll<HTMLElement>("#tree li > .row")]
      .map((r) => r.offsetTop)));
    const t0 = await tops();
    // (the tree's bottom edge in view first: the click below would scroll
    // the page to the button, and the pointer, left where it was, would
    // then be over another byte, which takes the hover, and the button
    // goes: what a reader scrolling with the wheel would see too)
    await page.locator("#edge-down").scrollIntoViewIfNeeded();
    await page.locator(
      `#panel .view:not([hidden]) .b[data-owners="${C}.plays"]`)
      .first().hover();
    expect(await pill("down")).toEqual({ text: "", title: false,
      inside: true, round: true, centred: true });
    expect(await tops()).toBe(t0);
    await page.locator("#edge-down").click();
    await expect.poll(() => page.evaluate((c) => {
      const r = document.querySelector(`#tree li[data-path="${c}"] > .row`)!
        .getBoundingClientRect();
      const t = document.querySelector("#tree")!.getBoundingClientRect();
      return r.top >= t.top - 1 && r.bottom <= t.bottom + 1;
    }, `${C}.plays`)).toBe(true);
    await page.evaluate(() => {
      const t = document.querySelector("#tree")!;
      t.scrollTop = t.scrollHeight;
    });
    await page.locator(
      '#panel .view:not([hidden]) .b[data-owners="roster[0]"]')
      .first().hover();
    expect(await pill("up")).toMatchObject({ round: true, centred: true });
  });

test("a group opens and closes with a short height animation; none with "
  + "reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await select(page, null);
  const heights = async () => {
    const out: number[] = [];
    for (let k = 0; k < 6; k++) {
      out.push(await page.evaluate(() => (document.querySelector(
        '#tree li[data-path="roster"] > ul') as HTMLElement).offsetHeight));
      await page.waitForTimeout(30);
    }
    return out;
  };
  await chev(page, "roster").click();
  const closing = await heights();
  expect(closing.some((h) => h > 0 && h < closing[0] + 1)).toBe(true);
  await expect(page.locator('#tree li[data-path="roster"]'))
    .toHaveClass(/\bcollapsed\b/);
  await chev(page, "roster").click();
  const opening = await heights();
  expect(opening.at(-1)).toBeGreaterThan(opening[0]);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await chev(page, "roster").click();
  await expect(page.locator('#tree li[data-path="roster"]'))
    .toHaveClass(/\bcollapsed\b/, { timeout: 50 });
});

test("a slot the value uses only in the other state: marked 'only'",
  async ({ page }) => {
    await page.goto("./");
    await page.waitForFunction(() => (window as unknown as W).results?.done);
    await page.evaluate(() => (window as unknown as W).select("motd",
      { sel: "motd" }));
    await page.mouse.move(1, 1);
    // (After: motd is short, in slot 1; its old data slots, lit Before,
    // are "only" After)
    await expect(page.locator(
      '#panel .view[data-side="after"] .wrow.only')).toHaveCount(2);
    await expect(page.locator(
      '#panel .view[data-side="after"] .wrow.only > .word .b.hl'))
      .toHaveCount(0);
  });

test("the tree box: as tall as the dump, its first row level with the "
  + "dump's first line", async ({ page }) => {
  await ready(page);
  await select(page, null);
  await page.mouse.move(1, 1);
  const g = await page.evaluate(() => {
    const t = document.querySelector<HTMLElement>("#tree")!;
    const d = document.querySelector<HTMLElement>("#dump")!;
    const line = document.querySelector<HTMLElement>(
      "#panel .view:not([hidden]) .rows > *")!;
    const row = document.querySelector<HTMLElement>("#tree li .row")!;
    const top = (e: Element, c: string) => e.getBoundingClientRect().top -
      e.closest(c)!.getBoundingClientRect().top;
    // (|| 0: a difference of float noise below zero rounds to -0)
    return { bottom: Math.round(t.getBoundingClientRect().bottom -
      d.getBoundingClientRect().bottom) || 0,
    scrolls: t.scrollHeight > t.clientHeight + 1,
    level: Math.round(top(line, ".words") - top(row, ".storage")) };
  });
  expect(g).toEqual({ bottom: 0, scrolls: true, level: 0 });
});

test("quick chevron clicks during the animation end in the right state",
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await ready(page);
    await select(page, null);
    const li = page.locator('#tree li[data-path="roster"]');
    await chev(page, "roster").click();
    await chev(page, "roster").click();
    await page.waitForTimeout(400);
    await expect(li).not.toHaveClass(/\bcollapsed\b/);
    await expect(chev(page, "roster")).toHaveAttribute("aria-expanded",
      "true");
    await chev(page, "roster").click();
    await chev(page, "roster").click();
    await chev(page, "roster").click();
    await page.waitForTimeout(400);
    await expect(li).toHaveClass(/\bcollapsed\b/);
    // (a selection made meanwhile is not hidden by a late close)
    await chev(page, "players").click();
    await select(page, `${A}.score`);
    await page.waitForTimeout(400);
    await expect(page.locator('#tree li[data-path="players"]'))
      .not.toHaveClass(/\bcollapsed\b/);
  });

test("a scrolled tree aligns as an unscrolled one (its padding stays)",
  async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 700 });
    await ready(page);
    const pad = () => page.evaluate(() =>
      document.querySelector<HTMLElement>("#tree")!.style.paddingTop);
    const before = await pad();
    await page.evaluate(() => {
      const t = document.querySelector<HTMLElement>("#tree")!;
      t.scrollTop = t.scrollHeight;
    });
    expect(await page.evaluate(() =>
      document.querySelector<HTMLElement>("#tree")!.scrollTop))
      .toBeGreaterThan(50);
    // (a re-align: the dump's column changes size)
    await page.setViewportSize({ width: 1401, height: 700 });
    await page.evaluate(() => new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r))));
    expect(await pad()).toBe(before);
  });
