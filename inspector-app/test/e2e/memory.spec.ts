// Mirrors bin/run.mjs's memory block (vanilla 78bce69 mem.js): "Inside
// one play", the locals bugc lists at three pauses, at O0 and O2
import { test, expect, type Page } from "@playwright/test";

type W = { memResults: { done: boolean; errors: string[];
  decoded: Record<string, Record<string, { values: Record<string, string>;
    none: string[] }[]>> }; results: { done: boolean } };
const ready = async (page: Page, hash = "") => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("./" + hash);
  await page.waitForFunction(() => (window as unknown as W).memResults?.done
    && (window as unknown as W).results?.done);
  await page.locator("#memory").scrollIntoViewIfNeeded();
};
const mrow = (page: Page, n: string) =>
  page.locator(`#mtree li[data-path="${n}"] > .row`);
const mpt = (page: Page, id: string) =>
  page.locator(`#mpoint button[data-id="${id}"]`).click();
const mopt = (page: Page, o: string) =>
  page.locator(`#mlevel button[data-opt="${o}"]`).click();
const msel = (page: Page) => page.evaluate(() => (document.querySelector(
  "#mtree .row.sel")?.parentElement as HTMLElement | null)?.dataset.path
  ?? null);
const mlit = (page: Page) => page.evaluate(() => {
  const out: Record<string, number[]> = {};
  for (const c of document.querySelectorAll<HTMLElement>(
    "#mpanel .b.hl:not(.cmp *)")) {
    const w = c.closest<HTMLElement>(".word")!;
    (out[`${w.dataset.side} ${w.dataset.slot}`] ??= []).push(+c.dataset.i!);
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) =>
    [k, v.length === 32 ? "all" : v.join()]));
});
// each lit row's and byte's colour: "hl" or its child colour, "muted"
const mcol = (page: Page) => page.evaluate(() => {
  const k = (el: Element) => !el.classList.contains("hl") ? null
    : ([...el.classList].find((c) => /^pk\d$/.test(c)) ?? "hl") +
      (el.classList.contains("muted") ? " muted" : "");
  const rows: Record<string, string | null> = {};
  for (const li of document.querySelectorAll<HTMLElement>(
    "#mtree li[data-path]")) rows[li.dataset.path!] = k(li.firstElementChild!);
  const bytes: Record<string, Set<string | null>> = {};
  for (const c of document.querySelectorAll(
    "#mpanel .view:not([hidden]) .b.hl:not(.cmp *)")) {
    const w = (c.closest(".word") as HTMLElement).dataset.slot!;
    (bytes[w] ??= new Set()).add(k(c));
  }
  return { rows, bytes: Object.fromEntries(Object.entries(bytes)
    .map(([w, s]) => [w, [...s].sort().join()])) };
});
const dl = (page: Page, q: string) => page.evaluate((q) => {
  const out: Record<string, string> = {};
  for (const dt of document.querySelectorAll(`${q} dt`)) {
    out[dt.textContent!.trim()] =
      (dt.nextElementSibling as HTMLElement).innerText.trim();
  }
  return out;
}, q);

test("every pause's locals, decoded, at O0 and O2", async ({ page }) => {
  await ready(page);
  const mr = await page.evaluate(() => (window as unknown as W).memResults);
  expect(mr.errors).toEqual([]);
  const want = { roll: [{ hit: "true" }],
    mult: [{ points: "10", combo: "3", m: "5" },
      { points: "10", combo: "3", m: "3" }],
    writes: [{ gained: "30" }] };
  for (const o of ["0", "2"]) {
    for (const [pt, w] of Object.entries(want)) {
      expect(mr.decoded[o][pt].map((x) => x.values), `${o} ${pt}`)
        .toEqual(w);
    }
    expect(mr.decoded[o].writes[0].none).toEqual(["hit"]);
  }
});

test("one point: one dump, Memory; the roll: hit, its last byte",
  async ({ page }) => {
    await ready(page);
    const v = await page.evaluate(() => [
      (document.querySelector("#mmoderow") as HTMLElement).hidden,
      getComputedStyle(document.querySelector("#mmoderow")!).display,
      [...document.querySelectorAll("#mpanel .view-name")].filter((x) =>
        (x as HTMLElement).offsetParent).map((x) => x.textContent).join(),
      document.querySelectorAll("#mpanel .cmp, #mpanel .b.chg").length,
      document.querySelector("#msrclegend")!.textContent!.trim()]);
    expect(v).toEqual([true, "none", "Memory", 0, "paused here"]);
    expect(await msel(page)).toBe("hit");
    expect(await mlit(page)).toEqual({ "after 0x00c0": "31" });
  });

