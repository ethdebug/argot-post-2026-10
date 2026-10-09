// With a selection, a click on what it does not light only ends it (the
// hover waits for the pointer to move); a click on the selection clears
// it (its hover at once); a click on what it lights selects that. The
// cursor says which: default, or pointer.
import type { Page } from "@playwright/test";
import { pick } from "../../pick";
import { A } from "../../expect";
import { slotHex } from "../../../src/engine/hex";
import {
  test, expect, ready, select, row, selected, settle, V,
} from "../../page";

const at = async (page: Page) => {
  await ready(page, { width: 1280 });
  await select(page, "mid", "playerList");
};
const cursor = (page: Page, s: string) => page.locator(s).first()
  .evaluate((e) => getComputedStyle(e).cursor);

test("a click on an unlit row only exits; no hover until the pointer " +
  "moves; then its hover; a second click selects it", async ({ page }) => {
  await at(page);
  const r = (await row(page, "motd").boundingBox())!;
  const [x, y] = [r.x + r.width / 2, r.y + r.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.up();
  await settle(page);
  expect(await selected(page)).toBe(null);
  // (settled: nothing lit, the hover held back)
  expect(await row(page, "motd").getAttribute("class")).not.toContain("hl");
  expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
  // (a nudge under 3px: still none)
  await page.mouse.move(x + 2, y);
  await settle(page);
  expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
  // (a move: motd's hover)
  await page.mouse.move(x + 6, y, { steps: 2 });
  await settle(page);
  expect(await row(page, "motd").getAttribute("class")).toContain("hl");
  expect(await page.locator(`${V} .b.hl`).count()).toBeGreaterThan(0);
  await row(page, "motd").click();
  expect(await selected(page)).toBe("motd");
});

test("a click on the selection itself clears it; its hover at once",
  async ({ page }) => {
    await at(page);
    await row(page, "playerList").click();
    await settle(page);
    expect(await selected(page)).toBe(null);
    expect(await row(page, "playerList").getAttribute("class")).toContain("hl");
    expect(await page.locator(`${V} .b.hl`).count()).toBeGreaterThan(0);
  });

test("Escape clears; no hover until the pointer moves", async ({ page }) => {
  await at(page);
  const r = (await row(page, "motd").boundingBox())!;
  await page.mouse.move(r.x + 20, r.y + r.height / 2);
  // (Escape in the lens: its focus there)
  await row(page, "motd").focus();
  await page.keyboard.press("Escape");
  await settle(page);
  expect(await selected(page)).toBe(null);
  expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
  await page.mouse.move(r.x + 30, r.y + r.height / 2, { steps: 2 });
  await settle(page);
  expect(await page.locator(`${V} .b.hl`).count()).toBeGreaterThan(0);
});

test("a click on a lit child selects it, from the tree or its bytes",
  async ({ page }) => {
    await at(page);
    await row(page, "playerList[0]").click();
    expect(await selected(page)).toBe("playerList[0]");
    await select(page, "mid", "playerList");
    await page.locator(`${V} .b.hl[data-owners="playerList[0]"]`).first()
      .click();
    expect(await selected(page)).toBe("playerList[0]");
  });

test("a click on unlit bytes only exits; no hover until a move",
  async ({ page }) => {
    await at(page);
    await page.locator(`${V} .b[data-owners="totalScore"]`).first().click();
    await settle(page);
    expect(await selected(page)).toBe(null);
    expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
    const b = (await page.locator(`${V} .b[data-owners="totalScore"]`).first()
      .boundingBox())!;
    await page.mouse.move(b.x + 1, b.y + 1, { steps: 2 });
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2,
      { steps: 2 });
    await settle(page);
    expect(await page.locator(`${V} .b.hl[data-owners="totalScore"]`).count())
      .toBeGreaterThan(0);
  });

test("the cursor: default on what a click only exits; pointer on what " +
  "it lights", async ({ page }) => {
  await at(page);
  expect(await cursor(page, '#tree li[data-path="motd"] > .row'))
    .toBe("default");
  expect(await cursor(page, '#tree li[data-path="playerList[0]"] > .row'))
    .toBe("pointer");
  expect(await cursor(page, `${V} .b[data-owners="totalScore"]`))
    .toBe("default");
  expect(await cursor(page, `${V} .b[data-owners="playerList[0]"]`))
    .toBe("pointer");
  // (nothing selected: as before)
  await page.keyboard.press("Escape");
  await select(page, "mid", null);
  expect(await cursor(page, '#tree li[data-path="motd"] > .row'))
    .toBe("pointer");
});

test("from the keyboard: Enter on a byte or a row selects it",
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", null);
    await page.locator(`#panel .view[data-side="after"] ` +
      `.b[data-owners="${A}.plays"][tabindex]`).first().focus();
    await page.keyboard.press("Enter");
    expect(await selected(page)).toBe(`${A}.plays`);
    await row(page, `${A}.score`).focus();
    await page.keyboard.press("Enter");
    expect(await selected(page)).toBe(`${A}.score`);
  });

test("with a selection, pointing elsewhere changes nothing shown",
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", `${A}.combo`);
    const look = () => page.evaluate(() => JSON.stringify([
      document.querySelectorAll("#panel .b.hl:not(.cmp *)").length,
      [...document.querySelectorAll<HTMLElement>("#panel .pop")]
        .map((p) => p.innerText),
      document.querySelectorAll("#panel .cmp").length,
      document.querySelector("#details")!.textContent]));
    await page.mouse.move(1, 1);
    const still = await look();
    // (an unrelated byte; then one of its own)
    for (const [f, i] of [["score", 30], ["combo", 23]] as const) {
      await page.locator(`#panel .word[data-side="after"] ` +
        `.b[data-owners="${A}.${f}"][data-i="${i}"]`).hover();
      await settle(page);
      expect(await look(), f).toBe(still);
    }
  });

