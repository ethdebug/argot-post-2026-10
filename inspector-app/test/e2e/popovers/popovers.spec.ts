// Mirrors bin/run.mjs's dump checks (vanilla d235617): popovers, the
// pointed-at run in both views, gutters, root-slot tint, one line
import type { Page } from "@playwright/test";
import { test, expect, ready, select } from "../../page";
import { A, B } from "../../expect";

const pops = (page: Page) => page.locator(
  "#panel .view[data-side=after] .pop").allInnerTexts();
const SLOT2 = "0x" + "2".padStart(64, "0");
// (pitfall-nesting, nothing selected: every value shown; the pointer
// moved, so a hover shows again after the Escape that cleared it)
const rest = async (page: Page) => {
  await ready(page);
  await select(page, null);
  await page.mouse.move(40, 1, { steps: 4 });
  await page.mouse.move(1, 1, { steps: 4 });
};

test("a value's popover: how : what",
  async ({ page }) => {
    await rest(page);
    await page.locator('#tree li[data-path="totalHits"] > .row').hover();
    await expect.poll(() => pops(page))
      .toEqual(["slot 2 : (unmapped) · totalHits · totalScore"]);
    await page.locator(`#panel .word[data-side=after][data-slot="${
      SLOT2}"] .b[data-i="31"]`).hover();
    await expect.poll(() => pops(page))
      .toEqual(["slot 2 : (unmapped) · totalHits · totalScore"]);
  });

test("a byte pointed at: its run outlined",
  async ({ page }) => {
    await rest(page);
    for (const [from, to] of [["after", "after"]]) {
      await page.locator(`#panel .word[data-side="${from}"][data-slot="${
        SLOT2}"] .b[data-i="14"]`).hover();
      const at = await page.evaluate(() => {
        const out: Record<string, number[]> = {};
        for (const c of document.querySelectorAll<HTMLElement>(
          "#panel .b.at:not(.cmp *)")) {
          (out[(c.closest(".word") as HTMLElement).dataset.side!] ??= [])
            .push(+c.dataset.i!);
        }
        return out;
      });
      const want = [8, 9, 10, 11, 12, 13, 14, 15];
      expect(at[from]).toEqual(want);
      expect(at[to]).toEqual(want);
      await expect(page.locator(`#panel .word[data-side="${to}"] .b.hl`))
        .not.toHaveCount(0);
    }
  });

test("popovers: black; a badge only for what is lit; one line, inside "
  + "the dump", async ({ page }) => {
  await ready(page);
  const popOf = (how: string) => page.evaluate((h) => {
    const pop = [...document.querySelectorAll<HTMLElement>(
      "#panel .view[data-side=after] .pop")].find((p) =>
      p.querySelector(".phow")?.textContent === h);
    if (!pop) return null;
    const kids = [...pop.querySelector(".pwhat")?.children ?? []];
    return { bg: getComputedStyle(pop).backgroundColor,
      text: pop.textContent,
      parts: kids.map((k) => k.classList.contains("pcut") ? "…"
        : k.classList.contains("pbadge") ? `[${k.textContent}]`
          : k.textContent),
      over: pop.querySelector(".pop-how")!.scrollWidth >
        pop.getBoundingClientRect().width + 4,
      out: pop.getBoundingClientRect().right >
        pop.closest(".dump")!.getBoundingClientRect().right - 8,
      tall: pop.getBoundingClientRect().height >
        parseFloat(getComputedStyle(pop).lineHeight) * 1.4 + 4 };
  }, how);
  await select(page, `${A}.score`);
  await page.mouse.move(1, 1);
  const sc = await popOf("keccak(0x7099…79c8, slot 3)");
  expect(sc!.parts.at(-1)).toBe("[score]");
  const black = await page.evaluate(() =>
    getComputedStyle(document.body).color);
  expect(sc!.bg).toBe(black);
  await select(page, "players");
  await page.mouse.move(1, 1);
  const pl = await popOf("keccak(0x90f7…b906, slot 3)");
  expect(pl!.parts).toEqual(["[players[0x90f7…b906]]"]);
  for (const wd of [1280, 1440, 1920, 659]) {
    await page.setViewportSize({ width: wd, height: 900 });
    await select(page, A);
    await page.mouse.move(1, 1);
    // (the related view: the record by its name, over its two slots)
    await expect.poll(() => popOf("keccak(0x7099…79c8, slot 3)")
      .then((x) => x?.parts)).toEqual(["[players[0x7099…79c8]]"]);
    const x = (await popOf("keccak(0x7099…79c8, slot 3)"))!;
    expect(x.text!.endsWith(", 2 slots"), `${wd}: ${x.text}`).toBe(true);
    expect([x.over, x.out, x.tall], `${wd}: ${x.text}`)
      .toEqual([false, false, false]);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  // (bob's name's bytes pointed at: `name` a badge, its length plain)
  await select(page, null);
  await page.locator(
    `#panel .view[data-side=after] .b[data-owners="${B}.name"]`).first()
    .hover();
  const bn = await page.evaluate(() => [...document.querySelectorAll(
    "#panel .view[data-side=after] .pop .pname")].map((n) => `${
    n.textContent}${n.classList.contains("pbadge") ? "*" : ""}`).join());
  expect(bn).toMatch(/(^|,)name\*/);
  expect(bn).toMatch(/name\.length(,|$)/);
});

test("a selection inside a mapping tints its root slot's gutter",
  async ({ page }) => {
    await ready(page);
    const r3 = `#panel .view[data-side=after] .wrow[data-slot="0x${
      "0".repeat(63)}3"]`;
    for (const x of [A, `${B}.plays`]) {
      await select(page, x);
      await page.mouse.move(1, 1);
      await expect(page.locator(`${r3}.gut`)).toHaveCount(1);
      await expect(page.locator(`${r3} .pop`)).toHaveCount(1);
      await expect(page.locator(`${r3} .b.hl`)).toHaveCount(0);
    }
  });

test("a gutter address outlines its word; the dump fits the row",
  async ({ page }) => {
    await rest(page);
    await page.locator(`#panel .view[data-side=after] .wrow[data-slot="${
      SLOT2}"] > .addr`).hover();
    await expect(page.locator(`#panel .view[data-side=after] .wrow[data-slot="${
      SLOT2}"] .b.at`)).toHaveCount(32);
    const fits = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(
        "#panel .view[data-side=after] .rows > .run > .wrow")!;
      const d = row.closest(".dump")!.getBoundingClientRect();
      return row.querySelector(".word")!.getBoundingClientRect().right <=
        d.right + 1;
    });
    expect(fits).toBe(true);
  });

