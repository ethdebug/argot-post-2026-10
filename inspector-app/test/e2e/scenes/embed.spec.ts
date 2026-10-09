// The embed entry: one scene's lens alone, by the hash, in a frame; it
// posts its height to the host page
import { test, expect } from "../../page";

for (const width of [1024, 390]) {
  test(`embed.html#scene=raw at ${width}px: storage, the stack and memory, no page ` +
    "chrome; its height to the host", async ({ page, baseURL }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("./embed.html");
    // (a host page: the embed in a frame, sized by its messages)
    await page.setContent(`<body style="margin:0">
      <iframe id="f" src="${baseURL}embed.html#scene=raw"
        style="border:0;width:100%;height:50px;display:block"></iframe>
      <script>addEventListener("message", (e) => {
        if (e.data?.type !== "ethdebug:height") return;
        document.getElementById("f").style.height = e.data.height + "px";
        window.heights = [...(window.heights ?? []), e.data.height];
        window.columns = e.data.columns;
      });</script></body>`);
    const frame = page.frameLocator("#f");
    await expect(frame.locator(".view .wrow[data-slot]").first())
      .toBeVisible();
    await expect(frame.locator(".view")).toHaveCount(3);
    for (const q of ["main", "header", "h1", "#picker", ".picker",
      "#contract", "footer", ".shellbar"]) {
      await expect(frame.locator(q)).toHaveCount(0);
    }
    // (its columns: the raw lens lays out two, side by side)
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { columns?: number }).columns)).toBe(2);
    await expect(frame.locator(".moment")).toHaveText(
      "while carol plays: right after her combo resets");
    // (the frame as tall as its content, by the last height it posted)
    const inner = await page.frameLocator("#f").locator("#embed")
      .evaluate((e) => Math.ceil(e.getBoundingClientRect().height));
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { heights?: number[] }).heights?.at(-1)))
      .toBe(inner);
    expect(await page.locator("#f").evaluate((f) =>
      f.getBoundingClientRect().height)).toBe(inner);
    // (no margin, a transparent page; it never scrolls)
    expect(await frame.locator("body").evaluate((b) => [
      getComputedStyle(b).margin, getComputedStyle(b).backgroundColor]))
      .toEqual(["0px", "rgba(0, 0, 0, 0)"]);
    expect(await frame.locator("html").evaluate((h) =>
      getComputedStyle(h).overflow)).toBe("hidden");
    expect(await frame.locator(".view-head").first().evaluate((h) =>
      getComputedStyle(h).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  });
}

test("embed.html: moment=0 leaves the moment out", async ({ page }) => {
  await page.goto("./embed.html#scene=raw&moment=0");
  await expect(page.locator(".view")).toHaveCount(3);
  await expect(page.locator(".moment")).toHaveCount(0);
});

// Any scene of the registry, by its id, drawn by its lens alone
for (const [id, views] of [["raw-named", 1], ["mid", 1], ["vyper", 1],
  ["players-walk", 1], ["bug-O2", 1]] as const) {
  test(`embed.html#scene=${id}: its lens alone, its height posted`,
    async ({ page }) => {
      const heights: number[] = [];
      await page.exposeFunction("posted", (h: number) => heights.push(h));
      await page.addInitScript(() => {
        window.parent.postMessage = (m: { height: number }) =>
          (window as unknown as { posted(h: number): void }).posted(
            m.height);
      });
      await page.setViewportSize({ width: 1024, height: 900 });
      await page.goto(`./embed.html#scene=${id}`);
      // (the scene's data, then each of its views: on a slow runner,
      // several seconds)
      await expect(page.locator(".view:not([hidden])").first())
        .toBeVisible({ timeout: 20_000 });
      await expect.poll(() => page.locator(".view").count(),
        { timeout: 20_000 }).toBeGreaterThanOrEqual(views);
      for (const q of ["main", "#picker", "#contract-box",
        "[data-area=contract] *", ".shellbar"]) {
        await expect(page.locator(`${q}:visible`)).toHaveCount(0);
      }
      // (no box inside it scrolls; its last height is its content's)
      expect(await page.evaluate(() => [...document.querySelectorAll(
        "#embed *")].filter((e) => /auto|scroll/.test(
        getComputedStyle(e).overflowY) && e.scrollHeight >
        e.clientHeight + 1).length)).toBe(0);
      // (its height now: the views' type follows their cell size, set
      // once the dumps fit, so it settles a moment after they show)
      const now = () => page.locator("#embed").evaluate((e) =>
        Math.ceil(e.getBoundingClientRect().height));
      await expect.poll(async () => heights.at(-1) === await now(),
        { timeout: 20_000 }).toBe(true);
    });
}

