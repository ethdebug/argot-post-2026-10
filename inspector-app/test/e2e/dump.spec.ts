// Mirrors bin/run.mjs's dump checks (vanilla d235617): popovers, the
// pointed-at run in both views, gutters, root-slot tint, one line
import { test, expect, type Page } from "@playwright/test";
import { A, B, C } from "../expect";

type W = { select(id: string, view?: { sel?: string | null;
  mode?: string }): Promise<boolean>; results: { done: boolean };
  fitDumps(): void };
const win = (page: Page) => page;
const ready = async (page: Page) => {
  await win(page).goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
};
const select = (page: Page, id: string, sel: string | null,
  mode?: string) => page.evaluate(([i, s, m]) => (window as unknown as W)
  .select(i!, { sel: s, ...(m ? { mode: m } : {}) }), [id, sel, mode]);
const pops = (page: Page) => page.locator(
  "#panel .view:not([hidden]) .pop").allInnerTexts();
const SLOT2 = "0x" + "2".padStart(64, "0");

test("a value's popover: how : what · what the transaction did",
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", null);
    await page.locator('#tree li[data-path="rounds"] > .row').hover();
    await expect.poll(() => pops(page))
      .toEqual(["slot 2 : rounds · total · read, written"]);
    await select(page, "mid", null);
    await page.locator(`#panel .word[data-side="after"][data-slot="${
      SLOT2}"] .b[data-i="31"]`).hover();
    await expect.poll(() => pops(page)).toEqual(["slot 2 : rounds · total"]);
    await expect(page.locator("#panel .cmp, #panel .tray")).toHaveCount(0);
  });

test("a byte pointed at: the same run outlined in both views",
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", null);
    for (const [from, to] of [["before", "after"], ["after", "before"]]) {
      await page.locator(`#mode button[data-mode="${from}"]`).click();
      await page.locator(`#panel .word[data-side="${from}"][data-slot="${
        SLOT2}"] .b[data-i="14"]`).hover();
      const at = await page.evaluate(() => {
        const out: Record<string, number[]> = {};
        for (const c of document.querySelectorAll<HTMLElement>(
          "#panel .b.at:not(.cmp *)")) {
          (out[(c.closest(".word") as HTMLElement).dataset.side!] ??= [])
            .push(+c.dataset.i!);
        }
        return out;
      });
      const want = [8, 9, 10, 11, 12, 13, 14, 15];
      expect(at[from]).toEqual(want);
      expect(at[to]).toEqual(want);
      await expect(page.locator(`#panel .word[data-side="${to}"] .b.hl`))
        .not.toHaveCount(0);
    }
  });

