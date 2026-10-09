import { test, expect } from "../../page";
import { lenses } from "../../../src/lenses";
import fs from "node:fs";

// (the scene files: the registry's, read as Node reads JSON)
const scenes = fs.readdirSync("scenes").map((f) =>
  JSON.parse(fs.readFileSync(`scenes/${f}`, "utf8")) as { lens: string });

// (what the picker lists: the scenes, then each lens no scene names)
const lensOf = (id: string) => lenses.find((l) => l.id === id)!;
const items = [...scenes.map((s) => lensOf(s.lens)),
  ...lenses.filter((l) => !scenes.some((s) => s.lens === l.id))];

test("picker lists the reviewed scenes (dev: every scene and lens); ] " +
  "moves on; reload restores", async ({ page }) => {
    await page.goto("./shell.html");
    const list = page.locator("[data-shell-list] button");
    await expect(list).toHaveCount(items.filter((l) => !l.dev).length);
    await page.locator("[data-shell-dev]").click();
    await expect(list).toHaveCount(items.length);
    await expect(page.locator(".shellparity")).toHaveAttribute("href", "./");
    await expect(page.locator('[data-shell-picker] [aria-current="page"]'))
      .toHaveCount(1);
    await page.locator("body").press("]");
    // (the next scene, mid: its lens writes its own keys once shown)
    await expect(page).toHaveURL(/#scene=mid&dev=1&ex=mid/);
    const url = page.url();
    await page.reload();
    expect(page.url()).toBe(url);
    await expect(page.locator('[data-shell-picker] [aria-current="page"]'))
      .toHaveAttribute("data-scene",
        new URL(url).hash.match(/scene=([^&]+)/)![1]);
  });

test("g opens the list; a scene in it shows that scene", async ({ page }) => {
  await page.goto("./shell.html");
  // (the shell mounts once the project is loaded: a key pressed before
  // that has no shell to go to)
  await expect(page.locator("[data-shell-picker]")).toBeAttached();
  const list = page.locator("[data-shell-list]");
  await expect(list).toBeHidden();
  await page.locator("body").press("g");
  await expect(list).toBeVisible();
  await list.locator('[data-scene="mid"]').click();
  await expect(list).toBeHidden();
  await expect(page).toHaveURL(/#scene=mid(&|$)/);
  await expect(page.locator("#tree li[data-path]").first()).toBeVisible();
});

test("copy link gives the current URL", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { copied: string[] };
    w.copied = [];
    Object.defineProperty(navigator, "clipboard", { value: {
      writeText: async (t: string) => void w.copied.push(t) } });
  });
  await page.goto("./shell.html#lens=inspector");
  // (the lens writes its own keys once its view is shown: a copy before
  // that is of a URL the page then changes)
  await expect(page).toHaveURL(/&ex=/);
  await page.locator("[data-shell-copy]").click();
  expect(await page.evaluate(() =>
    (window as unknown as { copied: string[] }).copied))
    .toEqual([page.url()]);
});
