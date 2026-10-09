// The embed entry: one scene's lens alone, by the hash, in a frame; it
// posts its height to the host page
import { test, expect } from "../../page";

for (const width of [1024, 390]) {
  test(`embed.html#scene=raw at ${width}px: the four panels, no page ` +
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
      });</script></body>`);
    const frame = page.frameLocator("#f");
    await expect(frame.locator(".view .wrow[data-slot]").first())
      .toBeVisible();
    await expect(frame.locator(".view")).toHaveCount(4);
    for (const q of ["main", "header", "h1", "#picker", ".picker",
      "#contract", "footer", ".shellbar"]) {
      await expect(frame.locator(q)).toHaveCount(0);
    }
    await expect(frame.locator(".moment")).toHaveText(
      "while carol joins: her name is being saved, half-written");
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
  await expect(page.locator(".view")).toHaveCount(4);
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
      const h = await page.locator("#embed").evaluate((e) =>
        Math.ceil(e.getBoundingClientRect().height));
      await expect.poll(() => heights.at(-1), { timeout: 20_000 }).toBe(h);
    });
}

test("embed.html: an unknown scene says so", async ({ page }) => {
  await page.goto("./embed.html#scene=nope");
  await expect(page.locator("[role=alert]")).toContainText("nope");
});

test("embed.html: raw-named is the raw moment, named", async ({ page }) => {
  await page.goto("./embed.html#scene=raw-named");
  // (inside carol's join: alice and bob are listed, carol not yet; her
  // record is known from the trace, which hashed her key with players'
  // slot)
  await expect(page.locator(".tree")).toContainText("3 entries");
  await expect(page.locator('.tree li[data-path=' +
    '"players[0x90f79bf6eb2c4f870365e785982e1f101e93b906]"]'))
    .toBeVisible();
});

test("embed.html#scene=raw-named: the slots carol's join wrote that no " +
  "value owns yet, as unmapped rows", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("./embed.html#scene=raw-named");
  const row = page.locator('.view:not([hidden]) .wrow[data-slot$="c248"]');
  await expect(row).toBeVisible({ timeout: 20_000 });
  await row.locator(".b").nth(3).hover();
  const pop = page.locator(".pop").first();
  await expect(pop).toContainText("(unmapped)");
  // (its "how" readable: the popover's ink is not its fill)
  const [ink, fill] = await pop.locator(".phow").evaluate((h) => [
    getComputedStyle(h).color, getComputedStyle(h.closest(".pop")!)
      .backgroundColor]);
  expect(ink).not.toBe(fill);
  expect(ink).not.toBe("rgba(0, 0, 0, 0)");
  await expect(row.locator(".b.hl")).toHaveCount(0);
});