test("popovers: black; a badge only for what is lit; one line, inside "
  + "the dump", async ({ page }) => {
  await ready(page);
  const popOf = (how: string) => page.evaluate((h) => {
    const pop = [...document.querySelectorAll<HTMLElement>(
      "#panel .view:not([hidden]) .pop")].find((p) =>
      p.querySelector(".phow")?.textContent === h);
    if (!pop) return null;
    const kids = [...pop.querySelector(".pwhat")?.children ?? []];
    return { bg: getComputedStyle(pop).backgroundColor,
      text: pop.textContent,
      parts: kids.map((k) => k.classList.contains("pcut") ? "…"
        : k.classList.contains("pbadge") ? `[${k.textContent}]`
          : k.textContent),
      over: pop.querySelector(".pop-how")!.scrollWidth >
        pop.getBoundingClientRect().width + 4,
      out: pop.getBoundingClientRect().right >
        pop.closest(".dump")!.getBoundingClientRect().right - 8,
      tall: pop.getBoundingClientRect().height >
        parseFloat(getComputedStyle(pop).lineHeight) * 1.4 + 4 };
  }, how);
  await select(page, "mid", `${A}.score`);
  await page.mouse.move(1, 1);
  const sc = await popOf("keccak(0x7099…79c8, slot 3)");
  expect(sc!.parts.at(-1)).toBe("[score]");
  const black = await page.evaluate(() =>
    getComputedStyle(document.body).color);
  expect(sc!.bg).toBe(black);
  await select(page, "mid", "players");
  await page.mouse.move(1, 1);
  const pl = await popOf("keccak(0x90f7…b906, slot 3)");
  expect(pl!.parts).toEqual(["[players[0x90f7…b906]]"]);
  for (const wd of [1280, 1440, 1920, 760]) {
    await page.setViewportSize({ width: wd, height: 900 });
    await select(page, "mid", A);
    await page.mouse.move(1, 1);
    await expect.poll(() => popOf("keccak(0x7099…79c8, slot 3)")
      .then((x) => x?.parts[0])).toBe("[lastBlock]");
    const x = (await popOf("keccak(0x7099…79c8, slot 3)"))!;
    expect(x.parts.at(-1), `${wd}`).toBe("[name.length]");
    expect(x.text!.endsWith(", 2 slots"), `${wd}: ${x.text}`).toBe(true);
    expect(x.text).toContain(" / ");
    expect([x.over, x.out, x.tall], `${wd}: ${x.text}`)
      .toEqual([false, false, false]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  // (bob's name's bytes pointed at: `name` a badge, its length plain)
  await select(page, "mid", null);
  await page.locator(
    `#panel .view:not([hidden]) .b[data-owners="${B}.name"]`).first()
    .hover();
  const bn = await page.evaluate(() => [...document.querySelectorAll(
    "#panel .view:not([hidden]) .pop .pname")].map((n) => `${
    n.textContent}${n.classList.contains("pbadge") ? "*" : ""}`).join());
  expect(bn).toMatch(/(^|,)name\*/);
  expect(bn).toMatch(/name\.length(,|$)/);
});

test("a selection inside a mapping tints its root slot's gutter",
  async ({ page }) => {
    await ready(page);
    const r3 = `#panel .view:not([hidden]) .wrow[data-slot="0x${
      "0".repeat(63)}3"]`;
    for (const x of [A, `${B}.plays`]) {
      await select(page, "mid", x);
      await page.mouse.move(1, 1);
      await expect(page.locator(`${r3}.gut`)).toHaveCount(1);
      await expect(page.locator(`${r3} .pop`)).toHaveCount(1);
      await expect(page.locator(`${r3} .b.hl`)).toHaveCount(0);
    }
  });

test("a gutter address outlines its word; window.fitDumps fits the row",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", null);
    await page.locator(`#panel .view:not([hidden]) .wrow[data-slot="${
      SLOT2}"] > .addr`).hover();
    await expect(page.locator(`#panel .view:not([hidden]) .wrow[data-slot="${
      SLOT2}"] .b.at`)).toHaveCount(32);
    expect(await page.evaluate(() => typeof (window as unknown as W)
      .fitDumps)).toBe("function");
    const fits = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(
        "#panel .view:not([hidden]) .rows > .wrow")!;
      const d = row.closest(".dump")!.getBoundingClientRect();
      return row.querySelector(".word")!.getBoundingClientRect().right <=
        d.right + 1;
    });
    expect(fits).toBe(true);
  });

test("hovering and clicking move nothing", async ({ page }) => {
  await ready(page);
  await select(page, "alice", A);
  // (in the page's coordinates: pointing may scroll the window)
  const boxes = () => page.locator(
    "#panel .view:not([hidden]) .wrow:not(.cmp *), #tree .row")
    .evaluateAll((es) => es.map((e) => {
      const r = e.getBoundingClientRect();
      return [r.left + scrollX, r.top + scrollY, r.width, r.height]
        .map(Math.round).join();
    }));
  await page.mouse.move(1, 1);
  // (at rest: the same boxes twice)
  let rest = await boxes();
  await expect.poll(async () => {
    const was = rest;
    rest = await boxes();
    return JSON.stringify(rest) === JSON.stringify(was);
  }).toBe(true);
  await page.locator(`#panel .view:not([hidden]) .b[data-owners="${C}.plays"]`)
    .first().hover();
  await expect.poll(boxes).toEqual(rest);
  await page.locator('#tree li[data-path="total"] > .row').click();
  await expect.poll(boxes).toEqual(rest);
});

test("motd After: its cleared data named as Before; one popover; no tray",
  async ({ page }) => {
    await ready(page);
    for (const m of ["after", "before"]) {
      await select(page, "motd", "motd", m);
      await page.mouse.move(1, 1);
      await expect(page.locator("#panel .tray")).toHaveCount(0);
    }
    await select(page, "motd", "motd", "after");
    await page.mouse.move(1, 1);
    const names = await page.locator(
      '#panel .view[data-side="after"] .wrow[data-name]').evaluateAll((rs) =>
      rs.map((r) => (r as HTMLElement).dataset.name));
    expect(names).toContain("keccak(slot 1)");
    expect(names).toContain("keccak(slot 1) + 1");
    expect(names.filter((n) => n!.startsWith("slot 0x"))).toEqual([]);
    await expect.poll(() => pops(page)).toContain(
      "keccak(slot 1), 2 slots · cleared (written to zero)");
  });
