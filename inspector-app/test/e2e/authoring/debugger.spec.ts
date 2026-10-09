// The debugger (addendum §3.1, §6) in the shell: a scene's run, every
// trace step a moment; the code panel, everything in scope, a dump of
// every location, linked; the moves; the pins. Expected values from
// memory.json (bug-O0, alice's third hit: transaction 12)
import type { Page } from "@playwright/test";
import fs from "node:fs";
import { test, expect, ready } from "../../page";
import { pick } from "../../pick";

const memory = JSON.parse(fs.readFileSync(
  "../demos/inspector/fixtures/memory.json", "utf8"));
const pause = (id: string) => memory.levels[0].points.find((p:
  { id: string }) => p.id === id).steps as { step: number; range?:
  { offset: number; length: number } }[];
const source: string = memory.program.source;
const slice = (r: { offset: number; length: number }) => Buffer.from(
  source, "utf8").subarray(r.offset, r.offset + r.length).toString("utf8")
  .replace(/\n/g, "");

const D = ".dbgpane";
const open = async (page: Page, scene: string, at?: string, w = 1440) => {
  await page.setViewportSize({ width: w, height: 900 });
  await page.goto(`./shell.html#scene=${scene}&debug=1${at ? `&at=${at}`
    : ""}`);
  await expect(page.locator(`${D} .moves .mat`)).toContainText(
    /trace step|after the transaction/, { timeout: 30_000 });
};
const marked = (page: Page) => page.locator(`${D} .code`).evaluate((c) => {
  const ms = [...c.querySelectorAll("mark.rng")];
  return { text: ms.map((m) => m.textContent).join(""),
    last: ms.some((m) => m.classList.contains("last")) };
});
const at = (page: Page) => page.locator(`${D} .moves .mat`)
  .getAttribute("data-moment");

test("the code panel marks the moment's range, memory.json's; a trace " +
  "step with none, the last one, muted; the box keeps its size",
async ({ page }) => {
  const [first, mult] = pause("mult");
  await open(page, "bug-O0", `12:${mult.step + 1}`);
  await expect.poll(() => marked(page))
    .toEqual({ text: slice(mult.range!), last: false });
  const box = await page.locator(`${D} .code`).boundingBox();
  expect(first.range).toBeUndefined();
  await page.goto("about:blank");
  await open(page, "bug-O0", `12:${first.step + 1}`);
  await expect.poll(async () => (await marked(page)).last).toBe(true);
  expect(await page.locator(`${D} .code`).boundingBox()).toEqual(box);
});

test("everything in scope: the storage variables and the locals; a " +
  "local lights its memory bytes, as the memory section's does",
async ({ page }) => {
  const [, mult] = pause("mult");
  await ready(page, { width: 1280, memory: true });
  await page.locator('#mlevel button[data-opt="0"]').click();
  await page.locator('#mpoint button[data-id="mult"]').click();
  const lit = (sel: string) => page.locator(sel).evaluateAll((bs) =>
    bs.map((b) => `${(b.closest(".word") as HTMLElement).dataset.slot} ${
      (b as HTMLElement).dataset.i}`).sort());
  await pick(page.locator('#mtree li[data-path="points"] > .row'));
  const want = await lit("#mpanel .view[data-side=after] .b.hl");
  expect(want.length).toBeGreaterThan(8);
  await open(page, "bug-O0", `12:${mult.step + 1}`);
  const names = (g: string) => page.locator(`${D} li[data-path="${g}"] ` +
    "li[data-path] > .row .name").allTextContents();
  await expect.poll(() => names("@locals"))
    .toEqual(["points", "combo", "mult"]);
  expect(await names("@storage")).toEqual(["playerList", "motd",
    "totalScore", "totalHits", "players"]);
  await page.locator(`${D} li[data-path="points"] > .row`).hover();
  await expect.poll(() => lit(`${D} [data-view$=":memory"] .b.hl`))
    .toEqual(want);
  // (a solc scene: its storage, no locals, solc's word for it)
  await page.goto("about:blank");
  await open(page, "mid");
  await expect(page.locator(`${D} li[data-path="totalScore"] .val`))
    .toHaveText("140");
  await expect(page.locator(`${D} .novars`)).toHaveText(/no locals/);
});