test("inside multiplied: O0 a call with a frame; colours; Before | After; "
  + "m moves; O2 inlined", async ({ page }) => {
  await ready(page);
  await mpt(page, "mult");
  await page.locator("h1").hover();
  const c = await mcol(page);
  const kids = ["points", "combo", "m"].map((p) => c.rows[p]);
  expect(await msel(page)).toBe("multiplied");
  expect(c.rows.multiplied).toBe("hl");
  expect(new Set(kids).size).toBe(3);
  for (const x of kids) expect(x).toMatch(/^pk\d$/);
  expect(c.bytes["0x0080"]).toBe("hl");
  await expect(mrow(page, "multiplied").locator(".val"))
    .toHaveText(/^frame at 0x[0-9a-f]+$/);
  // (pointing at one child mutes the others, not the selection's own)
  await mrow(page, "points").hover();
  const d = await mcol(page);
  expect([d.rows.points, d.rows.combo, d.rows.m, d.rows.multiplied,
    d.bytes["0x0080"]]).toEqual([kids[0], `${kids[1]} muted`,
    `${kids[2]} muted`, "hl", "hl"]);
  for (const [m, want] of [["before", "Before"], ["after", "After"]]) {
    await page.locator(`#mmode button[data-mode="${m}"]`).click();
    const v = await page.locator("#mpanel .view").evaluateAll((vs) =>
      vs.filter((x) => !(x as HTMLElement).hidden &&
        (x as HTMLElement).offsetHeight).map((x) =>
        x.querySelector(".view-name")!.textContent).join());
    expect(v).toBe(want);
  }
  await page.locator('#mpanel .view:not([hidden]) .b[data-owners="points"]')
    .first().click();
  expect(await msel(page)).toBe("points");
  await mrow(page, "m").click();
  const dd = await dl(page, "#mdetails");
  const [a, b] = [dd.Before, dd.After].map((x) =>
    x?.match(/^0x([0-9a-f]+)–0x([0-9a-f]+) = (\d)$/));
  const frame = parseInt((await mrow(page, "multiplied").locator(".val")
    .textContent())!.trim().slice(9), 16);
  expect([parseInt(a![1], 16) - frame, a![3], parseInt(b![1], 16) - frame,
    b![3]]).toEqual([88, "5", 184, "3"]);
  await mopt(page, "2");
  await mrow(page, "multiplied").click();
  await expect(mrow(page, "multiplied").locator(".val"))
    .toHaveText("inlined: no frame");
  expect("0x0080" in (await mcol(page)).bytes).toBe(false);
  await expect(page.locator("#mpanel .wrow[data-slot='0x0080']"))
    .toHaveCount(0);
});

test("before the writes: gained, hit with no location, alice's record",
  async ({ page }) => {
    await ready(page);
    await mopt(page, "2");
    await mpt(page, "writes");
    const t = await page.locator("#mtree").innerText();
    expect(t).toMatch(/gained[\s\S]*30/);
    expect(t).toMatch(/hit[\s\S]*no location at this point/);
    await mrow(page, "players[msg.sender]").click();
    const c = await mcol(page);
    const ms = ["score", "combo", "bestCombo", "plays", "hitCount",
      "lastBlock"].map((x) => c.rows[`players[msg.sender].${x}`]);
    expect(new Set(ms).size).toBe(6);
    for (const x of ms) expect(x).toMatch(/^pk\d$/);
    expect(c.rows["players[msg.sender]"]).toBe("hl");
    await expect(mrow(page, "players[msg.sender].score").locator(".val"))
      .toHaveText("30");
    await page.locator(
      '#mpanel .b[data-owners="players[msg.sender].score"]').first().click();
    expect(await msel(page)).toBe("players[msg.sender].score");
  });

