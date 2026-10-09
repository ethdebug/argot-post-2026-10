// The debugger (addendum §3.1, §6) in the shell: a scene's run, every
// trace step a moment; the code panel, everything in scope, a dump of
// every location, linked; the moves; the pins. Expected values from
// test/expect.ts's pauses of alice's third hit (transaction 12), in the
// bug-O0 build's run (the stepper-O0 scene's)
import type { Page } from "@playwright/test";
import fs from "node:fs";
import { test, expect, ready } from "../../page";
import { pick } from "../../pick";
import { PAUSE_STEPS, STEPPER, pauses } from "../../expect";

// (the "mult" pause's two trace steps, either side of `mult = combo`)
const first = { step: PAUSE_STEPS.O0[1], range: pauses[1].range };
const mult = { step: PAUSE_STEPS.O0[2], range: pauses[2].range! };

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

test("the code panel marks the moment's range; a trace " +
  "step with none, the last one, muted; the box keeps its size",
async ({ page }) => {
  await open(page, "stepper-O0", `12:${mult.step}`);
  await expect.poll(() => marked(page))
    .toEqual({ text: mult.range.replace(/\n/g, ""), last: false });
  const box = await page.locator(`${D} .code`).boundingBox();
  expect(first.range).toBeUndefined();
  await page.goto("about:blank");
  await open(page, "stepper-O0", `12:${first.step}`);
  await expect.poll(async () => (await marked(page)).last).toBe(true);
  expect(await page.locator(`${D} .code`).boundingBox()).toEqual(box);
});

test("everything in scope: the storage variables and the locals; a " +
  "local lights its memory bytes: its own and the frame pointer's",
async ({ page }) => {
  const lit = (sel: string) => page.locator(sel).evaluateAll((bs) =>
    bs.map((b) => `${(b.closest(".word") as HTMLElement).dataset.slot} ${
      (b as HTMLElement).dataset.i}`).sort());
  await open(page, "stepper-O0", `12:${mult.step}`);
  const names = (g: string) => page.locator(`${D} li[data-path="${g}"] ` +
    "> ul > li[data-path] > .row .name").allTextContents();
  await expect.poll(() => names("@locals"))
    .toEqual(["points", "combo", "mult"]);
  expect(await names("@storage")).toEqual(["playerList", "motd",
    "totalScore", "totalHits", "players"]);
  // (bugc's composites, by its own templates: alice's record)
  await expect(page.locator(`${D} li[data-path=` +
    '"players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8].name"] .val'))
    .toHaveText('"alice"');
  await page.locator(`${D} li[data-path="points"] > .row`).hover();
  // (points' 8 bytes, and the frame pointer's word it is found from)
  await expect.poll(async () => (await lit(
    `${D} [data-view$=":memory"] .b.hl`)).length).toBe(8 + 32);
  // (a solc scene: its storage, no locals, solc's word for it)
  await page.goto("about:blank");
  await open(page, "mid");
  await expect(page.locator(`${D} li[data-path="totalScore"] .val`))
    .toHaveText("140");
  await expect(page.locator(`${D} .novars`)).toHaveText(/no locals/);
});

// (the one engine path: the panel the sections use, over the variable's
// own pointer against the state at the debugger's moment)
test("a variable selected: how it was found, the sections' walkthrough",
  async ({ page }) => {
  await open(page, "stepper-O0", `12:${mult.step}`);
  const bar = page.locator(`${D} .rbar`);
  const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
  for (const path of [`${A}.score`, "playerList[1]", "combo"]) {
    await pick(page.locator(`${D} li[data-path="${path}"] > .row`));
    await bar.locator('button[data-r="start"]').click();
    await expect(bar).toHaveClass(/replaying/);
    await bar.locator(".rdots .dot").last().click();
    // (found: the value, as the tree has it)
    // (an address in the tree short, its whole value its title)
    const val = await page.locator(`${D} li[data-path="${path}"] > .row ` +
      ".val").evaluate((e) => (e.querySelector("[title]") as HTMLElement |
      null)?.title ?? e.textContent);
    await expect(page.locator(`${D} .rcap`)).toContainText(` = ${val}`);
    await bar.locator('button[data-r="exit"]').click();
    await expect(bar).not.toHaveClass(/replaying/);
  }
});

// (a move mid-walk: the same selection's walkthrough at the new moment,
// at the same step; a test of its own: on CI's WebKit each of the
// walkthroughs above takes some twenty seconds, and the whole overran
// the time bound)
test("a move mid-walkthrough re-targets it, at the same step",
  async ({ page }) => {
  await open(page, "stepper-O0", `12:${mult.step}`);
  const bar = page.locator(`${D} .rbar`);
  await pick(page.locator(`${D} li[data-path="mult"] > .row`));
  await bar.locator('button[data-r="start"]').click();
  await bar.locator('button[data-r="next"]').click();
  const cap = await page.locator(`${D} .rcap`).textContent();
  const count = await bar.locator(".rcount").textContent();
  await page.locator(`${D} .moves`).focus();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => at(page)).toBe(`12:${mult.step + 1}`);
  await expect(bar).toHaveClass(/replaying/);
  await expect(bar.locator(".rcount")).toHaveText(count!);
  await expect(page.locator(`${D} .rcap`)).toHaveText(cap!);
});

