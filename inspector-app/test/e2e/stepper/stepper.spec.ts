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
// tree keeps its rows in their places (the locals' row never moves), and
// the panel's bar its selection, never the hint for none
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
        if (l?.hasAttribute("data-playing")) {
          const top = document.querySelector('.tree li[data-path="@locals"]' +
            " > .row")?.getBoundingClientRect().top;
          if (top !== undefined) {
            (w as unknown as { top?: number }).top ??= top;
            if (Math.abs(top - (w as unknown as { top: number }).top) > 1) {
              w.seen.push(`locals moved ${top}`);
            }
          }
          if (document.querySelector(".sidecol .rsel.muted")) {
            w.seen.push("no selection");
          }
        }
        if (w.seen.length < 50) requestAnimationFrame(f);
      };
      requestAnimationFrame(f);
    });
    await page.locator('.mbar [data-t="next"]').click();
    // (its arrival, at rest: the move may be over before a poll sees it)
    await expect(page.locator(".mbar")).toContainText("2 / 5",
      { timeout: 10_000 });
    await expect(lens).not.toHaveAttribute("data-playing", "",
      { timeout: 10_000 });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() =>
      (window as unknown as { seen: string[] }).seen)).toEqual([]);
    await expect(page.locator('li[data-path="combo"] > .row.sel'))
      .toBeVisible();
  });

// The panel's bar keeps two lines' room, the selection cut to them: its
// second line starts at one place at every moment, under a long
// selection (carol's record's name) or a short one
test("optimized-locals: the bar's lines at one place at every moment",
  async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("./embed.html#scene=optimized-locals");
    const lens = page.locator(".lens");
    const tops = new Set<number>();
    const top = async () => tops.add(Math.round(await page.locator(
      ".sidecol .wpanel .rline2").evaluate((t) =>
      t.getBoundingClientRect().top)));
    for (const tx of ["3", "12"]) {
      await page.locator(`.mbar [role=tab][data-tx="${tx}"]`).click();
      await page.waitForTimeout(300);
      await top();
      while (await page.locator('.mbar [data-t="next"]').isEnabled()) {
        const at = await page.locator(".mbar .rcount").textContent();
        await page.locator('.mbar [data-t="next"]').click();
        await expect(page.locator(".mbar .rcount")).not.toHaveText(at!);
        await expect(lens).not.toHaveAttribute("data-playing", "");
        await page.waitForTimeout(300);
        await top();
      }
    }
    expect([...tops]).toHaveLength(1);
  });

// A popover in a column that opens is laid out for the width it comes
// to: the stack shut by hand, then `len` selected, the stack open again,
// its popover one line, not a sliver
test("optimized-locals: the stack opening, its popover one line",
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1216, height: 900 });
    await page.goto("./embed.html#scene=optimized-locals");
    const stack = page.locator(".view[data-location=stack]");
    await expect(stack).toHaveAttribute("data-open", "true");
    await stack.locator(".ptab").click();
    await expect(stack).toHaveAttribute("data-open", "false");
    await page.waitForTimeout(600);
    await page.locator(".mbar").focus();
    await page.keyboard.press("Escape");
    await page.locator('li[data-path="len"] > .row').click();
    await expect(stack).toHaveAttribute("data-open", "true");
    await page.waitForTimeout(900);
    const pop = stack.locator(".pop").first();
    await expect(pop).toBeVisible();
    const r = (await pop.boundingBox())!;
    const lh = await pop.evaluate((e) =>
      parseFloat(getComputedStyle(e).lineHeight) || 16);
    expect(r.width).toBeGreaterThan(60);
    expect(r.height).toBeLessThan(2.5 * lh + 8);
  });