test("click again clears; Enter selects; a step lights its region; Escape",
  async ({ page }) => {
    await ready(page);
    const storageLit = await page.locator("#panel .b.hl:not(.cmp *)")
      .count();
    await mopt(page, "2");
    await mrow(page, "hit").click();
    expect(await msel(page)).toBe(null);
    await mrow(page, "hit").focus();
    await page.keyboard.press("Enter");
    await page.locator("h1").hover();
    expect(await msel(page)).toBe("hit");
    await page.locator("#mhow li[data-region]").first().hover();
    expect(await mlit(page)).toEqual({ "after 0x0120": "31" });
    await page.locator("h1").hover();
    await page.keyboard.press("Escape");
    expect(await msel(page)).toBe(null);
    expect(await page.locator("#panel .b.hl:not(.cmp *)").count())
      .toBe(storageLit);
    expect(await page.evaluate(() => {
      const v = document.querySelector("#mpanel .views")!;
      return v.scrollWidth > v.clientWidth + 1;
    })).toBe(false);
  });

test("each section keeps its own view", async ({ page }) => {
  await ready(page);
  const memView = () => page.evaluate(() => JSON.stringify([
    ...["#mlevel", "#mpoint", "#mmode"].map((q) =>
      document.querySelector(`${q} [aria-checked="true"]`)?.textContent),
    [...document.querySelectorAll<HTMLElement>("#mpanel .view")]
      .map((v) => v.hidden).join(),
    (document.querySelector("#mtree .row.sel")?.parentElement as
      HTMLElement | null)?.dataset.path,
    (document.querySelector("#mtree") as HTMLElement).innerText,
    document.querySelectorAll("#mpanel .b.hl").length]));
  const storeView = () => page.evaluate(() => JSON.stringify([
    (document.querySelector('#picker [aria-checked="true"]') as
      HTMLElement)?.dataset.id,
    (document.querySelector('#mode [aria-checked="true"]') as
      HTMLElement)?.dataset.mode,
    (document.querySelector("#tree .row.sel")?.parentElement as
      HTMLElement | null)?.dataset.path,
    (document.querySelector("#tree") as HTMLElement).innerText]));
  await page.locator('#picker button[data-id="alice"]').click();
  await mpt(page, "mult");
  await mrow(page, "m").click();
  await page.locator("h1").hover();
  const m0 = await memView();
  await page.locator('#mode button[data-mode="before"]').click();
  await page.locator('#picker button[data-id="motd"]').click();
  await page.locator('#tree li[data-path="total"] > .row').click();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Escape");
  await page.locator("h1").hover();
  expect(await memView()).toBe(m0);
  const s0 = await storeView();
  await page.locator('#mmode button[data-mode="before"]').click();
  await mopt(page, "2");
  await mpt(page, "writes");
  await mrow(page, "gained").click();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Escape");
  await page.locator("h1").hover();
  expect(await storeView()).toBe(s0);
  expect(await page.locator("#mtree .row.sel").count()).toBe(0);
});

test("the hash keeps the memory view; a stale one gives its defaults",
  async ({ page }) => {
    await ready(page, "#ex=motd&mode=before&sel=roster&mopt=2&mpt=mult"
      + "&mmode=before&msel=m&insets=0");
    const got = await page.evaluate(() => ({
      mopt: document.querySelector('#mlevel [aria-checked="true"]')
        ?.textContent,
      mpt: (document.querySelector('#mpoint [aria-checked="true"]') as
        HTMLElement)?.dataset.id,
      mmode: (document.querySelector('#mmode [aria-checked="true"]') as
        HTMLElement)?.dataset.mode,
      msel: (document.querySelector("#mtree .row.sel")?.parentElement as
        HTMLElement | null)?.dataset.path }));
    expect(got).toEqual({ mopt: "O2", mpt: "mult", mmode: "before",
      msel: "m" });
    await expect(page).toHaveURL(/mopt=2/);
    await page.goto("about:blank");
    await ready(page, "#ex=nope&mode=compare&sel=zzz&mopt=7&mpt=x");
    await expect(page.locator('#mpoint [aria-checked="true"]'))
      .toHaveAttribute("data-id", "roll");
    expect(await msel(page)).toBe("hit");
  });

test("the lens alone in the shell", async ({ page }) => {
  await page.goto("./shell.html#lens=inside-one-play");
  await expect(page.locator("#mtree li[data-path='hit']")).toBeAttached();
  await page.locator('#mpoint button[data-id="mult"]').click();
  await expect(page.locator("#mtree li[data-path='multiplied']"))
    .toBeAttached();
  await expect(page.locator(".view .b.hl").first()).toBeAttached();
});
