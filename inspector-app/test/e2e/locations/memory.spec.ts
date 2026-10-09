// Mirrors bin/run.mjs's memory block (vanilla 78bce69 mem.js): "Inside
// one play", the locals bugc lists at three pauses, at O0 and O2
import { pick } from "../../pick";
import type { Page } from "@playwright/test";
import { test, expect, ready, type Win } from "../../page";

const at = async (page: Page, hash = "") => {
  await ready(page, { hash, width: 1280, memory: true });
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
    ":is(#mpanel, #mspanel) .b.hl:not(.cmp *)")) {
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
    ":is(#mpanel, #mspanel) .view:not([hidden]) .b.hl:not(.cmp *)")) {
    const w = (c.closest(".word") as HTMLElement).dataset.slot!;
    (bytes[w] ??= new Set()).add(k(c));
  }
  return { rows, bytes: Object.fromEntries(Object.entries(bytes)
    .map(([w, s]) => [w, [...s].sort().join()])) };
});
// the walkthrough (the storage section's, as #mdetails): one step's
// worked values (its dot), then out
const walkStep = async (page: Page, k: number) => {
  const bar = page.locator("#mdetails");
  await bar.locator('button[data-r="start"]').click();
  await page.locator(`#mdots .dot[data-k="${k}"]`).click();
  const form = (await page.locator("#mdtext").innerText()).trim();
  await bar.locator('button[data-r="exit"]').click();
  await expect(page.locator("#mdetails.replaying")).toHaveCount(0);
  return form;
};