// (play()'s copy of the caller's record, a struct local: located after
// _rolledHit() returns, bugc #378)
for (const o of ["O0", "O2"] as const) {
  test(`bug-${o}: player after the roll: its fields, its memory bytes, ` +
    "how it was found", async ({ page }) => {
    await open(page, STEPPER[o], `12:${PAUSE_STEPS[o][0]}`);
    const row = (p: string) => page.locator(`${D} li[data-path="${p}"] > .row`);
    await expect(row("player.name").locator(".val")).toHaveText('"alice"');
    await expect(row("player.plays").locator(".val")).toHaveText("3");
    await pick(row("player.score"));
    await expect(page.locator(`${D} [data-view$=":memory"] .b.hl`))
      .toHaveCount(8);
    await pick(row("player"));
    const bar = page.locator(`${D} .rbar`);
    await bar.locator('button[data-r="start"]').click();
    await bar.locator(".rdots .dot").last().click();
    await expect(page.locator(`${D} .rcap`)).toContainText(
      "`player` holds 7 fields".replace(/`/g, ""));
  });
}

test("moves: a trace step, a range change, a transaction's ends, another " +
  "transaction; keys; the hash keeps the moment", async ({ page }) => {
  await open(page, "stepper-O0", "12:400");
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

// (mute, don't move: the stack's place, and the code's under it, the
// same at every moment of a transaction, its locals and its depth
// whatever)
test("between 660 and 1199px: the stack and the code keep their places " +
  "as the locals and the stack's depth change", async ({ page }) => {
  await open(page, "stepper-O0", "12:400", 1024);
  const tops = () => page.evaluate(() => ["narrow", "side"].map((a) =>
    Math.round(document.querySelector(`.dbgpane [data-area="${a}"]`)!
      .getBoundingClientRect().top)));
  const vars = () => page.locator(`${D} .vars li[data-path]`).count();
  // (once the dumps' font is fitted)
  let t0 = await tops();
  await expect.poll(async () => {
    const t = await tops();
    const same = t.join() === t0.join();
    t0 = t;
    return same;
  }, { intervals: [600] }).toBe(true);
  const seen = new Set<number>();
  await page.locator(`${D} .moves`).focus();
  for (let k = 0; k < 30; k++) {
    // (by range: through the play's functions)
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(50);
    seen.add(await vars());
    expect(await tops()).toEqual(t0);
  }
  // (the locals did change)
  expect(seen.size).toBeGreaterThan(1);
});

// (the same storage at the same moment: the inspector's dump, exactly:
// its font, its rows, its cells, its gutter, its owners' tints, its
// rows' names)
for (const w of [1440, 1024]) {
  test(`${w}px: the storage dump is the inspector's`, async ({ page }) => {
    const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
    const look = (s: string) => page.evaluate((s) => {
      const v = document.querySelector(s)!;
      const rows = [...v.querySelectorAll(".wrow:not(.head)")];
      const b = v.querySelector(".word .b")!;
      const at = (e: Element | null) => e!.getBoundingClientRect();
      // (to the device pixel: Firefox's layout differs below it)
      const r = (x: number) => Math.round(x * devicePixelRatio) /
        devicePixelRatio;
      return { w: r(at(v).width), fs: getComputedStyle(v).fontSize,
        rowH: r(at(rows[0]).height), cell: r(at(b.nextElementSibling).left -
          at(b).left), gutter: r(at(v.querySelector(".addr")).width),
        owned: v.querySelectorAll(".b[data-owners]").length,
        lit: v.querySelectorAll(".b.hl").length,
        names: [...v.querySelectorAll(".addr")].map((a) =>
          a.getAttribute("title") ?? a.textContent).join() };
    }, s);
    await page.setViewportSize({ width: w, height: 1000 });
    await page.goto(`./#ex=mid&sel=${A}`);
    await page.waitForFunction(() =>
      (window as unknown as { results?: { done: boolean } }).results?.done);
    const want = await look("#panel .view:not([hidden])");
    await page.goto("about:blank");
    await open(page, "mid", undefined, w);
    await pick(page.locator(`${D} li[data-path="${A}"] > .row`));
    await expect.poll(() => look(`${D} #dpanel .view`)).toEqual(want);
  });
}

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

test("a row is its location's: storage slot N and the stack's row N "
  + "are not one row; pointing at one lights it alone", async ({ page }) => {
  await open(page, "stepper-O0", `12:${mult.step}`);
  // (a row address both locations show: hover each one's gutter)
  const rows = (loc: string) => page.locator(
    `${D} .view[data-view$=":${loc}"] .wrow[data-slot]`).evaluateAll(
    (rs) => rs.map((r) => (r as HTMLElement).dataset.slot!));
  const views = await page.locator(`${D} .view[data-view]`).evaluateAll(
    (vs) => vs.map((v) => (v as HTMLElement).dataset.view!.split(":")
      .at(-1)!));
  const [a, b] = ["storage", "stack"].map((k) =>
    views.find((v) => v.includes(k))!);
  expect(a && b).toBeTruthy();
  const ra = await rows(a);
  const rb = await rows(b);
  const both = ra.filter((x) => rb.some((y) => BigInt(y) === BigInt(x)));
  expect(both.length).toBeGreaterThan(0);
  const lit = () => page.evaluate((d) => [...document.querySelectorAll<
    HTMLElement>(`${d} .view[data-view]`)].map((v) => [
    v.dataset.view!.split(":").at(-1),
    [...v.querySelectorAll<HTMLElement>(".wrow.on, .wrow:has(.b.at)")]
      .map((r) => r.dataset.slot)]).filter(([, rs]) => rs!.length), D);
  const n = BigInt(both[0]);
  for (const [here, rs] of [[a, ra], [b, rb]] as const) {
    const slot = rs.find((x) => BigInt(x) === n)!;
    await page.locator(`${D} .view[data-view$=":${here}"] ` +
      `.wrow[data-slot="${slot}"] > .addr`).hover();
    await expect.poll(lit).toEqual([[here, [slot]]]);
  }
});
