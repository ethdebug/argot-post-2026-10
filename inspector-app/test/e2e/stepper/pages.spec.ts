// The stepper's pages (lenses/stepper.tsx, ui/Dump.tsx): a page needed
// (the selection lights bytes in it) opens on a new moment or
// selection, to the top of the pages, the needed ones keeping their
// order; none shuts then; one shuts only when the open ones no longer
// fit, one not needed first. A tab opens or shuts its page by hand; the
// figure's height never changes; Reset starts over.
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const open = (page: Page) => page.evaluate(() => Object.fromEntries([
  ...document.querySelectorAll<HTMLElement>(
    ".view[data-location][data-open]")].map((v) =>
    [v.dataset.location, v.dataset.open === "true"])));
const height = (page: Page) => page.locator("#embed").evaluate((e) =>
  Math.ceil(e.getBoundingClientRect().height));
const tab = (page: Page, loc: string) => page.locator(
  `.view[data-location=${loc}] .ptab`);
// (the pages over the stack, top to bottom, as laid out: not as a move
// draws them)
const order = (page: Page) => page.evaluate(() => [...document
  .querySelectorAll<HTMLElement>(".pages .view[data-location][data-open]")].sort((a, b) =>
  Number(a.style.order) - Number(b.style.order)).map((v) =>
  v.dataset.location));
const rest = async (page: Page) => {
  await expect(page.locator(".lens")).not.toHaveAttribute("data-playing",
    "", { timeout: 10_000 });
  await page.waitForTimeout(600);
};
const pick = async (page: Page, path: string) => {
  await page.locator(".mbar").focus();
  await page.keyboard.press("Escape");
  await page.locator(`li[data-path="${path}"] > .row`).click();
  await expect(page.locator(`li[data-path="${path}"] > .row.sel`))
    .toBeVisible();
  await page.waitForTimeout(600);
};
const go = async (page: Page, width: number) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("./embed.html#scene=optimized-locals");
  // (carol's join, her locals selected: the stack holds `len`, the call
  // and memory `name`; storage nothing of them)
  await expect.poll(() => open(page)).toEqual({ stack: true,
    calldata: true, memory: true, storage: false });
  await page.waitForTimeout(800);
};

for (const width of [1216, 390]) {
  test(`optimized-locals at ${width}px: pages open on need, shut for ` +
    "room, one height", async ({ page }) => {
    await go(page, width);
    const h = await height(page);
    expect(await order(page)).toEqual(["calldata", "memory", "storage"]);
    // (`len` alone: its page open; the others stay, there is room)
    await pick(page, "len");
    expect(await open(page)).toEqual({ stack: true, calldata: true,
      memory: true, storage: false });
    // (memory shut by hand; `name` selected: it opens again, calldata
    // stays; on a phone's room, the stack, not needed now, may shut)
    await tab(page, "memory").click();
    await expect(tab(page, "memory")).toHaveAttribute("aria-expanded",
      "false");
    await pick(page, "name");
    await expect.poll(() => open(page)).toMatchObject({ calldata: true,
      memory: true, storage: false });
    // (storage selected: its page opens, to the top; calldata and memory,
    // not needed, at their least, or shut for its room)
    await pick(page, "@storage");
    await expect.poll(() => open(page)).toMatchObject({ storage: true });
    expect((await order(page))[0]).toBe("storage");
    expect(await height(page)).toBe(h);
    // (Reset: as at first)
    await page.locator(".reset").click();
    await expect.poll(() => open(page)).toEqual({ stack: true,
      calldata: true, memory: true, storage: false });
    expect(await order(page)).toEqual(["calldata", "memory", "storage"]);
    expect(await height(page)).toBe(h);
  });
}

test("optimized-locals: moves keep the needed pages' order; none shut " +
  "while there is room", async ({ page }) => {
  await go(page, 1216);
  const h = await height(page);
  // (on to the join's end and back: storage needed there, at the top;
  // back, calldata and memory needed again, over it, in their order)
  await page.locator('.mbar [data-t="next"]').click();
  await rest(page);
  expect((await order(page))[0]).toBe("storage");
  await page.locator('.mbar [data-t="prev"]').click();
  await rest(page);
  const o = await order(page);
  expect(o.indexOf("calldata")).toBeLessThan(o.indexOf("memory"));
  expect(await open(page)).toMatchObject({ calldata: true, memory: true });
  // (alice's moments: memory's alone; the others, still open, stay as
  // long as there is room)
  await page.locator('.mbar [role=tab][data-tx="12"]').click();
  await rest(page);
  expect((await order(page))[0]).toBe("memory");
  const before = await open(page);
  await page.locator('.mbar [data-t="next"]').click();
  await rest(page);
  await page.locator('.mbar [data-t="prev"]').click();
  await rest(page);
  expect(await open(page)).toEqual(before);
  expect(await height(page)).toBe(h);
});

