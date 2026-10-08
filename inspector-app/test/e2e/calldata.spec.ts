// Mirrors bin/run.mjs's calldata block (vanilla 78bce69 calldata.js):
// setMotd's calldata by the ABI; a byte selects its part of text, a part
// lights its bytes; under the storage dump; the motd scene only; its
// selection apart from storage's
import { test, expect, type Page } from "@playwright/test";

type W = { select(id: string, view?: { sel?: string | null;
  mode?: string }): Promise<boolean>; results: { done: boolean };
  calldataResults: { lit: string[]; chosen: string | null };
  storageSel(): string | null };
const ready = async (page: Page, hash = "") => {
  await page.goto("./" + hash);
  await page.waitForFunction(() => (window as unknown as W).results?.done);
};
const dl = (page: Page, q: string) => page.evaluate((q) => {
  const out: Record<string, string> = {};
  for (const dt of document.querySelectorAll(`${q} dt`)) {
    out[dt.textContent!.trim()] =
      (dt.nextElementSibling as HTMLElement).innerText.trim();
  }
  return out;
}, q);
const cd = (page: Page) => page.evaluate(() =>
  (window as unknown as W).calldataResults);
// (each lit byte's offset in the calldata: its row's, and its place)
const lit = (page: Page) => page.evaluate(() => [...document
  .querySelectorAll<HTMLElement>("#cpanel .b.hl")].map((b) =>
  Number(b.closest<HTMLElement>(".wrow")!.dataset.slot) + +b.dataset.i!));
// (byte 40: the 5th of the word at 0x24, the length's)
const LEN = '#cpanel .wrow[data-slot="0x0020"] .b[data-i="8"]';
const range = (a: number, b: number) =>
  Array.from({ length: b - a }, (_, i) => a + i);

test("setMotd's calldata: selector, a byte selects its part, details",
  async ({ page }) => {
    await ready(page, "#ex=motd");
    await expect(page.locator("#calldata")).toBeVisible();
    await expect(page.locator('#ctree li[data-part="selector"] .val'))
      .toHaveText("0x5fe59b9d");
    // offset 32, then the length (5) at 0x24, then the bytes at 0x44
    await page.locator(LEN).click();
    expect((await cd(page)).chosen).toBe("m-length");
    expect(await dl(page, "#cdetails")).toMatchObject({ Holds: "5",
      Where: "calldata 0x0024–0x0043" });
    await expect(page.locator('#ctree li[data-part="m-length"] > .row'))
      .toHaveAttribute("aria-pressed", "true");
    await page.locator(LEN).click();
    expect((await cd(page)).chosen).toBe(null);
    await page.locator('#ctree li[data-part="m"] > .row').hover();
    expect(await lit(page)).toEqual(range(4, 73));
    // (the same panel as storage's: a popover on the lit rows; the
    // panel's location: vanilla 4c6de15)
    expect(await page.evaluate(() => [document.querySelectorAll(
      "#cpanel .pop").length > 0, (document.querySelector("#cpanel .views") as
      HTMLElement)?.dataset.loc])).toEqual([true, "calldata"]);
    await expect(page.locator("#chow")).toContainText("not by ethdebug");
    await expect(page.locator('#chow li[data-part="m-length"]'))
      .toHaveClass(/hl/);
    await page.locator("h1").hover();
    expect(await lit(page)).toEqual([]);
  });

test("under the storage dump, in its column; the motd scene only",
  async ({ page }) => {
    await ready(page, "#ex=motd");
    // (at rest: polled, the dump's font fitted)
    await expect.poll(() => page.evaluate(() => {
      const r = (q: string) => document.querySelector(q)!
        .getBoundingClientRect();
      const [c, p, d] = [r("#calldata"), r("#panel"), r("#dump")];
      return { left: Math.abs(c.left - p.left) < 2,
        under: c.top >= d.bottom - 1 && c.top - d.bottom < 60,
        shown: c.height > 100 };
    })).toEqual({ left: true, under: true, shown: true });
    for (const id of ["mid", "alice", "vyper"]) {
      await page.evaluate((i) => (window as unknown as W).select(i), id);
      await expect(page.locator("#calldata")).toBeHidden();
    }
    await page.evaluate(() => (window as unknown as W).select("motd"));
    await expect(page.locator("#calldata")).toBeVisible();
  });

test("its selection is its own: storage's stays; Escape clears its own",
  async ({ page }) => {
    await ready(page, "#ex=motd&sel=motd");
    const storage = () => page.evaluate(() =>
      new URLSearchParams(location.hash.slice(1)).get("sel"));
    expect(await storage()).toBe("motd");
    await page.locator('#ctree li[data-part="selector"] > .row').click();
    expect((await cd(page)).chosen).toBe("selector");
    expect(await storage()).toBe("motd");
    await page.keyboard.press("Escape");
    expect((await cd(page)).chosen).toBe(null);
    expect(await storage()).toBe("motd");
    // (keyboard: Enter on a byte run selects its part)
    await page.locator(
      '#cpanel .wrow[data-slot="0x0040"] .b[data-i="4"]').focus();
    await page.keyboard.press("Enter");
    expect((await cd(page)).chosen).toBe("m-data");
    expect(await dl(page, "#cdetails")).toMatchObject({
      Holds: '"gl hf"' });
    // (a click on the dump's empty space clears its own only)
    await page.locator("#calldata h2").click();
    expect((await cd(page)).chosen).toBe(null);
    expect(await storage()).toBe("motd");
  });

test("an offset-addressed run is named by its bytes' range, once",
  async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 900 });
    await page.goto("./");
    await page.waitForFunction(() => (window as unknown as
      { results: { done: boolean } }).results?.done);
    await page.evaluate(() => (window as unknown as { select(i: string,
      v: { sel: null }): Promise<boolean> }).select("motd", { sel: null }));
    const how = async (part: string) => {
      await page.locator(`#ctree li[data-part="${part}"] > .row`).hover();
      return page.locator("#cpanel .pop .phow").allInnerTexts();
    };
    // (across rows; inside one row; the whole value)
    await expect.poll(() => how("m-length")).toEqual(
      ["calldata 0x0024–0x0043"]);
    expect(await how("selector")).toEqual(["calldata 0x0000–0x0003"]);
    expect(await how("m")).toEqual(["calldata 0x0004–0x0048"]);
    // (a whole row, by its address)
    await page.locator('#cpanel .wrow[data-slot="0x0040"] > .addr').hover();
    expect(await page.locator("#cpanel .pop .phow").allInnerTexts())
      .toEqual(["calldata 0x0040"]);
  });
