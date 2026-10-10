// The real debugger (scene real-debugger): soldb itself, in a worker,
// on Solidity and on Fe; it loads on first view, steps a source range
// at a time, and its box holds its height as it steps and as the
// language changes
import type { Page } from "@playwright/test";
import { test, expect } from "../../page";

const F = "[data-figure=real-debugger]";
// (soldb's load: its WebAssembly and the transaction's trace)
const LOAD = { timeout: 90_000 };
const loaded = (page: Page, lang: string) => expect(page.locator(
  `${F}[data-lang="${lang}"][data-loaded]`)).toHaveCount(1, LOAD);
const step = (page: Page) => page.locator(`${F} .mat`)
  .getAttribute("data-step");
const height = (page: Page) => page.locator(F).evaluate((e) =>
  Math.round(e.getBoundingClientRect().height));
// (the lit range: its text, and where it is)
const lit = (page: Page) => page.locator(`${F} .codesrc`).evaluate((p) => {
  const ms = [...p.querySelectorAll("mark.rng")];
  const r = ms[0]?.getBoundingClientRect(), b = p.getBoundingClientRect();
  return { text: ms.map((m) => m.textContent).join(""),
    at: r ? `${Math.round(r.top - b.top + p.scrollTop)}:${Math.round(
      r.left - b.left + p.scrollLeft)}` : "",
    file: p.closest(".code")?.querySelector(".srcfile")?.textContent };
});

test("soldb steps Arcade's play() a source range at a time, in Solidity " +
  "and in Fe, the box holding its height", { tag: "@slow" },
async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("./embed.html#scene=real-debugger");
  // it names the debugger, and loads in the figure: soldb's progress in
  // the code panel, the box at its size from the start
  await expect(page.locator(`${F} .shead`)).toContainText(
    "soldb · Walnut's debugger");
  await expect(page.locator(`${F} .shead .handmade`)).toHaveText(
    "running in this page, from ethdebug data alone");
  await expect(page.locator(`${F}[data-ready]`)).toHaveCount(1);
  const h = await height(page);
  await loaded(page, "sol");
  expect(await height(page)).toBe(h);
  // it opens inside play(), on a statement, where soldb knows the state
  // it can: `totalHits += 1`, totalScore 170 and totalHits 7 read
  await expect(page.locator(`${F} .codehead .srcfile`))
    .toHaveText("Arcade.sol");
  await expect.poll(async () => (await lit(page)).text)
    .toBe("totalHits += 1");
  const val = (p: string) => page.locator(
    `${F} .sstate li[data-path="${p}"] .val`);
  await expect(val("totalScore")).toHaveText("170");
  await expect(val("totalHits")).toHaveText("7");
  // (what soldb cannot give: its words shortened in the row, whole in
  // the row's popover, the column's width)
  await expect(val("motd")).toHaveText("unknown: not read yet");
  const row = page.locator(`${F} .sstate li[data-path="playerList"]`);
  await row.locator(".row").hover();
  const pop = row.locator(".sfull");
  await expect(pop).toBeVisible();
  await expect(pop).toContainText(
    "<unknown: slot 0x0 has not been read or written yet>");
  const [pw, cw] = await Promise.all([pop, page.locator(`${F} .sstate`)]
    .map((l) => l.evaluate((e) => Math.round(e.getBoundingClientRect()
      .width))));
  expect(pw).toBe(cw);
  // each move: another range (no step of compiler-generated code)
  const moves = async (how: string, k: number) => {
    for (let n = 0; n < k; n++) {
      const was = await lit(page);
      await page.locator(`${F} [data-move="${how}"]`).click();
      await expect.poll(async () => {
        const now = await lit(page);
        return now.text !== "" && (now.at !== was.at ||
          now.text !== was.text);
      }).toBe(true);
      await expect(page.locator(`${F} .codesrc mark.rng.last`))
        .toHaveCount(0);
    }
  };
  const s0 = Number(await step(page));
  await moves("prev", 5);
  expect(Number(await step(page))).toBeLessThan(s0);
  await moves("next", 2);
  // (the keys: the same moves)
  await page.locator(`${F} .code`).click();
  const k0 = await step(page);
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => step(page)).not.toBe(k0);
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => step(page)).toBe(k0);
  expect(await height(page)).toBe(h);
  // Fe: the same panels, soldb's words where its export has nothing,
  // and none of Solidity's rows
  await page.locator(`${F} button[data-lang="fe"]`).click();
  await expect(page.locator(`${F} .sstate li`)).toHaveCount(0);
  await loaded(page, "fe");
  await expect(page.locator(`${F} .codehead .srcfile`))
    .toHaveText("arcade.fe");
  // (at the score's write)
  await expect.poll(async () => (await lit(page)).text)
    .toMatch(/^store\.scores\.set\(/);
  await expect(page.locator(`${F} .sside`))
    .toContainText("Fe's export has none");
  // (no move lands in Fe's library: every one in arcade.fe)
  for (const [how, k] of [["prev", 6], ["next", 8]] as const) {
    await moves(how, k);
    expect((await lit(page)).file).toBe("arcade.fe");
    await expect(page.locator(`${F} .codenote`)).toHaveText("");
  }
  await page.locator(`${F} [data-move="first"]`).click();
  expect((await lit(page)).file).toBe("arcade.fe");
  await page.locator(`${F} [data-move="last"]`).click();
  expect((await lit(page)).file).toBe("arcade.fe");
  expect(await height(page)).toBe(h);
  // (back to Solidity: where it was)
  await page.locator(`${F} button[data-lang="sol"]`).click();
  await loaded(page, "sol");
  expect(Number(await step(page))).toBeLessThan(s0);
  // ↺ Reset: the opening language and step
  await page.locator(`${F} button[data-lang="fe"]`).click();
  await page.locator(".reset").click();
  await expect(page.locator(`${F}[data-lang="sol"]`)).toHaveCount(1);
  await expect.poll(async () => Number(await step(page))).toBe(s0);
  await expect(page.locator(".reset")).not.toHaveAttribute("data-shown");
});

test("the shell lists it as a scene; soldb is never in the app's code",
  async ({ page }) => {
    await page.goto("./shell.html#scene=real-debugger");
    await expect(page.locator(F)).toHaveCount(1);
    // (the worker and its files come from ../debugger/, on first view)
    await expect(page.locator(`${F}[data-loaded]`)).toHaveCount(1, LOAD);
  });