// A page's rows are the related view's alone: `storage` selected at the
// first moment, the storage page open with its slots
test("optimized-locals: storage selected shows its slots", async ({
  page }) => {
  await go(page, 1216);
  await pick(page, "@storage");
  await expect.poll(async () => (await open(page)).storage).toBe(true);
  const slots = page.locator(".view[data-location=storage] .wrow[data-slot]");
  await expect.poll(() => slots.count()).toBeGreaterThan(5);
  expect(await page.locator(".view[data-location=storage] .b.hl").count())
    .toBeGreaterThan(0);
});

// The related view off: a long string's own bytes all lit, its length
// slot and each of its data slots (carol's name at her join's end)
test("optimized-locals: a long string lights its length and data slots",
  async ({ page }) => {
    await go(page, 1216);
    await page.locator('.mbar [data-t="next"]').click();
    await rest(page);
    await expect(page.locator(
      'li[data-path="players[0x90f7…b906].name"] > .row.sel, ' +
      ".sidecol .row.sel")).not.toHaveCount(0);
    const on = await page.locator(".view[data-location=storage] .wrow.on")
      .evaluateAll((rs) => rs.map((r) => (r as HTMLElement).dataset.slot));
    expect(on.length).toBe(3);
    expect(on.some((s) => s!.endsWith("6988"))).toBe(true);
    for (const s of on) {
      await expect(page.locator(`.view[data-location=storage] ` +
        `.wrow[data-slot="${s}"] .b.hl`).first()).toBeAttached();
    }
  });

// "How it was found": the related view on while it is open, the pages
// its rows, a page with none of them shut (the stack too), unless no
// page but the stack's has any; nothing moves through its steps; closed,
// every page as before it: folds, heights and scrolls
const walkState = (page: import("@playwright/test").Page) =>
  page.evaluate(() => [...document.querySelectorAll<HTMLElement>(
    ".view[data-location]")].map((v) => [v.dataset.location,
    v.dataset.open, v.querySelector<HTMLElement>(".pagebox")?.style.height,
    v.dataset.open === "true" ? v.querySelector(".rows")?.scrollTop : "-"]
    .join(":")));
const walkThrough = async (page: import("@playwright/test").Page,
  steps: (s: string[]) => Promise<void> | void) => {
  const before = await walkState(page);
  await page.locator('button[data-r="start"]').click();
  await page.waitForTimeout(1000);
  const walking = await walkState(page);
  await steps(walking);
  const next = page.locator('.rbar:not(.mbar) button[data-r="next"]')
    .first();
  while (await next.isEnabled()) {
    await next.click();
    await page.waitForTimeout(400);
    expect(await walkState(page)).toEqual(walking);
  }
  await page.locator('button[data-r="exit"]').click();
  await expect.poll(() => walkState(page), { timeout: 5000 })
    .toEqual(before);
};
const choose = async (page: import("@playwright/test").Page, path: string) => {
  const row = page.locator(`li[data-path="@locals"] li[data-path="${path}"]` +
    " > .row");
  if (!await row.evaluate((r) => r.classList.contains("sel"))) {
    await row.click();
  }
  await page.waitForTimeout(1200);
};
for (const width of [1216, 390]) {
  test(`optimized-locals at ${width}px: How it was found shows the ` +
    "related rows and restores all as it closes", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./embed.html#scene=optimized-locals");
    await page.locator(".lens[data-settled]").waitFor();
    await choose(page, "name");
    await walkThrough(page, async () => {
      await expect(page.locator('.view[data-location="stack"]'))
        .toHaveAttribute("data-open", "false");
      await expect(page.locator('.view[data-location="memory"] .wrow'))
        .not.toHaveCount(56);
    });
  });
}
test("optimized-locals: How it was found for gained: the word it is in " +
  "and the one read to find it", async ({ page }) => {
  await page.setViewportSize({ width: 1216, height: 900 });
  await page.goto("./embed.html#scene=optimized-locals");
  await page.locator(".lens[data-settled]").waitFor();
  await page.locator('.mbar [role=tab][data-tx="12"]').click();
  for (let k = 0; k < 4; k++) {
    await page.locator('.mbar [data-t="next"]').click();
    await expect(page.locator(".mbar")).toContainText(`${k + 2} / 5`,
      { timeout: 10_000 });
  }
  await choose(page, "gained");
  await walkThrough(page, async () => {
    const M = '.view[data-location="memory"]';
    for (const w of ["0x0080", "0x0680"]) {
      await expect(page.locator(`${M} .wrow[data-slot="${w}"]`))
        .toBeInViewport();
    }
  });
});
test("optimized-locals: How it was found for a stack value: the stack, " +
  "the pages as they were", async ({ page }) => {
  await page.setViewportSize({ width: 1216, height: 900 });
  await page.goto("./embed.html#scene=optimized-locals");
  await page.locator(".lens[data-settled]").waitFor();
  await choose(page, "len");
  const before = await open(page);
  await walkThrough(page, async () => {
    expect(await open(page)).toEqual(before);
    expect(before.stack).toBe(true);
  });
});