test("embed.html: an unknown scene says so", async ({ page }) => {
  await page.goto("./embed.html#scene=nope");
  await expect(page.locator("[role=alert]")).toContainText("nope");
});

test("embed.html: raw-named is the raw moment, named: every score, " +
  "carol's whole name", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("./embed.html#scene=raw-named");
  const C = "players[0x90f79bf6eb2c4f870365e785982e1f101e93b906]";
  const val = (p: string) => page.locator(`.tree li[data-path="${p}"] ` +
    "> .row .val");
  await expect(page.locator(".tree")).toContainText("3 entries",
    { timeout: 20_000 });
  await expect(val(`${C}.score`)).toHaveText("100");
  await expect(val(`${C}.combo`)).toHaveText("0");
  await expect(val(`${C}.name`))
    .toHaveText('"carol, the unstoppable combo queen"');
  // (carol's record selected and open; alice's and bob's shut)
  await expect(page.locator(`.tree li[data-path="${C}"] > .row.sel`))
    .toHaveCount(1);
  for (const k of ["0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
    "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc"]) {
    await expect(page.locator(`.tree li[data-path="players[${k}]"]`))
      .toHaveClass(/collapsed/);
  }
  // (a popover's "how" readable: its ink is not its fill)
  await page.locator('.view:not([hidden]) .wrow[data-slot] > .addr')
    .first().hover();
  const pop = page.locator(".pop .phow").first();
  const [ink, fill] = await pop.evaluate((h) => [
    getComputedStyle(h).color, getComputedStyle(h.closest(".pop")!)
      .backgroundColor]);
  expect(ink).not.toBe(fill);
});

// The columns each post scene lays out (the host's figure width)
for (const [id, n] of [["raw-hero", 2], ["mid", 2], ["vyper", 2],
  ["players-walk", 1], ["bug-O2", 2]] as const) {
  test(`embed.html#scene=${id} posts columns: ${n}`, async ({ page }) => {
    const cols: number[] = [];
    await page.exposeFunction("postedCols", (c: number) => cols.push(c));
    await page.addInitScript(() => {
      window.parent.postMessage = (m: { columns: number }) =>
        (window as unknown as { postedCols(c: number): void })
          .postedCols(m.columns);
    });
    await page.goto(`./embed.html#scene=${id}`);
    await expect.poll(() => cols.at(-1), { timeout: 20_000 }).toBe(n);
  });
}

test("players-walk at 680px: one column, nothing past its edge",
  async ({ page }) => {
    await page.setViewportSize({ width: 680, height: 900 });
    await page.goto("./embed.html#scene=players-walk");
    await expect(page.locator(".view:not([hidden])").first())
      .toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth))
      .toBe(680);
  });

// A phone: the two-column scenes in one column; no two areas overlap
for (const id of ["vyper", "raw-named", "bug-O2", "mid"]) {
  test(`embed.html#scene=${id} at 360px: one column, no area over another`,
    async ({ page }) => {
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(`./embed.html#scene=${id}`);
      await expect(page.locator(".view:not([hidden])").first())
        .toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(500);
      const boxes = await page.locator(".lens > [data-area]").evaluateAll(
        (as) => as.map((a) => {
          const r = a.getBoundingClientRect();
          return { a: (a as HTMLElement).dataset.area, l: r.left,
            t: r.top, r: r.right, b: r.bottom };
        }).filter((x) => x.r - x.l > 0 && x.b - x.t > 0));
      for (const x of boxes) {
        for (const y of boxes) {
          if (x === y) continue;
          const over = x.l < y.r - 1 && y.l < x.r - 1 && x.t < y.b - 1 &&
            y.t < x.b - 1;
          expect(over, `${x.a} over ${y.a}`).toBe(false);
        }
      }
      expect(await page.evaluate(() =>
        document.documentElement.scrollWidth)).toBe(360);
    });
}

// The height only once the scene is drawn: the first message says
// ready, and the height is the same on every load
for (const id of ["raw-hero", "mid", "bug-O2", "players-walk"]) {
  test(`embed.html#scene=${id}: one ready height, the same each load`,
    async ({ page, browserName }) => {
      test.skip(browserName !== "chromium", "one browser: a measure");
      await page.setViewportSize({ width: 1024, height: 800 });
      const got: { height: number; ready?: boolean }[] = [];
      await page.exposeFunction("postedMsg", (m: { height: number;
        ready?: boolean }) => got.push(m));
      await page.addInitScript(() => {
        window.parent.postMessage = (m: unknown) => (window as unknown as
          { postedMsg(m: unknown): void }).postedMsg(m);
      });
      const heights: number[] = [];
      for (let k = 0; k < 2; k++) {
        got.length = 0;
        await page.goto(`./embed.html?k=${k}#scene=${id}`);
        await expect.poll(() => got.length, { timeout: 20_000 })
          .toBeGreaterThan(0);
        expect(got[0].ready).toBe(true);
        await page.waitForTimeout(1000);
        // (the first is the drawn scene's: no later change of size)
        expect(got.map((m) => m.height)).toEqual([got[0].height]);
        heights.push(got[0].height);
      }
      expect(heights[1]).toBe(heights[0]);
    });
}

