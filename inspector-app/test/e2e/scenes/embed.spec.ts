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
    await expect(frame.locator(".moment")).toContainText("step 569 of 868");
    // (the frame as tall as its content, by the last height it posted)
    const inner = await page.frameLocator("#f").locator("#embed")
      .evaluate((e) => Math.ceil(e.getBoundingClientRect().height));
    await expect.poll(() => page.evaluate(() =>
      (window as unknown as { heights?: number[] }).heights?.at(-1)))
      .toBe(inner);
    expect(await page.locator("#f").evaluate((f) =>
      f.getBoundingClientRect().height)).toBe(inner);
    // (no margin, a transparent page)
    expect(await frame.locator("body").evaluate((b) => [
      getComputedStyle(b).margin, getComputedStyle(b).backgroundColor]))
      .toEqual(["0px", "rgba(0, 0, 0, 0)"]);
    expect(await frame.locator(".view-head").first().evaluate((h) =>
      getComputedStyle(h).backgroundColor)).toBe("rgba(0, 0, 0, 0)");
  });
}

test("embed.html: moment=0 leaves the moment out", async ({ page }) => {
  await page.goto("./embed.html#scene=raw&moment=0");
  await expect(page.locator(".view")).toHaveCount(4);
  await expect(page.locator(".moment")).toHaveCount(0);
});