// (a selection in the related view shows its own rows: only a hover is
// checked here)
test("hovering moves nothing", async ({ page }) => {
  await ready(page);
  // (in the page's coordinates: pointing may scroll the window)
  const boxes = () => page.locator(
    "#panel .view[data-side=after] .wrow:not(.cmp *), #tree .row")
    .evaluateAll((es) => es.map((e) => {
      const r = e.getBoundingClientRect();
      return [r.left + scrollX, r.top + scrollY, r.width, r.height]
        .map(Math.round).join();
    }));
  await page.mouse.move(1, 1);
  // (at rest: the same boxes twice)
  let was = await boxes();
  await expect.poll(async () => {
    const before = was;
    was = await boxes();
    return JSON.stringify(was) === JSON.stringify(before);
  }).toBe(true);
  await page.locator(`#panel .view[data-side=after] .b[data-owners="${A}.plays"]`)
    .first().hover();
  await expect.poll(boxes).toEqual(was);
  await page.locator(`#tree li[data-path="${A}.combo"] > .row`).hover();
  await expect.poll(boxes).toEqual(was);
});

test("popovers scale with the dump; the arrow's tip on its address",
  async ({ page }) => {
    const seen: { wd: number; ratio: number; gaps: number[] }[] = [];
    for (const wd of [1280, 1440, 1920, 760, 390]) {
      await ready(page, { width: wd });
      await select(page, "playerList");
      await page.mouse.move(1, 1);
      await expect(page.locator("#panel .view[data-side=after] .pop").first())
        .toBeAttached();
      seen.push({ wd, ...await page.evaluate(() => {
        const views = document.querySelector("#panel .views")!;
        const pops = [...document.querySelectorAll<HTMLElement>(
          "#panel .view[data-side=after] .pop")];
        const ratio = parseFloat(getComputedStyle(pops[0]).fontSize) /
          parseFloat(getComputedStyle(views).fontSize);
        // (the tip: the arrow's far corner, a square turned 45°)
        const gaps = pops.map((p) => {
          const a = p.parentElement!.getBoundingClientRect();
          const bf = getComputedStyle(p.parentElement!, "::before");
          const o = getComputedStyle(p, "::after");
          const r = p.getBoundingClientRect();
          const aw = parseFloat(o.width);
          const under = p.classList.contains("under");
          const tip = under ? r.top - aw * Math.SQRT1_2
            : r.bottom + aw * Math.SQRT1_2;
          const edge = under ? a.bottom - (parseFloat(bf.bottom) || 0)
            : a.top + (parseFloat(bf.top) || 0);
          return Math.round((under ? edge - tip : tip - edge) * 2) / 2;
        });
        return { ratio, gaps };
      }) });
    }
    const r0 = seen[0].ratio;
    for (const s of seen) {
      expect(Math.abs(s.ratio / r0 - 1), `${s.wd}`).toBeLessThan(0.02);
      for (const g of s.gaps) expect(Math.abs(g), `${s.wd}`).toBeLessThan(2);
    }
  });

