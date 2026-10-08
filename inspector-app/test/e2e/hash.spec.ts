// Mirrors bin/run.mjs's hash checks (storage keys; vanilla d235617)
import { test, expect, type Page } from "@playwright/test";
import { A } from "../expect";

type W = { results: { done: boolean } };
const go = async (page: Page, hash: string) => {
  await page.goto("about:blank");
  await page.goto(`./#${hash}`);
  // (both sections ready: each has shown its view, and written its keys)
  await page.waitForFunction(() => (window as unknown as W).results?.done &&
    (window as unknown as { memResults?: { done: boolean } }).memResults
      ?.done);
};
const view = (page: Page) => page.evaluate(() => ({
  ex: document.querySelector<HTMLElement>(
    '#picker [aria-checked="true"]')?.dataset.id,
  mode: document.querySelector<HTMLElement>(
    '#mode [aria-checked="true"]')?.dataset.mode,
  sel: (document.querySelector("#tree .row.sel")?.parentElement as
    HTMLElement | undefined)?.dataset.path,
  insets: (document.querySelector("#insets") as HTMLInputElement).checked,
  hash: location.hash }));

test("the hash restores the view, and keeps the memory keys",
  async ({ page }) => {
    await go(page, "ex=motd&mode=before&sel=roster&mopt=2&mpt=mult&" +
      "mmode=before&msel=m&insets=0");
    const hs = await view(page);
    expect(hs).toMatchObject({ ex: "motd", mode: "before", sel: "roster",
      insets: false });
    for (const k of ["ex=motd", "sel=roster", "mopt=2", "mpt=mult",
      "mmode=before", "msel=m"]) expect(hs.hash).toContain(k);
    await page.locator('#mode button[data-mode="after"]').click();
    await page.locator('#tree li[data-path="total"] > .row').click();
    await expect.poll(() => page.evaluate(() => location.hash))
      .toMatch(/mode=after.*sel=total|sel=total.*mode=after/);
    // a cleared default selection stays cleared ("sel=")
    await page.locator('#tree li[data-path="total"] > .row').click();
    await expect.poll(() => page.evaluate(() => location.hash))
      .toMatch(/(^#|&)sel=(&|$)/);
    await page.reload();
    await page.waitForFunction(() => (window as unknown as W).results?.done);
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
    expect(await page.evaluate(() => location.hash)).toContain("mpt=mult");
  });

test("a scene alone gives its defaults; a stale hash the first scene's",
  async ({ page }) => {
    await go(page, "ex=mid");
    expect((await view(page)).sel).toBe(A);
    await go(page, "ex=nope&mode=compare&sel=zzz&mopt=7&mpt=x");
    const v = await view(page);
    expect([v.ex, v.mode, v.sel]).toEqual(["mid", "after", A]);
  });

test("insets off goes into the hash, and on again out of it",
  async ({ page }) => {
    await go(page, "ex=alice");
    await page.locator("#insets").uncheck();
    await expect.poll(() => page.evaluate(() => location.hash))
      .toContain("insets=0");
    await page.locator("#insets").check();
    await expect.poll(() => page.evaluate(() => location.hash))
      .not.toContain("insets=");
  });

test("Escape clears the selection; a click on empty space too",
  async ({ page }) => {
    await go(page, "ex=mid");
    await expect(page.locator("#tree .row.sel")).toHaveCount(1);
    await page.locator("#tree .row.sel").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
    await page.locator('#tree li[data-path="total"] > .row').click();
    await page.locator("h1").click();
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
  });
