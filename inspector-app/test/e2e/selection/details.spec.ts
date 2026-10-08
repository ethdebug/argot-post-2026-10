// Mirrors bin/run.mjs's details and bar-at-rest checks (vanilla d235617)
import { test, expect, type Page } from "@playwright/test";
import { A } from "../../expect";

type W = { select(id: string, view?: { sel?: string | null;
  mode?: string }): Promise<boolean>; results: { done: boolean } };
const ready = async (page: Page) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
};
const select = (page: Page, id: string, sel: string | null) =>
  page.evaluate(([i, s]) => (window as unknown as W).select(i!,
    { sel: s }), [id, sel]);
const dl = (page: Page) => page.evaluate(() => {
  const el = document.querySelector("#dtext")!;
  const out: Record<string, string | boolean> = {};
  const dts = el.querySelectorAll("dt");
  for (const dt of dts) out[dt.textContent!] = dt.nextElementSibling!
    .textContent!;
  if (!dts.length) out.text = el.textContent!.trim();
  return out;
});
const SLOT2 = "0x" + "2".padStart(64, "0");

test("details of what is pointed at, at two points and at one",
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", null);
    await page.locator('#tree li[data-path="totalHits"] > .row').hover();
    await expect.poll(() => dl(page)).toEqual({
      Value: "totalHits (uint64)", Where: "slot 2, bytes 8–15",
      Before: "7 (0x0000000000000007)", After: "8 (0x0000000000000008)" });
    await select(page, "mid", null);
    await page.locator(`#panel .word[data-side="after"][data-slot="${
      SLOT2}"] .b[data-i="31"]`).hover();
    const one = await dl(page);
    expect(one).toMatchObject({ Value: "totalScore (uint128)",
      Where: "slot 2, bytes 16–31", Holds: "140 (0x…00008c)" });
    expect("Before" in one || "After" in one).toBe(false);
    await page.mouse.move(1, 1);
    await expect.poll(() => dl(page)).toEqual({
      text: "Point at a value or a byte for its details." });
  });

test("the bar at rest: the selection, and the way in", async ({ page }) => {
  await ready(page);
  await select(page, "mid", null);
  await expect(page.locator("#details .rsel"))
    .toHaveText("Select a value to see how it was found.");
  await page.locator(`#tree li[data-path="${A}.combo"] > .row`).click();
  const box = await page.locator("#details").innerText();
  expect(box).toContain("players[0x7099…79c8].combo uint32 = 2");
  expect(box).not.toMatch(/\((before|after)/);
  expect(box).toContain("▸ Show how it was found");
  await expect(page.locator('#details button[data-r="start"]'))
    .toHaveCount(1);
  await expect(page.locator("#viewing")).toBeVisible();
  await expect(page.locator("#viewing"))
    .toHaveText("viewing players[0x7099…79c8].combo · Esc to clear");
  await select(page, "alice", A);
  await expect(page.locator("#details .rsel")).toContainText("(after)");
  await page.locator('#mode button[data-mode="before"]').click();
  await expect(page.locator("#details .rsel")).toContainText("(before)");
});

test("selecting moves nothing", async ({ page }) => {
  await ready(page);
  await select(page, "mid", null);
  const boxes = () => page.locator(
    "#details, #details > *, #panel .view:not([hidden]) .wrow:not(.cmp *), "
    + "#tree .row").evaluateAll((es) => es.map((e) => {
    const r = e.getBoundingClientRect();
    return [r.left + scrollX, r.top + scrollY, r.width, r.height]
      .map(Math.round).join();
  }));
  const rest = await boxes();
  await page.locator('#tree li[data-path="totalScore"] > .row').click();
  await page.mouse.move(1, 1);
  await expect.poll(boxes).toEqual(rest);
});