// The post's Vyper figure: alice's score, two answers side by side, each
// headed by its rule; short
test("embed.html#scene=vyper-rules: Solidity's rule 0, Vyper's layout " +
  "30, side by side", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  const posted: { height: number; columns: number }[] = [];
  await page.exposeFunction("posted", (m: never) => posted.push(m));
  await page.addInitScript(() => {
    window.parent.postMessage = (m: unknown) =>
      (window as never as { posted(m: unknown): void }).posted(m);
  });
  await page.goto("./embed.html#scene=vyper-rules");
  const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8].score";
  const val = page.locator(`.tree li[data-path="${A}"] > .row .val`);
  await expect(val).toHaveText(["0", "30"], { timeout: 20_000 });
  await expect(page.locator(".tree .treehead")).toHaveText([
    "Solidity's rule", /^Vyper's layout\s+written by hand/i]);
  const [a, b] = await val.evaluateAll((v) => v.map((e) =>
    e.getBoundingClientRect()));
  expect(Math.abs(a.top - b.top)).toBeLessThan(30);
  expect(b.left).toBeGreaterThan(a.right);
  // (one entry, one field: nothing else in the trees)
  await expect(page.locator(".tree li[data-path]")).toHaveCount(6);
  await expect.poll(() => posted.at(-1)?.height).toBeLessThan(400);
  expect(posted.at(-1)!.columns).toBe(2);
});

// The height message carries the storage dump's row pitch (`row`: one
// row's top to the next's, at the frame's width), and none for a scene
// with no storage dump
for (const [id, has] of [["mid", true], ["raw-hero", true],
  ["vyper-rules", true], ["bug-O2", true]] as const) {
  test(`embed.html#scene=${id}: its height message's row pitch`,
    async ({ page }) => {
      await page.setViewportSize({ width: 1024, height: 900 });
      const posted: { ready?: boolean; row?: number }[] = [];
      await page.exposeFunction("posted", (m: never) => posted.push(m));
      await page.addInitScript(() => {
        window.parent.postMessage = (m: unknown) =>
          (window as never as { posted(m: unknown): void }).posted(m);
      });
      await page.goto(`./embed.html#scene=${id}`);
      await expect.poll(() => posted.some((m) => m.ready),
        { timeout: 20_000 }).toBe(true);
      const last = posted.at(-1)!;
      if (!has) return expect(last.row).toBeUndefined();
      // (two rows next to each other: their tops' distance)
      const want = await page.evaluate(() => {
        const rs = [...document.querySelectorAll(
          '.view[data-location="storage"] .rows .wrow[data-slot]')]
          .map((r) => r.getBoundingClientRect());
        const d = rs.slice(1).map((r, k) => r.top - rs[k].top)
          .filter((x) => x > 0);
        return d.length ? Math.min(...d) : rs[0].height;
      });
      expect(last.row).toBeGreaterThan(10);
      expect(Math.abs(last.row! - want)).toBeLessThan(3);
      // (a narrower frame: posted again, as laid out there)
      await page.setViewportSize({ width: 390, height: 900 });
      await expect.poll(() => posted.at(-1)!.row).not.toBe(last.row);
    });
}

// The Vyper figure's two hashes: their arguments badged, the key and the
// slot each one colour on both sides, the order flipped; Solidity's slot
// empty, said so
test("embed.html#scene=vyper-rules: the two hashes' arguments, badged; " +
  "Solidity's slot empty", async ({ page }) => {
  await page.setViewportSize({ width: 838, height: 700 });
  await page.goto("./embed.html#scene=vyper-rules");
  const pops = page.locator(".view[data-location=storage] .pop");
  await expect(pops).toHaveCount(2, { timeout: 20_000 });
  const args = (k: number) => pops.nth(k).locator(".parg")
    .evaluateAll((cs) => cs.map((c) => [c.textContent!.replace(/^.*…/, "…"),
      c.className.match(/pk\d/)![0]]));
  const [sol, vy] = [await args(0), await args(1)];
  expect(sol.map(([t]) => t)).toEqual(["…79c8", "slot 3"]);
  expect(vy.map(([t]) => t)).toEqual(["slot 108", "…79c8"]);
  expect([sol[0][1], sol[1][1]]).toEqual([vy[1][1], vy[0][1]]);
  await expect(pops.nth(0)).toContainText("(empty: all zeros)");
  await expect(pops.nth(1)).not.toContainText("empty");
});