// The program: the instructions' column shut at first, open by its tab,
// the instruction at the moment lit, following a move, read not chosen
// (no act on a row); its entry, as YAML, in a box beside it; Reset shuts
// it; the figure's height never changes
test("optimized-locals: the instructions and the instruction's entry",
  async ({ page }) => {
    await page.setViewportSize({ width: 1216, height: 900 });
    await page.goto("./embed.html#scene=optimized-locals");
    const h = () => page.locator("#embed").evaluate((e) =>
      Math.ceil(e.getBoundingClientRect().height));
    await expect(page.locator(".mbar .dot.cur")).toBeVisible();
    await page.waitForTimeout(800);
    const h0 = await h();
    const col = page.locator(".instrs");
    await expect(col).toHaveAttribute("data-open", "false");
    await expect(page.locator(".entrydrawer, .entrylink")).toHaveCount(0);
    await col.locator(".ptab").click();
    const lit = col.locator("li > .row.hl .type");
    await expect(lit).toHaveCount(1);
    const at = await lit.textContent();
    await expect(col.locator(".icall .ptrlines")).toContainText(
      `offset: ${at}`);
    await expect(col.locator("li .row").first()).toHaveCSS("cursor",
      "default");
    await page.locator('.mbar [data-t="next"]').click();
    await expect(page.locator(".lens")).not.toHaveAttribute("data-playing",
      "", { timeout: 10_000 });
    await expect(lit).not.toHaveText(at!);
    await expect(col.locator(".icall .ptrlines")).toContainText(
      `offset: ${await lit.textContent()}`);
    await expect(col.locator(".icall .ptrlines")).toContainText(
      "operation:");
    expect(await h()).toBe(h0);
    await page.locator(".reset").click();
    await expect(col).toHaveAttribute("data-open", "false");
    expect(await h()).toBe(h0);
  });

// The locals: those in scope at the moment alone, by the compiler's data
// (one in scope with no location listed, muted); the count theirs
test("optimized-locals: the locals in scope alone", async ({ page }) => {
  await page.setViewportSize({ width: 1216, height: 900 });
  await page.goto("./embed.html#scene=optimized-locals");
  const names = () => page.locator('li[data-path="@locals"] > ul > li')
    .evaluateAll((ls) => ls.map((l) => (l as HTMLElement).dataset.path));
  await expect.poll(names).toEqual(["len", "name"]);
  await page.locator('.mbar [role=tab][data-tx="12"]').click();
  await expect.poll(names).toEqual(["player"]);
  await page.locator('.mbar [data-t="next"]').click();
  await expect.poll(names, { timeout: 10_000 }).toEqual(["points", "combo",
    "mult"]);
  await expect(page.locator('li[data-path="@locals"] > .row .val'))
    .toHaveText("3 variables");
  await expect(page.locator('li[data-path="mult"] .noloc'))
    .toHaveText(/no location/);
});

// The entry's YAML folds: context open, its code folded, its variables
// open, each one folded (its pointer too, opened); a chevron toggles;
// the next instruction starts from the defaults again
test("optimized-locals: the entry's YAML folds", async ({ page }) => {
  await page.setViewportSize({ width: 1216, height: 900 });
  await page.goto("./embed.html#scene=optimized-locals");
  await page.locator('.mbar [role=tab][data-tx="12"]').click();
  await page.locator('.mbar [data-t="next"]').click();
  await expect(page.locator(".mbar")).toContainText("2 / 5",
    { timeout: 10_000 });
  await page.locator(".instrs .ptab").click();
  const chev = (path: string) => page.locator(
    `.icall .line[data-path="${path}"] > .ychev`);
  await expect(chev("context")).toHaveAttribute("aria-expanded", "true");
  await expect(chev("context.variables")).toHaveAttribute("aria-expanded",
    "true");
  await expect(chev("context.variables[0]")).toHaveAttribute(
    "aria-expanded", "false");
  await expect(chev("context.variables[1]")).toHaveAttribute(
    "aria-expanded", "false");
  await chev("context.variables[0]").click();
  await expect(chev("context.variables[0].pointer"))
    .toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.icall .line[data-path$=".code"]').first()
    .locator(".ychev")).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator('.icall .line[data-path=' +
    '"context.variables[0].pointer"] .ysum')).toBeVisible();
  // (a toggle: the pointer open, its fields under it)
  await chev("context.variables[0].pointer").click();
  await expect(chev("context.variables[0].pointer"))
    .toHaveAttribute("aria-expanded", "true");
  await chev("context").click();
  await expect(chev("context")).toHaveAttribute("aria-expanded", "false");
  await expect(chev("context.variables")).toHaveCount(0);
  // (the next instruction: the defaults)
  await page.locator('.mbar [data-t="next"]').click();
  await expect(page.locator(".mbar")).toContainText("3 / 5",
    { timeout: 10_000 });
  await expect(chev("context")).toHaveAttribute("aria-expanded", "true");
});

