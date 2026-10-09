import { pick } from "../../pick";
import type { Page } from "@playwright/test";
import { test, expect, ready, select, row, selected, V } from "../../page";
import { A, C } from "../../expect";
import { slotHex } from "../../../src/engine/hex";

const lit = (page: Page) => page.locator(
  "#panel .view:not([hidden]) .b.hl:not(.cmp *)").evaluateAll((bs) =>
  bs.map((b) => `${(b.closest(".word") as HTMLElement).dataset.slot!
    .slice(-2)}:${(b as HTMLElement).dataset.i}`));

test("totalScore's row lights bytes 16-31 of slot 2", async ({ page }) => {
  await page.goto("./shell.html#lens=inspector");
  await pick(page.locator('#tree li[data-path="totalScore"] > .row'));
  expect(await lit(page)).toEqual(Array.from({ length: 16 },
    (_, i) => `02:${16 + i}`));
  await expect(page.locator('#tree li[data-path="totalScore"] > .row'))
    .toHaveAttribute("aria-pressed", "true");
});

test("byte 31 of slot 2 selects totalScore", async ({ page }) => {
  await page.goto("./shell.html#lens=inspector");
  await pick(page.locator(
    '.view:not([hidden]) .b[data-owners="totalScore"][data-i="31"]'));
  await expect(page.locator("#tree .row.sel")).toHaveText(/totalScore/);
  expect(await lit(page)).toEqual(Array.from({ length: 16 },
    (_, i) => `02:${16 + i}`));
});

test("hovering totalScore's row lights its bytes; the rest mutes",
  async ({ page }) => {
    await page.goto("./shell.html#lens=inspector");
    // (the scene selects alice's record; a click on it clears)
    await page.locator("#tree .row.sel").click();
    await expect(page.locator("#tree .row.sel")).toHaveCount(0);
    await page.locator('#tree li[data-path="totalScore"] > .row').hover();
    expect(await lit(page)).toHaveLength(16);
    await expect(page.locator("#panel")).toHaveClass(/\bactive\b/);
    await expect(page.locator('#tree li[data-path="totalHits"] > .row'))
      .not.toHaveClass(/\bhl\b/);
  });

test("hover, selection and clearing move nothing", async ({ page }) => {
  await page.goto("./shell.html#lens=inspector");
  await page.locator(
    '.view:not([hidden]) .b[data-owners="totalScore"]').first().waitFor();
  const boxes = () => page.locator(
    "#panel .wrow, #panel .b, #tree .row").evaluateAll((es) =>
    es.map((e) => JSON.stringify(e.getBoundingClientRect())));
  const rest = await boxes();
  await page.locator(
    '.view:not([hidden]) .b[data-owners="totalHits"]').first().hover();
  expect(await boxes()).toEqual(rest);
  await page.locator('#tree li[data-path="totalScore"] > .row').click();
  expect(await boxes()).toEqual(rest);
  await page.locator('#tree li[data-path="totalScore"] > .row').click();
  expect(await boxes()).toEqual(rest);
});

// (each lit byte, by its view's side and its word's slot)
const litBySide = (page: Page) => page.evaluate(() => {
  const out: Record<string, number[]> = {};
  for (const c of document.querySelectorAll<HTMLElement>(
    "#panel .b.hl:not(.cmp *)")) {
    const w = c.closest<HTMLElement>(".word")!;
    (out[`${w.dataset.side} ${w.dataset.slot}`] ??= []).push(+c.dataset.i!);
  }
  return out;
});
const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("a packed field's row lights its bytes, in both views",
  async ({ page }) => {
  await ready(page);
  await select(page, "alice", null);
  // (Player packs its counters into one word, from the low end)
  for (const [f, a, b] of [["score", 24, 31], ["combo", 20, 23],
    ["hits", 8, 11], ["lastBlock", 0, 7]] as const) {
    await row(page, `${A}.${f}`).hover();
    const lit = await litBySide(page);
    expect(Object.keys(lit).map((k) => k.split(" ")[0]).sort(), f)
      .toEqual(["after", "before"]);
    for (const bytes of Object.values(lit)) expect(bytes, f)
      .toEqual(range(a, b));
    await expect(row(page, `${A}.${f}`)).toHaveClass(/\bhl\b/);
  }
});

test("while a value is lit, every other byte and tree row steps back",
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", null);
    await row(page, "totalHits").hover();
    await expect.poll(() => page.evaluate(() => {
      const op = (e: Element) => +getComputedStyle(e).opacity;
      const bytes = [...document.querySelectorAll(
        "#panel .b[data-i]:not(.cmp *)")];
      const rows = [...document.querySelectorAll("#tree .row")];
      const hl = (e: Element) => e.classList.contains("hl");
      return { lit: bytes.filter(hl).every((c) => op(c) === 1),
        rest: bytes.filter((c) => !hl(c) && !c.classList.contains("at"))
          .every((c) => op(c) < 0.5),
        rows: rows.filter((r) => !hl(r)).every((r) => op(r) < 0.6) &&
          rows.some((r) => hl(r) && op(r) === 1) };
    })).toEqual({ lit: true, rest: true, rows: true });
  });