test("every pause's locals, decoded, at O0 and O2", async ({ page }) => {
  await at(page);
  const mr = await page.evaluate(() => (window as Win).memResults);
  expect(mr.errors).toEqual([]);
  const want = { roll: [{ hit: "true" }],
    mult: [{ points: "10", combo: "3", mult: "5" },
      { points: "10", combo: "3", mult: "3" }],
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
    await at(page);
    const v = await page.evaluate(() => [
      (document.querySelector("#mmoderow") as HTMLElement).hidden,
      getComputedStyle(document.querySelector("#mmoderow")!).display,
      // (the panel's own header names it: "Memory"; vanilla 3c6d9b6)
      document.querySelector("#mwords-h")!.firstChild!.textContent!.trim(),
      document.querySelectorAll("#mpanel .cmp, #mpanel .b.chg").length,
      document.querySelector("#msrclegend")!.textContent!.trim()]);
    expect(v).toEqual([true, "none", "Memory", 0, "paused here"]);
    expect(await msel(page)).toBe("hit");
    expect(await mlit(page)).toEqual({ "after 0x00c0": "31" });
    // (no slot read at this pause: no storage panel)
    await expect(page.locator("#mstore")).toBeHidden();
  });

test("inside _applyCombo: O0 a call with a frame; colours; Before | After; "
  + "mult moves; O2 inlined", async ({ page }) => {
  await at(page);
  await mpt(page, "mult");
  await page.locator("h1").hover();
  const c = await mcol(page);
  const kids = ["points", "combo", "mult"].map((p) => c.rows[p]);
  expect(await msel(page)).toBe("_applyCombo");
  expect(c.rows._applyCombo).toBe("hl");
  expect(new Set(kids).size).toBe(3);
  for (const x of kids) expect(x).toMatch(/^pk\d$/);
  expect(c.bytes["0x0080"]).toBe("hl");
  await expect(mrow(page, "_applyCombo").locator(".val"))
    .toHaveText(/^frame at 0x[0-9a-f]+$/);
  // (pointing at one child mutes the others, not the selection's own)
  await mrow(page, "points").hover();
  const d = await mcol(page);
  expect([d.rows.points, d.rows.combo, d.rows.mult, d.rows._applyCombo,
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
  await pick(mrow(page, "mult"));
  await mopt(page, "2");
  await pick(mrow(page, "_applyCombo"));
  await expect(mrow(page, "_applyCombo").locator(".val"))
    .toHaveText("inlined: no frame");
  expect("0x0080" in (await mcol(page)).bytes).toBe(false);
  // (the word is shown, as the whole segment is: no value owns it)
  await expect(page.locator(
    "#mpanel .view:not([hidden]) .wrow[data-slot='0x0080'] .b[data-owners]"))
    .toHaveCount(0);
});

// (mult moves: each side's walkthrough adds its own offset to the
// frame's; step 2, the value's own region)
test("inside _applyCombo, each side: mult's offset from the frame",
  async ({ page }) => {
    await at(page, "#mopt=0&mpt=mult&msel=mult");
    const frame = (await mrow(page, "_applyCombo").locator(".val")
      .textContent())!.trim().slice(9);
    const hex = (n: number) => `0x${n.toString(16).padStart(4, "0")}`;
    const sides: string[] = [];
    for (const m of ["before", "after"]) {
      await page.locator(`#mmode button[data-mode="${m}"]`).click();
      sides.push(await walkStep(page, 2));
    }
    const f = parseInt(frame, 16);
    expect(sides).toEqual([
      `offset = read(-frame) + 88 = ${frame} + 88 = ${hex(f + 88)}\n` +
        "mult = 5",
      `offset = read(-frame) + 184 = ${frame} + 184 = ${hex(f + 184)}\n` +
        "mult = 3"]);
  });

test("before the writes: gained, hit with no location, alice's record",
  async ({ page }) => {
    await at(page);
    await mopt(page, "2");
    await mpt(page, "writes");
    const t = await page.locator("#mtree").innerText();
    expect(t).toMatch(/gained[\s\S]*30/);
    expect(t).toMatch(/hit[\s\S]*no location at this point/);
    await pick(mrow(page, "players[msg.sender]"));
    const c = await mcol(page);
    const ms = ["score", "combo", "bestCombo", "plays", "hits",
      "lastBlock"].map((x) => c.rows[`players[msg.sender].${x}`]);
    expect(new Set(ms).size).toBe(6);
    for (const x of ms) expect(x).toMatch(/^pk\d$/);
    expect(c.rows["players[msg.sender]"]).toBe("hl");
    await expect(mrow(page, "players[msg.sender].score").locator(".val"))
      .toHaveText("30");
    // (each location its own panel: the record's slot in a storage
    // panel of its own, under memory's; one selection lights both)
    const pan = await page.evaluate(() => ({
      mem: document.querySelector("#mwords-h")!.firstChild!.textContent!
        .trim(),
      store: document.querySelector("#mstore-h")?.textContent!.trim(),
      shown: !(document.querySelector("#mstore") as HTMLElement).hidden,
      inMem: !!document.querySelector("#mpanel .wrow[data-slot$='fb94']"),
      inStore: !!document.querySelector("#mspanel .wrow[data-slot$='fb94']"),
      lit: document.querySelectorAll("#mspanel .view:not([hidden]) .b.hl")
        .length }));
    expect(pan).toEqual({ mem: "Memory", store: "Storage", shown: true,
      inMem: false, inStore: true, lit: 32 });
    await page.locator(
      '#mspanel .b[data-owners="players[msg.sender].score"]').first().click();
    expect(await msel(page)).toBe("players[msg.sender].score");
  });

test("click again clears; Enter selects; its step lights its byte; Escape",
  async ({ page }) => {
    await at(page);
    const storageLit = await page.locator("#panel .b.hl:not(.cmp *)")
      .count();
    await mopt(page, "2");
    await mrow(page, "hit").click();
    expect(await msel(page)).toBe(null);
    await mrow(page, "hit").focus();
    await page.keyboard.press("Enter");
    await page.locator("h1").hover();
    expect(await msel(page)).toBe("hit");
    await page.locator('#mdetails button[data-r="start"]').click();
    await page.mouse.move(1, 1);
    await expect.poll(() => mlit(page)).toEqual({ "after 0x0120": "31" });
    await page.keyboard.press("Escape");
    await expect(page.locator("#mdetails.replaying")).toHaveCount(0);
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
  await at(page);
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
  await mrow(page, "mult").click();
  await page.locator("h1").hover();
  const m0 = await memView();
  await page.locator('#mode button[data-mode="before"]').click();
  await page.locator('#picker button[data-id="motd"]').click();
  await page.locator('#tree li[data-path="totalScore"] > .row').click();
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
    await at(page, "#ex=motd&mode=before&sel=playerList&mopt=2&mpt=mult"
      + "&mmode=before&msel=mult&insets=0");
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
      msel: "mult" });
    await expect(page).toHaveURL(/mopt=2/);
    await page.goto("about:blank");
    await at(page, "#ex=nope&mode=compare&sel=zzz&mopt=7&mpt=x");
    await expect(page.locator('#mpoint [aria-checked="true"]'))
      .toHaveAttribute("data-id", "roll");
    expect(await msel(page)).toBe("hit");
  });

test("the lens alone in the shell", async ({ page }) => {
  await page.goto("./shell.html#lens=inside-one-play");
  await expect(page.locator("#mtree li[data-path='hit']")).toBeAttached();
  await page.locator('#mpoint button[data-id="mult"]').click();
  await expect(page.locator("#mtree li[data-path='_applyCombo']"))
    .toBeAttached();
  await expect(page.locator(".view .b.hl").first()).toBeAttached();
});

test("the program line is hidden, as the storage section's",
  async ({ page }) => {
  await at(page);
  await expect(page.locator("#mmeta")).toBeHidden();
  await expect(page.locator("#mmeta")).toContainText("bug/arcade.bug");
});

// (the frame pointer's step: the word read, lit alone; the frame word
// named by its part, "_applyCombo#frame")
test("a walkthrough's read step lights the word it reads",
  async ({ page }) => {
    await at(page, "#mopt=0&mpt=mult&msel=combo");
    await page.locator('#mdetails button[data-r="start"]').click();
    await page.locator('#mdetails button[data-r="next"]').click();
    await page.mouse.move(1, 1);
    await expect(page.locator("#mdetails .rcap"))
      .toHaveText("-frame is read: memory 0x0080–0x009f");
    await expect.poll(() => mlit(page)).toEqual({ "after 0x0080": "all" });
    await expect(page.locator("#mpanel .view:not([hidden]) .pop"))
      .toHaveText(["memory 0x0080 : _applyCombo#frame"]);
  });
