// The code panel and the variables in scope (addendum §6), in the
// developers' harness (lenses/stepper-dev.tsx): bug-O0's run, made in
// the page, at a trace step of alice's third hit; expected values from
// memory.json and from the memory section, which shows the same moments
import type { Page } from "@playwright/test";
import fs from "node:fs";
import { test, expect, ready } from "../../page";
import { pick } from "../../pick";

const memory = JSON.parse(fs.readFileSync(
  "../demos/inspector/fixtures/memory.json", "utf8"));
const O0 = memory.levels[0];
const pause = (id: string) => O0.points.find((p: { id: string }) =>
  p.id === id).steps as { step: number; range?: { offset: number;
    length: number } }[];
const source: string = memory.program.source;

const open = async (page: Page, step: number) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`./shell.html#lens=stepper-dev&dev=1&step=${step}`);
  await expect(page.locator("#svars li[data-path]").first()).toBeVisible();
};
const go = async (page: Page, step: number) => {
  await page.locator("[data-stepper-step]").fill(String(step));
  await expect(page).toHaveURL(new RegExp(`step=${step}(&|$)`));
};
// the text the code panel marks, and how (muted: the last range)
const marked = (page: Page) => page.locator("#scode").evaluate((c) => {
  const ms = [...c.querySelectorAll("mark.rng")];
  return { text: ms.map((m) => m.textContent).join(""),
    last: ms.some((m) => m.classList.contains("last")) };
});
// a byte range of the source, as the panel shows it (lines apart)
const slice = (r: { offset: number; length: number }) => Buffer.from(
  source, "utf8").subarray(r.offset, r.offset + r.length).toString("utf8")
  .replace(/\n/g, "");

test("the code panel marks the moment's range (memory.json's), and " +
  "scrolls only its own box", async ({ page }) => {
  // (memory.json's state is after its trace step: the next moment)
  const [, mult] = pause("mult");
  const [writes] = pause("writes");
  await open(page, mult.step + 1);
  await expect.poll(() => marked(page))
    .toEqual({ text: slice(mult.range!), last: false });
  const box = () => page.locator("#scode").boundingBox();
  const before = await box();
  await go(page, writes.step + 1);
  await expect.poll(() => marked(page))
    .toEqual({ text: slice(writes.range!), last: false });
  const v = await page.locator("#scode pre").evaluate((pre) => {
    const m = pre.querySelector("mark.rng")!.getBoundingClientRect();
    const b = pre.getBoundingClientRect();
    return { scrolled: pre.scrollTop, inside: m.top >= b.top &&
      m.bottom <= b.bottom, page: scrollY };
  });
  expect(v).toEqual({ scrolled: expect.any(Number), inside: true,
    page: 0 });
  expect(v.scrolled).toBeGreaterThan(0);
  // (mute, don't move: the panel's box is the same at every moment)
  expect(await box()).toEqual(before);
});

test("a trace step with no range: the last one, muted", async ({ page }) => {
  // (memory.json's "mult" pause: its JUMPDEST's context has no code)
  const [first] = pause("mult");
  expect(first.range).toBeUndefined();
  await open(page, first.step + 1);
  await expect.poll(async () => (await marked(page)).last).toBe(true);
  await expect(page.locator("#scode .codenote")).toHaveText(/muted/);
});

test("the locals; hovering one lights its memory bytes, the memory " +
  "section's for the same moment", async ({ page }) => {
  const [, mult] = pause("mult");
  // (the memory section: O0, the "mult" pause, after the trace step)
  await ready(page, { width: 1280, memory: true });
  await page.locator('#mlevel button[data-opt="0"]').click();
  await page.locator('#mpoint button[data-id="mult"]').click();
  const lit = (sel: string) => page.locator(sel).evaluateAll((bs) =>
    bs.map((b) => `${(b.closest(".word") as HTMLElement).dataset.slot} ${
      (b as HTMLElement).dataset.i}`).sort());
  // (what it lights for points: its bytes, and the frame pointer its
  // pointer reads)
  await pick(page.locator('#mtree li[data-path="points"] > .row'));
  const want = await lit("#mpanel .view[data-side=after] .b.hl");
  expect(want.length).toBeGreaterThan(8);
  await open(page, mult.step + 1);
  const names = await page.locator("#svars li[data-path] > .row .name")
    .allTextContents();
  expect(names).toEqual(["points", "combo", "mult"]);
  await page.locator('#svars li[data-path="points"] > .row').hover();
  await expect.poll(() => lit("#smemory .b.hl")).toEqual(want);
});