// (each byte's lines: a border, an outline, or caps)
const lines = (page: Page) => page.evaluate((v) => [...document
  .querySelectorAll(`${v} .b`)].filter((b) => {
  const cs = [getComputedStyle(b), getComputedStyle(b, "::after")];
  return cs.some((c) => ["Top", "Right", "Bottom", "Left"].some((k) =>
    parseFloat(c.getPropertyValue(`border-${k.toLowerCase()}-width`)) > 0 &&
    c.getPropertyValue(`border-${k.toLowerCase()}-style`) !== "none") ||
    (c.outlineStyle !== "none" && parseFloat(c.outlineWidth) > 0)) ||
    (b.classList.contains("hl") && cs[0].boxShadow !== "none");
}).length, V);

test("a hover is a plain fill: no line on any byte; caps only on the "
  + "selection", async ({ page }) => {
  await ready(page);
  await select(page, "mid", null);
  for (const p of ["totalScore", "playerList[0]", `${C}.plays`, "motd"]) {
    await row(page, p).hover();
    expect(await lines(page), p).toBe(0);
  }
  const two = `${V} .wrow[data-slot="${slotHex(2n)}"]`;
  await page.locator(`${two} .b[data-i="20"]`).hover();
  expect(await lines(page), "a byte").toBe(0);
  await page.locator(`${two} .addr`).hover();
  expect(await lines(page), "an address").toBe(0);
  // (selected: its bytes capped)
  await pick(row(page, "playerList[0]"));
  await page.mouse.move(1, 1);
  const capped = await page.evaluate((v) => [...document.querySelectorAll(
    `${v} .b.hl`)].map((b) => getComputedStyle(b).boxShadow !== "none"), V);
  expect(capped.length).toBeGreaterThan(0);
  expect(capped.every(Boolean)).toBe(true);
});

test("players' own slot, 3, links to players both ways", async ({ page }) => {
  await ready(page);
  await select(page, "mid", null);
  const r3 = `${V} .wrow[data-slot="${slotHex(3n)}"]`;
  for (const at of [`${r3} .b[data-i="10"]`, `${r3} > .addr`]) {
    await page.locator(at).hover();
    await expect(row(page, "players"), at).toHaveClass(/\bhl\b/);
  }
  await row(page, "players").hover();
  await expect(page.locator(`${r3}.gut`)).toHaveCount(1);
  await pick(page.locator(`${r3} .b[data-i="10"]`));
  expect(await selected(page)).toBe("players");
});

test("an item's row lights its slot of the list", async ({ page }) => {
  await ready(page);
  await select(page, "mid", null);
  await row(page, "playerList[2]").hover();
  expect(await page.locator(`${V} .wrow:has(.b.hl)`).evaluateAll((rs) =>
    rs.map((r) => (r as HTMLElement).dataset.name)))
    .toEqual(["keccak(slot 0) + 2"]);
});

// (the tree's lit rows: muted, and at full strength; the dump's lit
// bytes' owners at full strength, and how many are muted)
const muting = (page: Page) => page.evaluate((v) => ({
  muted: document.querySelectorAll("#tree .row.hl.muted").length,
  vivid: [...document.querySelectorAll("#tree .row.hl:not(.muted)")]
    .map((r) => (r.parentElement as HTMLElement).dataset.path),
  bytes: [...new Set([...document.querySelectorAll<HTMLElement>(
    `${v} .b.hl:not(.muted)`)].map((c) => c.dataset.owners))],
  mutedBytes: document.querySelectorAll(`${v} .b.hl.muted`).length }), V);

test("a record selected: pointing at a member mutes the others; a leaf "
  + "selected mutes nothing", async ({ page }) => {
  await ready(page);
  await select(page, "mid", A);
  const combo = row(page, `${A}.combo`);
  const byte = page.locator(`${V} .b[data-owners="${A}.combo"][data-i="22"]`);
  for (const [how, act] of [["row", () => combo.hover()],
    ["byte", () => byte.hover()],
    ["focus", async () => {
      await page.mouse.move(1, 1);
      await combo.focus();
    }]] as const) {
    await act();
    const m = await muting(page);
    // (the selected record's own row keeps its colour)
    expect(m.vivid, how).toEqual([A, `${A}.combo`]);
    expect(m.muted, how).toBe(6);
    expect(m.bytes, how).toEqual([`${A}.combo`]);
    expect(m.mutedBytes, how).toBeGreaterThan(0);
  }
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.mouse.move(1, 1);
  expect((await muting(page)).muted).toBe(0);
  await select(page, "mid", `${A}.combo`);
  await byte.hover();
  expect((await muting(page)).mutedBytes).toBe(0);
});

test("the tree names a record by its key alone", async ({ page }) => {
  await ready(page);
  await select(page, "mid", "players");
  expect(await page.locator("#tree").innerText())
    .not.toMatch(/\((alice|bob|carol)\)/);
});
