// Mirrors bin/run.mjs's cards checks (vanilla d235617): the other
// state's picture beside lit runs, the tree's cards, the tray, and
// "show other state"
import { test, expect, type Page } from "@playwright/test";
import { A, B } from "../expect";

type W = { select(id: string, view?: { sel?: string | null;
  mode?: string }): Promise<boolean>; results: { done: boolean } };
const ready = async (page: Page) => {
  await page.goto("./");
  await page.waitForFunction(() => (window as unknown as W).results?.done);
};
const select = (page: Page, id: string, sel: string | null, mode?: string) =>
  page.evaluate(([i, s, m]) => (window as unknown as W).select(i!,
    { sel: s, ...(m ? { mode: m } : {}) }), [id, sel, mode]);
const setMode = (page: Page, m: string) =>
  page.locator(`#mode button[data-mode="${m}"]`).click();
const row = (page: Page, p: string) =>
  page.locator(`#tree li[data-path="${p}"] > .row`);
// (as run.mjs: the card's frame against the row it hangs from)
const cmp = (page: Page) => page.evaluate(() => [...document
  .querySelectorAll<HTMLElement>("#panel .cmp:not(.pinned)")].map((el) => {
  const r = el.closest(".wrow")!.getBoundingClientRect();
  const b = el.querySelector(".cmp-frame")!.getBoundingClientRect();
  const lines = [...el.querySelectorAll(".cmp-photo > .wrow")].map((w) => ({
    bytes: [...w.querySelectorAll<HTMLElement>(".b.hl")]
      .map((c) => +c.dataset.i!),
    text: [...w.querySelectorAll(".b.hl")].map((c) => c.textContent)
      .join("") }));
  return { side: el.closest<HTMLElement>(".view")!.dataset.side,
    label: el.querySelector(".cmp-tag")!.textContent, lines,
    under: b.top >= r.bottom - 0.5, over: b.bottom <= r.top + 0.5 };
}));
const tins = (page: Page) => page.evaluate(() => [...document
  .querySelectorAll("#tree .tcard")].map((c) => {
  const r = c.closest("li")!.querySelector(":scope > .row")!
    .getBoundingClientRect();
  const b = c.getBoundingClientRect();
  return { path: c.closest<HTMLElement>("li")!.dataset.path,
    text: c.textContent, place: b.top >= r.bottom - 0.5 ? "under"
      : b.bottom <= r.top + 0.5 ? "over" : "on" };
}));
const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i);

test("a lit changed run: one card of the other state, by its run",
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", null);
    await page.evaluate(() => window.scrollTo(0, (document.querySelector(
      ".cols") as HTMLElement).offsetTop - 8));
    for (const m of ["before", "after"]) {
      await setMode(page, m);
      await page.mouse.move(1, 1);
      expect(await cmp(page)).toEqual([]);
      const other = m === "before" ? "after" : "before";
      await row(page, `${A}.combo`).hover();
      await expect.poll(() => cmp(page)).toHaveLength(1);
      const [b0] = await cmp(page);
      expect(b0).toMatchObject({ side: m, label: other,
        [m === "before" ? "under" : "over"]: true });
      expect(b0.lines[0]).toEqual({ bytes: range(20, 23),
        text: m === "before" ? "00000003" : "00000002" });
      await row(page, A).hover();
      await expect.poll(async () => (await cmp(page))[0]?.lines
        .map((l) => l.bytes.join())).toEqual([range(0, 31).join()]);
      await expect(page.locator("#panel .tray")).toHaveCount(0);
    }
  });

test("the tree's cards: the other state's value, for what changed",
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", null);
    for (const [m, want, place] of [["before", "after60", "under"],
      ["after", "before30", "over"]]) {
      await setMode(page, m);
      await page.locator("h1").hover();
      expect(await tins(page)).toEqual([]);
      await row(page, `${A}.score`).hover();
      await expect.poll(() => tins(page)).toEqual([{ path: `${A}.score`,
        text: want, place }]);
      await row(page, `${B}.score`).hover();
      await expect.poll(() => tins(page)).toEqual([]);
    }
    for (const p of ["playerList[0]", `${A}.name`, `${B}.score`, "motd"]) {
      for (const m of ["before", "after"]) {
        await select(page, "alice", p, m);
        await page.mouse.move(1, 1);
        await expect(page.locator("#tree .tcard, #panel .cmp"))
          .toHaveCount(0);
      }
    }
  });

test('"show other state" off: no cards; lighting still works',
  async ({ page }) => {
    await ready(page);
    await select(page, "alice", null);
    await page.locator("#insets").uncheck();
    await row(page, `${A}.combo`).hover();
    await expect(page.locator("#panel .b.hl")).not.toHaveCount(0);
    await expect(page.locator("#tree .tcard, #panel .cmp")).toHaveCount(0);
    await page.locator("#insets").check();
    await row(page, `${A}.score`).hover();
    await expect(page.locator("#tree .tcard")).toHaveCount(1);
  });

test("one point: no cards, no tray", async ({ page }) => {
  await ready(page);
  for (const sel of ["players", A, "playerList", "motd", "totalScore"]) {
    await select(page, "mid", sel);
    await page.mouse.move(1, 1);
    await expect(page.locator("#panel .cmp, #panel .tray, #tree .tcard"))
      .toHaveCount(0);
  }
});
