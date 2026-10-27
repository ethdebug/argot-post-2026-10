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

// (pitfall-nesting, its related view: alice's score selected, her
// record's other fields shown, unlit; totalScore's slot shown, unlit)
const at = async (page: Page) => {
  await ready(page, { width: 1280 });
  await select(page, `${A}.score`);
};
const cursor = (page: Page, s: string) => page.locator(s).first()
  .evaluate((e) => getComputedStyle(e).cursor);
const COMBO = `${A}.combo`;
// (selected from none, as a reader does, the pointer then away: what a
// selection consulted shows at rest only)
const fresh = async (page: Page, sel: string | null) => {
  await select(page, null);
  if (sel !== null) await select(page, sel);
  await page.mouse.move(1, 1);
};
// (the first of what `sel` finds that a click at its middle reaches,
// once one does: in the related view, a popover under a row may cover a
// byte, and the rows move into place after a selection)
const reachable = async (page: Page, sel: string) => {
  const at = () => page.locator(sel).evaluateAll((es) => es.findIndex((e) => {
    const r = e.getBoundingClientRect();
    return e.contains(document.elementFromPoint(r.x + r.width / 2,
      r.y + r.height / 2));
  }));
  await expect.poll(at).toBeGreaterThanOrEqual(0);
  return page.locator(sel).nth(await at());
};

test("a click on the selection itself clears it; its hover at once",
  async ({ page }) => {
    await at(page);
    await row(page, `${A}.score`).click();
    await settle(page);
    expect(await selected(page)).toBe(null);
    // (every value shown now: the hover of the row under the pointer)
    expect(await page.locator("#tree .row.hl").count()).toBeGreaterThan(0);
    expect(await page.locator(`${V} .b.hl`).count()).toBeGreaterThan(0);
  });

test("Escape clears; no hover until the pointer moves", async ({ page }) => {
  await at(page);
  const r = (await row(page, COMBO).boundingBox())!;
  await page.mouse.move(r.x + 20, r.y + r.height / 2);
  // (Escape in the lens: its focus there)
  await row(page, COMBO).focus();
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
    await ready(page, { width: 1280 });
    await row(page, `${A}.score`).click();
    expect(await selected(page)).toBe(`${A}.score`);
    await select(page, A);
    await page.locator(`${V} .b.hl[data-owners="${A}.score"]`).first()
      .click();
    expect(await selected(page)).toBe(`${A}.score`);
  });

test("a click on unlit bytes only exits; no hover until a move",
  async ({ page }) => {
    await at(page);
    const b = (await page.locator(`${V} .b[data-owners="totalScore"]`).first()
      .boundingBox())!;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await settle(page);
    expect(await selected(page)).toBe(null);
    expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
    // (a nudge under 3px: still none)
    await page.mouse.move(b.x + b.width / 2 + 2, b.y + b.height / 2);
    await settle(page);
    expect(await page.locator(`${V} .b.hl`).count()).toBe(0);
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
  expect(await cursor(page, `#tree li[data-path="${COMBO}"] > .row`))
    .toBe("default");
  expect(await cursor(page, `${V} .b[data-owners="totalScore"]`))
    .toBe("default");
  await select(page, A);
  expect(await cursor(page, `#tree li[data-path="${COMBO}"] > .row`))
    .toBe("pointer");
  expect(await cursor(page, `${V} .b[data-owners="${COMBO}"]`))
    .toBe("pointer");
  // (nothing selected: as before)
  await select(page, null);
  expect(await cursor(page, '#tree li[data-path="motd"] > .row'))
    .toBe("pointer");
});

test("from the keyboard: Enter on a byte or a row selects it",
  async ({ page }) => {
    await ready(page);
    await select(page, null);
    await page.locator(`#panel .view[data-side=after] ` +
      `.b[data-owners="${A}.plays"][tabindex]`).first().focus();
    await page.keyboard.press("Enter");
    expect(await selected(page)).toBe(`${A}.plays`);
    await row(page, `${A}.score`).focus();
    await page.keyboard.press("Enter");
    expect(await selected(page)).toBe(`${A}.score`);
  });

