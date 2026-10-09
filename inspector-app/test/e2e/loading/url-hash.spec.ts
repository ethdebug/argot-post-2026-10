// Mirrors bin/run.mjs's hash checks (storage keys; vanilla d235617)
import { pick } from "../../pick";
import type { Page } from "@playwright/test";
import { test, expect, type Win } from "../../page";
import { A } from "../../expect";

const go = async (page: Page, hash: string) => {
  await page.goto("about:blank");
  await page.goto(`./#${hash}`);
  // (ready: it has shown its view, and written its keys)
  await page.waitForFunction(() => (window as Win).results?.done);
};
const view = (page: Page) => page.evaluate(() => ({
  ex: document.querySelector<HTMLElement>(
    '#picker [aria-checked="true"]')?.dataset.id,
  sel: (document.querySelector("#tree .row.sel")?.parentElement as
    HTMLElement | undefined)?.dataset.path,
  hash: location.hash }));

test("the hash restores the view (the old mode and insets keys go)",
  async ({ page }) => {
    await go(page, "ex=motd&mode=before&sel=playerList&insets=0");
    const hs = await view(page);
    expect(hs).toMatchObject({ ex: "motd", sel: "playerList" });
    for (const k of ["ex=motd", "sel=playerList"]) {
      expect(hs.hash).toContain(k);
    }
    for (const k of ["mode=", "insets="]) expect(hs.hash).not.toContain(k);
    await pick(page.locator('#tree li[data-path="totalScore"] > .row'));
    await expect.poll(() => page.evaluate(() => location.hash))
      .toMatch(/sel=totalScore/);
    // a cleared default selection stays cleared ("sel=")
    await pick(page.locator('#tree li[data-path="totalScore"] > .row'));
    await expect.poll(() => page.evaluate(() => location.hash))
      .toMatch(/(^#|&)sel=(&|$)/);
    await page.reload();
    await page.waitForFunction(() => (window as Win).results?.done);
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
  });

test("a scene alone gives its defaults; a stale hash the first scene's",
  async ({ page }) => {
    await go(page, "ex=mid");
    expect((await view(page)).sel).toBe(A);
    await go(page, "ex=nope&mode=compare&sel=zzz");
    const v = await view(page);
    expect([v.ex, v.sel]).toEqual(["mid", A]);
  });

test("Escape clears the selection; a click on empty space too",
  async ({ page }) => {
    await go(page, "ex=mid");
    await expect(page.locator("#tree .row.sel")).toHaveCount(1);
    await page.locator("#tree .row.sel").focus();
    await page.keyboard.press("Escape");
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
    await page.locator('#tree li[data-path="totalScore"] > .row').click();
    await page.locator("h1").click();
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
  });
