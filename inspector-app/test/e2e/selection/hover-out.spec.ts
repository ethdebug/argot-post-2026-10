// A hover never stays behind: the pointer leaving a figure's frame
// (quickly, in one move), or the host saying so ({ type:
// "ethdebug:pointer-out" }), ends it; a touch's tap selects with no
// hover; bytes no value owns, pointed at, mute nothing
import type { Page } from "@playwright/test";
import { test, expect, ready } from "../../page";

const host = (base: string) => `<body style="margin:0">
  <iframe id="f" src="${base}embed.html#scene=pitfall-nesting"
    style="border:0;width:1100px;height:700px;display:block"></iframe>
  <div style="height:300px"></div></body>`;

const fig = (page: Page) => page.frameLocator("#f");
// (the bytes lit: by the hover, with nothing selected)
const lit = (page: Page) => fig(page).locator(
  ".view:not([hidden]) .b.hl").count();

async function hovered(page: Page, baseURL: string) {
  await page.setViewportSize({ width: 1200, height: 1000 });
  await page.goto("./embed.html");
  await page.setContent(host(baseURL));
  const f = fig(page);
  // (the scene selects alice's record; a click on it clears)
  await f.locator(".tree .row.sel").click();
  await expect(f.locator(".tree .row.sel")).toHaveCount(0);
  await f.locator('.tree li[data-path="totalScore"] > .row').hover();
  await expect.poll(() => lit(page)).toBe(16);
}

test("the pointer out of the frame in one quick move: no hover stays",
  async ({ page, baseURL }) => {
    await hovered(page, baseURL!);
    await page.mouse.move(1150, 950, { steps: 1 });
    await expect.poll(() => lit(page)).toBe(0);
  });

test("the host's pointer-out ends the hover", async ({ page, baseURL }) => {
  await hovered(page, baseURL!);
  await page.evaluate(() => (document.getElementById("f") as
    HTMLIFrameElement).contentWindow!.postMessage(
    { type: "ethdebug:pointer-out" }, "*"));
  await expect.poll(() => lit(page)).toBe(0);
});

test.describe("touch", () => {
  test.use({ hasTouch: true });
  test("a tap selects, and leaves no hover", async ({ page, browserName }) => {
    test.skip(browserName === "firefox", "no touch emulation");
    await ready(page);
    const row = page.locator('#tree li[data-path="totalScore"] > .row');
    // (the scene selects alice's record; a tap on it clears, every value
    // shown)
    await page.locator("#tree .row.sel").tap();
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
    await row.tap();
    await expect(page.locator("#tree .row.sel")).toHaveText(/totalScore/);
    // (a tap on the selection clears it, and lights nothing after)
    await row.tap();
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
    await expect(page.locator("#panel .b.hl")).toHaveCount(0);
    await expect(page.locator("#panel")).not.toHaveClass(/\bactive\b/);
  });
});

test("bytes no value owns, pointed at, mute nothing: with the "
  + "selection, and with none", async ({ page }) => {
  await ready(page);
  const free = page.locator(".view:not([hidden]) .wrow:has(" +
    ".b[data-owners]) .b[data-g]:not([data-owners])").first();
  await free.waitFor();
  // (every byte's and view's look, but the pointed bytes' own: at, fl)
  const own = ["at", "at-s", "at-e", "fl"];
  const looks = () => page.locator(".b[data-g], [data-view], .tree .row")
    .evaluateAll((es, o) => es.map((e) => [...e.classList]
      .filter((c) => !o.includes(c)).join(" ")), own);
  const unmoved = async () => {
    await page.mouse.move(0, 0);
    const rest = await looks();
    await free.hover();
    await expect(free).toHaveClass(/\bat\b/);
    expect(await looks()).toEqual(rest);
  };
  await expect(page.locator("#tree .row.sel")).toHaveCount(1);
  await unmoved();
  await page.locator("#tree .row.sel").click();
  await expect(page.locator("#tree .row.sel")).toHaveCount(0);
  await unmoved();
});
