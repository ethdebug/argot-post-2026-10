// The bugc stepper (T8.1): carol's join, stepped; `name`, a calldata
// reference, lights the call's bytes, NAME_C, in the calldata dump
import { test, expect } from "../../page";
import { pick } from "../../pick";
import { NAME_C, STEPPER } from "../../expect";

for (const id of Object.values(STEPPER)) {
  test(`${id}: the name, sliced from the call, lights its bytes ` +
    "in calldata; its walkthrough reads the reference's word",
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`./embed.html#scene=${id}`);
    await expect(page.locator(".mbar .dot.cur")).toHaveAttribute(
      "data-k", "0");
    // (-O 0: its second moment; -O 2: its first, carol's join)
    if (id === STEPPER.O0) {
      await page.locator('.mbar [data-t="next"]').click();
      await expect(page.locator(".mbar .rcap"))
        .toHaveText("the name, sliced from the call");
    }
    // (-O 2: its first moment selects the locals, `name` among them)
    if (id === STEPPER.O2) {
      await expect(page.locator('li[data-path="@locals"] > .row.sel'))
        .toBeVisible();
    }
    await pick(page.locator('li[data-path="name"] > .row'));
    // (the call's bytes 68 to 101: NAME_C, lit in the calldata dump)
    const lit = await page.locator('[data-view$=":calldata"] .b.hl')
      .evaluateAll((bs) => bs.map((b) => {
        const w = (b.closest(".word") as HTMLElement).dataset.slot!;
        return parseInt(w, 16) + Number((b as HTMLElement).dataset.i);
      }).sort((a, b) => a - b));
    const n = Buffer.byteLength(NAME_C);
    expect(lit).toEqual(Array.from({ length: n }, (_, k) => 68 + k));
    await page.locator('button[data-r="start"]').click();
    await page.locator(".rdots .dot").last().click();
    await expect(page.locator(".wpanel .rcap")).toContainText("name");
  });
}

// The figure fills its frame at every width a host gives it, nothing
// past its right edge (the code's long lines wrap in their pane)
for (const id of Object.values(STEPPER)) {
  for (const width of [358, 960, 1216]) {
    test(`${id} at ${width}px: nothing wider than the frame`,
      async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`./embed.html#scene=${id}`);
        await expect(page.locator(".mbar .dot.cur")).toHaveCount(1);
        await expect(page.locator("pre.src .line").first()).toBeVisible();
        const over = await page.evaluate(() => [...document
          .querySelectorAll("#embed *")].filter((e) =>
          e.getBoundingClientRect().right > innerWidth + 0.5)
          .map((e) => `${e.tagName}.${e.className}`).slice(0, 5));
        expect(over).toEqual([]);
      });
  }
}

// After a move, a group shut while it ran opens whole: its rows drawn
// with their names, at a row's height (TimelineBar.tsx held the rows it
// drew during the move, a shut group's at no height, and kept them
// after it)
test("optimized-locals: after a move, storage opens with its rows",
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("./embed.html#scene=optimized-locals");
    await expect(page.locator(".mbar .dot.cur")).toHaveAttribute(
      "data-k", "0");
    const lens = page.locator(".lens");
    for (const q of ["next", "first"]) {
      await page.locator(`.mbar [data-t="${q}"]`).click();
      await expect(lens).not.toHaveAttribute("data-playing", "",
        { timeout: 10_000 });
    }
    // (the moment's selection cleared: every value shown)
    await page.locator(".mbar").focus();
    await page.keyboard.press("Escape");
    await page.locator('li[data-path="@storage"] > .chev').click();
    const row = page.locator('li[data-path="motd"] > .row');
    await expect(row.locator(".name")).toBeVisible();
    await expect(row.locator(".name")).toHaveText("motd");
    const h = (await row.boundingBox())!.height;
    expect(h).toBeGreaterThan(12);
    // (a row as tall as what it draws, a long value's lines too: not
    // held at another height)
    expect(await row.evaluate((e) => e.style.height)).toBe("");
    expect(await row.evaluate((e) => e.scrollHeight <= e.clientHeight + 1))
      .toBe(true);
    await expect(lens).not.toHaveAttribute("data-held", "");
  });

