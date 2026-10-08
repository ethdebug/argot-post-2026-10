// Mirrors bin/run.mjs's contract checks: the source at the top, closed
// at first, coloured once opened, open remembered; the selection's
// declaration marked (a member: its struct)
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { A } from "../expect";

type W = { results: { done: boolean }; select(id: string,
  view?: { sel?: string | null }): Promise<boolean> };
const ready = (page: import("@playwright/test").Page) =>
  page.waitForFunction(() => (window as unknown as W).results?.done);

test("closed at first; a click opens and colours it; remembered; Enter "
  + "closes", async ({ page }) => {
  await page.goto("./");
  await ready(page);
  const box = page.locator("#contract-box");
  const st = () => box.evaluate((b: HTMLDetailsElement) => [b.open,
    b.offsetHeight > b.querySelector("summary")!.offsetHeight + 40,
    b.querySelector("summary")!.textContent!.replace(/\s+/g, " ").trim()]);
  const [open, seen, text] = await st();
  expect([open, seen]).toEqual([false, false]);
  expect(text).toMatch(/^Arcade\.sol — the contract \(\d+ lines\)$/);
  expect(await page.locator("#contract-src span[style]").count()).toBe(0);
  await box.locator("summary").click();
  expect((await st()).slice(0, 2)).toEqual([true, true]);
  await page.waitForSelector("#contract-src.coloured span");
  const col = await page.evaluate(() => {
    const p = document.querySelector("#contract-src")!;
    return [p.textContent!.trim(), new Set([...p.querySelectorAll(
      "span[style]")].map((s) => getComputedStyle(s).color)).size];
  });
  expect(col[0]).toBe(fs.readFileSync("contracts/Arcade.sol", "utf8")
    .trim());
  expect(col[1]).toBeGreaterThanOrEqual(3);
  await page.reload();
  await ready(page);
  expect((await st())[0]).toBe(true);
  await box.locator("summary").focus();
  await page.keyboard.press("Enter");
  expect((await st())[0]).toBe(false);
});

test("the selection's declaration marked: a member, its struct",
  async ({ page }) => {
    await page.goto("./");
    await ready(page);
    await page.evaluate((a) => (window as unknown as W).select("alice",
      { sel: `${a}.combo` }), A);
    const mark = (await page.locator("#contract-src .line.decl")
      .allTextContents()).join("\n");
    expect(mark).toContain("struct Player");
    expect(await page.locator("pre.src:not(#memory *)").count()).toBe(1);
  });