test("moves: a trace step, a range change, a transaction's ends, another " +
  "transaction; keys; the hash keeps the moment", async ({ page }) => {
  await open(page, "bug-O0", "12:400");
  const moves = page.locator(`${D} .moves`);
  await moves.focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => at(page)).toBe("12:401");
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => at(page)).toBe("12:400");
  const range = async () => (await marked(page)).text;
  const r0 = await range();
  await page.keyboard.press("ArrowDown");
  await expect.poll(range).not.toBe(r0);
  await page.keyboard.press("End");
  await expect.poll(() => at(page)).toBe("12:end");
  await page.keyboard.press("Home");
  await expect.poll(() => at(page)).toBe("12:0");
  await page.locator(`${D} .moves select`).selectOption("3");
  await expect.poll(() => at(page)).toBe("3:0");
  await expect(page).toHaveURL(/at=3:0/);
  await expect(page.locator(`${D} button[data-move="prev"]`))
    .toBeEnabled();
});

test("the debugger opens by its button, and stays open in the hash",
  async ({ page }) => {
    await page.goto("./shell.html#scene=mid");
    await expect(page.locator(".dbgpane")).toHaveCount(0);
    await page.locator("[data-open-debugger]").click();
    await expect(page.locator(`${D} .moves .mat`))
      .toContainText(/after the transaction/);
    await expect(page).toHaveURL(/debug=1/);
    await page.reload();
    await expect(page.locator(".dbgpane")).toBeVisible();
  });

test("a narrow page: Debugger | Scene, one at a time", async ({ page }) => {
  await open(page, "mid", undefined, 390);
  await expect(page.locator(".dbgpane")).toBeVisible();
  await expect(page.locator(".scenepane")).toBeHidden();
  await page.locator('.dswitch button[data-show="scene"]').click();
  await expect(page.locator(".scenepane")).toBeVisible();
  await expect(page.locator(".dbgpane")).toBeHidden();
  // (once its dumps are fitted to the column)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test("pins: pin this moment, unpin, a new scene from here: each the " +
  "scene's file, posted to the dev server", async ({ page }) => {
  const posted: { url: string; body: unknown }[] = [];
  await page.route("**/__scene/*", (r) => {
    posted.push({ url: r.request().url(), body: JSON.parse(
      r.request().postData()!) });
    return r.fulfill({ body: "ok" });
  });
  await open(page, "alice", "12:40");
  await page.locator('[data-pinbar] input[aria-label="Label"]')
    .fill("inside the hit");
  await page.locator("[data-pin-this]").click();
  await expect(page.locator("[data-pin-said]")).toHaveText(/saved/);
  const one = posted[0].body as { id: string; timeline: object[] };
  expect(posted[0].url).toMatch(/__scene\/alice$/);
  expect(one.timeline).toEqual([
    { tx: 11, step: "end", label: "in the middle of the game" },
    { tx: 12, step: 40, label: "inside the hit" },
    { tx: 12, step: "end", label: "after alice's third hit" }]);
  await page.locator('[data-pin="12:end"] button').click();
  await expect.poll(() => posted.length).toBe(2);
  expect((posted[1].body as { timeline: object[] }).timeline)
    .toHaveLength(1);
  await page.locator('[data-pinbar] input[aria-label="Title"]')
    .fill("Alice, mid-hit");
  await page.locator("[data-new-scene]").click();
  await expect.poll(() => posted.length).toBe(3);
  expect(posted[2].url).toMatch(/__scene\/alice-mid-hit$/);
  expect(posted[2].body).toMatchObject({ id: "alice-mid-hit",
    lens: "inspector", timeline: [{ tx: 12, step: 40 }],
    controls: "none" });
});