// A stack word is drawn as every word is, then cut to what fits: `len`
// selected, its bytes lit, the "…" for the bytes cut lit as they are
test("optimized-locals: len selected lights its stack bytes",
  async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("./embed.html#scene=optimized-locals");
    // (its first moment selects the locals: cleared, every value shown)
    await expect(page.locator('li[data-path="@locals"] > .row.sel'))
      .toBeVisible();
    await page.locator(".mbar").focus();
    await page.keyboard.press("Escape");
    await page.locator('li[data-path="len"] > .row').click();
    // (its bytes: the same cells as every word's, the low ones shown at
    // the row's right edge, "…" for the rest, lit as they are)
    const word = page.locator(".view[data-location=stack] .wrow.on .bytes");
    const shown = word.locator(".oct > .b:not([hidden])");
    await expect(shown.last()).toHaveText("22");
    await expect(shown.last()).toHaveClass(/\bhl\b/);
    expect(await shown.count()).toBeGreaterThan(3);
    expect(await shown.count()).toBeLessThan(32);
    await expect(word.locator(".el")).toBeVisible();
    await expect(word.locator(".el")).toHaveClass(/\bhl\b/);
    // (the row's right edge: no room left after its last byte)
    const gap = await word.evaluate((b) => b.getBoundingClientRect().right -
      [...b.querySelectorAll(".oct > .b:not([hidden])")].at(-1)!
        .getBoundingClientRect().right);
    expect(gap).toBeLessThan(12);
  });

// A moment's own groups shut or open on arriving there (alice's first
// moment: `player` open, its fields' colours in memory); a group shut
// colours its bytes as itself, never in its hidden fields' colours
test("optimized-locals: player open on arriving; shut, one colour",
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("./embed.html#scene=optimized-locals");
    await page.locator('.mbar [role=tab][data-tx="12"]').click();
    const player = page.locator('li[data-path="player"]');
    await expect(player).not.toHaveClass(/collapsed/);
    await expect(page.locator('li[data-path="player.score"] > .row'))
      .toBeVisible();
    const colours = () => page.locator(
      ".view[data-location=memory] .b.hl").evaluateAll((bs) =>
      [...new Set(bs.map((b) => b.className.match(/\bpk\d+\b/)?.[0] ??
        "pk0"))].sort());
    await expect.poll(async () => (await colours()).length)
      .toBeGreaterThan(2);
    await player.locator(":scope > .chev").click();
    await expect(player).toHaveClass(/collapsed/);
    await expect.poll(colours).toEqual(["pk0"]);
  });

// A move is its own motion: no view transition during it or on its
// arrival, and the selection held through its steps where the variable
// has no location (alice's moments 1 to 2: `player` none for a few): the
// tree keeps its rows, never every variable, storage's first
test("optimized-locals: a move, no transition; its selection held",
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("./embed.html#scene=optimized-locals");
    await page.locator('.mbar [role=tab][data-tx="12"]').click();
    await expect(page.locator('li[data-path="player"] > .row.sel'))
      .toBeVisible();
    const lens = page.locator(".lens");
    await page.evaluate(() => {
      const w = window as unknown as { seen: string[] };
      w.seen = [];
      const f = () => {
        const l = document.querySelector(".lens");
        if (document.documentElement.classList.contains("vt-run")) {
          w.seen.push("vt");
        }
        if (l?.hasAttribute("data-playing") && document.querySelector(
          '.tree li[data-path="@storage"]')) w.seen.push("storage");
        if (w.seen.length < 50) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await page.locator('.mbar [data-t="next"]').click();
    await expect(lens).toHaveAttribute("data-playing", "");
    await expect(lens).not.toHaveAttribute("data-playing", "",
      { timeout: 10_000 });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() =>
      (window as unknown as { seen: string[] }).seen)).toEqual([]);
    await expect(page.locator('li[data-path="combo"] > .row.sel'))
      .toBeVisible();
  });