test("slot 0's popover: under row 0, inside the dump, never empty",
  async ({ page }) => {
    for (const wd of [1280, 390]) {
      await ready(page, { width: wd });
      await select(page, "playerList");
      await page.mouse.move(1, 1);
      const x = await page.evaluate(() => {
        const row = [...document.querySelectorAll<HTMLElement>(
          "#panel .view[data-side=after] .rows > .run > .wrow")].find((r) =>
          r.dataset.slot === "0x" + "0".repeat(64))!;
        const pop = row.querySelector<HTMLElement>(".pop")!;
        const p = pop.getBoundingClientRect();
        const rows = row.closest(".rows")!.getBoundingClientRect();
        return { under: pop.classList.contains("under"),
          text: pop.textContent, inside: p.top >= rows.top - 1 &&
            p.bottom <= rows.bottom + 1,
          belowRow: p.top >= row.getBoundingClientRect().top };
      });
      expect(x, `${wd}`).toEqual({ under: true, text: "slot 0 : length",
        inside: true, belowRow: true });
    }
    // (and nothing outside the dump box: no popover over the ruler)
    const out = await page.evaluate(() => {
      const box = document.querySelector("#panel")!.closest(".dump")!
        .getBoundingClientRect();
      return [...document.querySelectorAll("#panel .pop")].filter((p) => {
        const r = p.getBoundingClientRect();
        return r.top < box.top - 1 || r.bottom > box.bottom + 1 ||
          !p.textContent?.trim();
      }).length;
    });
    expect(out).toBe(0);
  });

test("at rest: no popover, nothing steps back, the dump only hex",
  async ({ page }) => {
    await rest(page);
    await page.mouse.move(1, 1);
    expect(await pops(page)).toEqual([]);
    await expect(page.locator("#panel.active, #tree.active")).toHaveCount(0);
    // (names live in the tree)
    expect((await page.locator("#panel .rows").allInnerTexts()).join(" ")
      .replace(/0x|[0-9a-f…⋯\s]/g, "")).toBe("");
  });

test("an address focused from the keyboard shows its popover",
  async ({ page }) => {
    await rest(page);
    const addr = page.locator(
      '#panel .view[data-side=after] .wrow [tabindex]').first();
    // (in view first: a scroll after the focus would move the pointer)
    await addr.scrollIntoViewIfNeeded();
    await page.mouse.move(1, 1);
    await addr.focus();
    expect(await pops(page)).toHaveLength(1);
  });

test("no popover covers a lit byte, another row's address, or another "
  + "popover", async ({ page }) => {
  await ready(page);
  for (const sel of ["players", "playerList[1]", A, "motd"]) {
    await select(page, sel);
    await page.mouse.move(1, 1);
    const cover = await page.evaluate(() => {
      const v = document.querySelector("#panel .view[data-side=after]")!;
      const hit = (a: DOMRect, b: DOMRect) => a.left < b.right - 0.5 &&
        b.left < a.right - 0.5 && a.top < b.bottom - 0.5 &&
        b.top < a.bottom - 0.5;
      const ps = [...v.querySelectorAll(".pop")];
      const out: string[] = [];
      ps.forEach((p, i) => {
        const r = p.getBoundingClientRect();
        const own = p.closest(".wrow");
        for (const e of v.querySelectorAll(
          ".rows > .run > .wrow.on > .addr .a, " +
          ".rows > .run > .wrow > .word .b.hl")) {
          if (e.closest(".wrow") !== own &&
            hit(r, e.getBoundingClientRect())) {
            out.push(`${p.textContent!.slice(0, 24)} on ${e.textContent}`);
          }
        }
        for (const q of ps.slice(i + 1)) {
          if (hit(r, q.getBoundingClientRect())) {
            out.push(`${p.textContent!.slice(0, 24)} on a popover`);
          }
        }
      });
      return out;
    });
    expect(cover, sel).toEqual([]);
  }
});