test("with a selection, pointing elsewhere keeps what it lights; what " +
  "it consulted shows at rest only", async ({ page }) => {
    await ready(page);
    await select(page, `${A}.combo`);
    // (its own: the lit bytes, its own popover)
    const look = () => page.evaluate(() => JSON.stringify([
      document.querySelectorAll("#panel .b.hl:not(.cmp *)").length,
      [...document.querySelectorAll<HTMLElement>("#panel .pop:not(.kept)")]
        .map((p) => p.innerText),
      ]));
    const consulted = () => page.locator("#panel .pop.kept.related").count();
    await page.mouse.move(1, 1);
    const still = await look();
    expect(await consulted()).toBeGreaterThan(0);
    // (an unrelated byte; then one of its own)
    for (const [f, i] of [["score", 30], ["combo", 23]] as const) {
      await page.locator(`#panel .word[data-side=after] ` +
        `.b[data-owners="${A}.${f}"][data-i="${i}"]`).hover();
      await settle(page);
      expect(await look(), f).toBe(still);
      expect(await consulted(), f).toBe(0);
    }
  });

test("a click that clears shows the hover under the pointer at once: a "
  + "row, a byte", async ({ page }) => {
  await ready(page);
  await select(page, null);
  const now = () => page.evaluate(() => ({
    row: !!document.querySelector("#tree .row.hl"),
    bytes: !!document.querySelector("#panel .view[data-side=after] .b.hl"),
    sel: !!document.querySelector("#tree .row.sel") }));
  // (every value shown once it clears: the row under the pointer, its
  // bytes lit)
  const want = { row: true, bytes: true, sel: false };
  await pick(row(page, "totalScore"));
  await pick(row(page, "totalScore"));
  expect(await now()).toEqual(want);
  const cell = page.locator(`${V} .wrow[data-slot="${slotHex(2n)}"] ` +
    '.b[data-i="31"]');
  await cell.click();
  await cell.click();
  expect(await now()).toEqual(want);
});

test("a record selected, or nothing: a click on a field's row selects it",
  async ({ page }) => {
    await ready(page, { width: 1280, height: 1600 });
    const after = async (sel: string | null, click: () => Promise<void>) => {
      await fresh(page, sel);
      await click();
      return selected(page);
    };
    expect([
      await after(A, () => pick(row(page, `${A}.score`))),
      await after(null, () => pick(row(page, `${A}.score`))),
    ]).toEqual([`${A}.score`, `${A}.score`]);
  });

test("what the selection consulted is inside it: a click there selects "
  + "it, with a pointer; an anchor's bytes, the variable it anchors",
async ({ page }) => {
  await ready(page, { width: 1280, height: 1600 });
  // (players: its keys in playerList are consulted)
  await fresh(page, "players");
  const pl1 = `${V} .b.rel[data-owners="playerList[1]"]`;
  expect(await cursor(page, '#tree li[data-path="playerList[1]"] > .row'))
    .toBe("pointer");
  expect(await cursor(page, pl1)).toBe("pointer");
  await row(page, "playerList[1]").click();
  expect(await selected(page)).toBe("playerList[1]");
  await fresh(page, "players");
  await (await reachable(page, pl1)).click();
  expect(await selected(page)).toBe("playerList[1]");
  // (alice's record: players' slot 3 is its anchor, its bytes owned by
  // none; a click there selects players)
  await fresh(page, A);
  const s3 = `${V} .wrow.anchor[data-slot="${slotHex(3n)}"] .b`;
  expect(await cursor(page, s3)).toBe("pointer");
  await (await reachable(page, s3)).click();
  expect(await selected(page)).toBe("players");
});

test("the variable whose slot a selection consulted is consulted in the "
  + "tree: players for a record, playerList for an item",
async ({ page }) => {
  await ready(page, { width: 1280 });
  for (const [sel, v] of [[A, "players"], [`${A}.score`, "players"],
    ["playerList[0]", "playerList"]]) {
    await select(page, sel);
    await expect(row(page, v), sel).toHaveClass(/\brel\b/);
    expect(await cursor(page, `#tree li[data-path="${v}"] > .row`))
      .toBe("pointer");
  }
});

test("a field selected: the groups that hold it are consulted in the "
  + "tree, and a click on one selects it", async ({ page }) => {
  await ready(page, { width: 1280 });
  await select(page, `${A}.bestCombo`);
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
  await select(page, A);
  await page.mouse.move(1, 1);
  const look = () => page.evaluate(() => ({
    rel: [...document.querySelectorAll<HTMLElement>("#tree .row.rel")]
      .map((r) => r.parentElement!.dataset.path),
    relBytes: [...new Set([...document.querySelectorAll<HTMLElement>(
      "#panel .view[data-side=after] .b.rel")].map((b) => b.dataset.owners))],
    mutedRows: document.querySelectorAll("#tree .row.hl.muted").length,
    mutedBytes: document.querySelectorAll(
      "#panel .view[data-side=after] .b.hl.muted").length }));
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