// What `name`'s pointer reads to find it, memory 0xa0's 32 bytes (its
// offset and length in the call), consulted: those bytes, no others;
// pointed at, its look and note as at rest
test("optimized-locals: name's offset and length word consulted",
  async ({ page }) => {
    await page.setViewportSize({ width: 1216, height: 900 });
    await page.goto("./embed.html#scene=optimized-locals");
    await page.locator('li[data-path="name"] > .row').click();
    const M = ".view[data-location=memory]";
    const rel = () => page.locator(`${M} .b.rel`).evaluateAll((bs) =>
      bs.map((b) => `${(b.closest(".wrow") as HTMLElement).dataset.slot}:${
        (b as HTMLElement).dataset.i}`));
    await expect.poll(rel).toEqual(Array.from({ length: 32 },
      (_, i) => `0x00a0:${i}`));
    const note = page.locator(`${M} .pop`);
    await expect(note).toContainText(
      "memory 0x00a0–0x00bf : (read to find name)");
    await page.locator(`${M} .wrow[data-slot="0x00a0"] .b[data-i="31"]`)
      .hover();
    await page.waitForTimeout(400);
    expect(await rel()).toHaveLength(32);
    await expect(note).toContainText("(read to find name)");
  });

// A pointer in a dump changes nothing but its own: a player's record
// selected, over bytes no value owns, and over a value's bytes, no
// consulted mark or popover changes, no pane scrolls, no page moves
test("optimized-locals: a pointer in a dump moves nothing", async ({
  page }) => {
  await page.setViewportSize({ width: 1216, height: 900 });
  await page.goto("./embed.html#scene=optimized-locals");
  await page.locator('.mbar [data-t="next"]').click();
  await expect(page.locator(".mbar")).toContainText("2 / 2",
    { timeout: 10_000 });
  await page.locator(".lens[data-settled]").waitFor();
  await page.locator('li[data-path^="players[0x90f7"]:not([data-path*="."])' +
    " > .row").click();
  await page.waitForTimeout(1200);
  const S = ".view[data-location=storage]";
  const state = () => page.evaluate((s) => ({
    rel: [...document.querySelectorAll(`${s} .wrow.rel, ${s} .b.rel`)]
      .length,
    pops: [...document.querySelectorAll(`${s} .pop`)].map((p) =>
      p.textContent!.trim()).filter((t) => !t.includes("(unmapped)")),
    scroll: [...document.querySelectorAll(".rows, pre.src")].map((r) =>
      r.scrollTop),
    heights: [...document.querySelectorAll(".pagebox")].map((b) =>
      (b as HTMLElement).style.height) }), S);
  const rest = await state();
  // (an unmapped byte, and a value's, in view)
  const pick = (owned: boolean) => page.evaluate(([s, o]) => {
    const b = [...document.querySelectorAll<HTMLElement>(`${s} .wrow .b`)]
      .find((x) => {
        const rb = x.closest(".rows")!.getBoundingClientRect();
        const r = x.getBoundingClientRect();
        const w = x.closest(".wrow")!;
        return !!x.dataset.owners === o && r.height && r.top > rb.top + 4 &&
          r.bottom < rb.bottom - 4 && !w.classList.contains("on") &&
          !w.classList.contains("rel");
      })!;
    b.id = o ? "owned-b" : "free-b";
  }, [S, owned] as const);
  for (const owned of [false, true]) {
    await pick(owned);
    await page.locator(owned ? "#owned-b" : "#free-b").hover();
    await page.waitForTimeout(700);
    const now = await state();
    expect(now.scroll).toEqual(rest.scroll);
    expect(now.heights).toEqual(rest.heights);
    if (!owned) {
      expect(now.rel).toBe(rest.rel);
      expect(now.pops).toEqual(rest.pops);
    }
  }
});

// The locals selected, as the figure opens: their members' consulted
// bytes too (a group has no pointer of its own: its members')
test("optimized-locals: the locals' consulted bytes", async ({ page }) => {
  await page.setViewportSize({ width: 1216, height: 900 });
  await page.goto("./embed.html#scene=optimized-locals");
  await expect(page.locator('li[data-path="@locals"] > .row.sel'))
    .toBeVisible();
  const M = ".view[data-location=memory]";
  await expect(page.locator(`${M} .wrow[data-slot="0x00a0"] .b.rel`))
    .toHaveCount(32);
  await expect(page.locator(`${M} .pop`)).toContainText(
    "memory 0x00a0–0x00bf : (read to find name)");
});