test("a click that clears shows the hover under the pointer at once: a "
  + "row, a byte", async ({ page }) => {
  await ready(page);
  await select(page, "mid", null);
  const now = () => page.evaluate(() => ({
    row: document.querySelector('#tree li[data-path="totalScore"] > .row')!
      .classList.contains("hl"),
    bytes: document.querySelectorAll("#panel .view:not([hidden]) .b.hl")
      .length, sel: !!document.querySelector("#tree .row.sel") }));
  const want = { row: true, bytes: 16, sel: false };
  await pick(row(page, "totalScore"));
  await pick(row(page, "totalScore"));
  expect(await now()).toEqual(want);
  const cell = page.locator(`${V} .wrow[data-slot="${slotHex(2n)}"] ` +
    '.b[data-i="31"]');
  await cell.click();
  await cell.click();
  expect(await now()).toEqual(want);
});

test("a composite selected: a click on a grandchild selects its child",
  async ({ page }) => {
    await ready(page);
    const sc = `${V} .b[data-owners="${A}.score"]`;
    const gut = `${V} .wrow:has(.b[data-owners="${A}.score"]) > .addr`;
    const after = async (sel: string | null, click: () => Promise<void>) => {
      await select(page, "mid", sel);
      await click();
      return selected(page);
    };
    expect([
      await after("players", () => pick(row(page, `${A}.score`))),
      await after("players", () => page.locator(sc).first().click()),
      await after("players", () => page.locator(gut).first().click()),
      await after(A, () => pick(row(page, `${A}.score`))),
      await after(null, () => pick(row(page, `${A}.score`))),
    ]).toEqual([A, A, A, `${A}.score`, `${A}.score`]);
  });

test("what the selection consulted is inside it: a click there selects "
  + "it, with a pointer; an anchor's bytes, the variable it anchors",
async ({ page }) => {
  await ready(page, { width: 1280 });
  // (players: its keys in playerList are consulted)
  await select(page, "mid", "players");
  const pl1 = `${V} .b.rel[data-owners="playerList[1]"]`;
  expect(await cursor(page, '#tree li[data-path="playerList[1]"] > .row'))
    .toBe("pointer");
  expect(await cursor(page, pl1)).toBe("pointer");
  await row(page, "playerList[1]").click();
  expect(await selected(page)).toBe("playerList[1]");
  await select(page, "mid", "players");
  await page.locator(pl1).first().click();
  expect(await selected(page)).toBe("playerList[1]");
  // (alice's record: players' slot 3 is its anchor, its bytes owned by
  // none; a click there selects players)
  await select(page, "mid", A);
  const s3 = `${V} .wrow.anchor[data-slot="${slotHex(3n)}"] .b`;
  expect(await cursor(page, s3)).toBe("pointer");
  await page.locator(s3).nth(5).click();
  expect(await selected(page)).toBe("players");
});

test("the variable whose slot a selection consulted is consulted in the "
  + "tree: players for a record, playerList for an item",
async ({ page }) => {
  await ready(page, { width: 1280 });
  for (const [sel, v] of [[A, "players"], [`${A}.score`, "players"],
    ["playerList[0]", "playerList"]]) {
    await select(page, "mid", sel);
    await expect(row(page, v), sel).toHaveClass(/\brel\b/);
    expect(await cursor(page, `#tree li[data-path="${v}"] > .row`))
      .toBe("pointer");
  }
});

test("a field selected: the groups that hold it are consulted in the "
  + "tree, and a click on one selects it", async ({ page }) => {
  await ready(page, { width: 1280 });
  await select(page, "mid", `${A}.bestCombo`);
  for (const v of [A, "players"]) {
    await expect(row(page, v), v).toHaveClass(/\brel\b/);
    expect(await cursor(page, `#tree li[data-path="${v}"] > .row`))
      .toBe("pointer");
  }
  // (the record's own bytes keep what they had: its field lit, the rest
  // not tinted as consulted)
  expect(await page.locator(`${V} .b.rel[data-owners^="${A}."]`).count())
    .toBe(0);
  await row(page, A).click();
  expect(await selected(page)).toBe(A);
});

test("pointing at something consulted: it stands out; the rest of the "
  + "consulted goes plain, the selection's colours step back; restored "
  + "on leaving", async ({ page }) => {
  await ready(page, { width: 1280 });
  await select(page, "mid", A);
  await page.mouse.move(1, 1);
  const look = () => page.evaluate(() => ({
    rel: [...document.querySelectorAll<HTMLElement>("#tree .row.rel")]
      .map((r) => r.parentElement!.dataset.path),
    relBytes: [...new Set([...document.querySelectorAll<HTMLElement>(
      "#panel .view:not([hidden]) .b.rel")].map((b) => b.dataset.owners))],
    mutedRows: document.querySelectorAll("#tree .row.hl.muted").length,
    mutedBytes: document.querySelectorAll(
      "#panel .view:not([hidden]) .b.hl.muted").length }));
  const rest = await look();
  expect(rest.rel).toEqual(expect.arrayContaining(["playerList[0]",
    "players"]));
  expect(rest.mutedRows).toBe(0);
  await row(page, "playerList[0]").hover();
  await settle(page);
  const on = await look();
  expect(on.rel).toEqual(["playerList[0]"]);
  expect(on.relBytes).toEqual(["playerList[0]"]);
  // (the record's fields, in their colours: muted)
  expect(on.mutedRows).toBeGreaterThan(0);
  expect(on.mutedBytes).toBeGreaterThan(0);
  // (no move: the tint only)
  await page.mouse.move(1, 1);
  await settle(page);
  expect(await look()).toEqual(rest);
});
