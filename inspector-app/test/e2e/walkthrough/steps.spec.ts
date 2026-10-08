// Mirrors bin/run.mjs's walkthrough checks (vanilla 8d2d944), with the
// decided rule its run.mjs does not have yet: instances named by their
// on-chain `name` values, quoted
import type { Page } from "@playwright/test";
import { test, expect, ready, select, row } from "../../page";
import { A, B, C, NAME_C } from "../../expect";

const CAROL = `"${NAME_C}"`;
const range = (a: number, b: number) =>
  Array.from({ length: b - a + 1 }, (_, i) => a + i).join();
const stepNow = (page: Page) => page.evaluate(() => {
  const box = (q: string) => {
    const r = document.querySelector(q)?.getBoundingClientRect();
    return r && [r.left, r.top, r.width, r.height].map(Math.round).join();
  };
  return {
    cap: document.querySelector("#details .rcount")?.textContent
      ? document.querySelector("#details .rcap")?.textContent!.trim() : null,
    form: document.querySelector("#dtext .rform")?.textContent!.trim(),
    // (the step's construct: one axis for every step)
    kind: document.querySelector("#details .rkind b")?.textContent,
    count: document.querySelector("#details .rcount")?.textContent ||
      undefined,
    resolved: !!document.querySelector('#details button[data-r="start"]'),
    ctl: box("#details .rctl"),
    // (the dots of the steps after step 0: done, current or later)
    chips: [...document.querySelectorAll("#dots .dot[data-n]")].map((c) =>
      c.className.replace("dot ", "")).join(),
    ptr: [...document.querySelectorAll("#ptr .line.on")].map((l) =>
      l.textContent!.trim()),
    band0: [...document.querySelectorAll("#ptr .line")].findIndex((l) =>
      l.classList.contains("on")),
    lit: [...document.querySelectorAll<HTMLElement>(
      "#panel .view:not([hidden]) .rows .word .b.hl")].map((c) =>
      `${(c.closest(".wrow") as HTMLElement).dataset.slot} ${c.dataset.i}`),
    full: [...document.querySelectorAll<HTMLElement>(
      "#panel .view:not([hidden]) .rows .word .b.hl:not(.muted)")].map((c) =>
      `${(c.closest(".wrow") as HTMLElement).dataset.slot} ${c.dataset.i}`),
    gut: [...document.querySelectorAll<HTMLElement>(
      "#panel .view:not([hidden]) .wrow.gut")].map((r) => r.dataset.slot!),
    // (whole slots a step computes: outlined, not lit)
    whole: [...document.querySelectorAll<HTMLElement>(
      "#panel .view:not([hidden]) .wrow.whole")].map((r) => r.dataset.slot!),
    dim: document.querySelector("#panel")!.classList.contains("active"),
  };
});
type St = Awaited<ReturnType<typeof stepNow>>;
const names = (page: Page) => page.locator(
  '#panel .view[data-side="after"] .wrow[data-name]').evaluateAll((rs) =>
  Object.fromEntries(rs.map((r) => [(r as HTMLElement).dataset.slot,
    (r as HTMLElement).dataset.name])));
const litNamed = (xs: string[], nm: Record<string, string>) => {
  const by: Record<string, number[]> = {};
  for (const x of xs) {
    const [sl, i] = x.split(" ");
    (by[nm[sl] ?? sl] ??= []).push(+i);
  }
  return Object.fromEntries(Object.entries(by).map(([k, v]) =>
    [k, v.length === 32 ? "all" : v.join()]));
};
// walk a walkthrough: step 0 kept aside, each step, the controls
async function walk(page: Page, path: string) {
  const nm = await names(page);
  await row(page, path).click();
  await page.mouse.move(1, 1);
  await page.locator('#details button[data-r="start"]').click();
  const out: (St & { litN: Record<string, string>;
    fullN: Record<string, string>; gutN: string[]; wholeN: string[] })[]
    = [];
  const ctl = new Set<string | undefined>();
  let goal: (St & { litN: Record<string, string> }) | undefined;
  const g = await stepNow(page);
  if (g.count === "start") {
    goal = { ...g, litN: litNamed(g.lit, nm) };
    ctl.add(g.ctl);
    await page.locator('#details button[data-r="next"]').click();
  }
  for (let k = 0; k < 20; k++) {
    const x = await stepNow(page);
    ctl.add(x.ctl);
    out.push({ ...x, litN: litNamed(x.lit, nm),
      fullN: litNamed(x.full, nm), gutN: x.gut.map((sl) => nm[sl] ?? sl),
      wholeN: x.whole.map((sl) => nm[sl] ?? sl) });
    if (await page.locator('#details button[data-r="next"]').isDisabled()) {
      break;
    }
    await page.locator('#details button[data-r="next"]').click();
  }
  await page.locator('#details button[data-r="exit"]').click();
  // (the controls' place while stepping; not after Exit, which takes the
  // page back to where the reader pressed Start, the bar with it)
  // (the last step, "found", kept aside: "done"; the counts are the
  // rule steps')
  let found: St | undefined;
  if (out.at(-1)?.cap?.startsWith("That's ")) found = out.pop();
  return { steps: out, goal, ctl: ctl.size, found };
}
const down = (ws: St[]) => ws.map((x) => x.band0).filter((b) => b >= 0)
  .every((b, i, a) => !i || b >= a[i - 1]);
const al = "keccak(0x7099…79c8, slot 3)";
const rec = "keccak(0x3c44…93bc, slot 3)";
const cl0 = "keccak(0x90f7…b906, slot 3)";
const cdata = `keccak(${cl0} + 1)`;

test("players: step 0 and ten steps, their light, bands and chips",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", null);
    const { steps: w, goal, ctl } = await walk(page, "players");
    const playerList = { "keccak(slot 0)": range(12, 31),
      "keccak(slot 0) + 1": range(12, 31),
      "keccak(slot 0) + 2": range(12, 31) };
    const rows3 = [al, rec, cl0];
    // (cap, lit, a line of the band, the gutters, the slots outlined)
    const want: [string, Record<string, string>, string | null,
      string[], string[]][] = [
      ["The keys: a mapping does not store its keys; the page takes them "
        + "from playerList", playerList, null, [], []],
      ["players is declared at slot 3; that slot holds nothing", {},
        "slot: 0x03", ["slot 3"], []],
      ["The template mapping(address => Player) takes slot and key", {},
        "expect: [slot, key]", ["slot 3"], []],
      // (a define into a template: the slots it computes, lit whole in
      // their entries' colours, as a region is; the template it enters,
      // in the same step)
      ["Each record is at keccak(key, slot 3); the template Player takes "
        + "it as its slot", { [al]: "all", [rec]: "all", [cl0]: "all" }, "~keccak256", [], []],
      ["The first slot packs six fields, from the right",
        { [al]: "all", [rec]: "all", [cl0]: "all" }, "name: score", [], []],
      ["name is in the next slot, slot + 1; the template string takes it",
        { [`${al} + 1`]: "all", [`${rec} + 1`]: "all", [`${cl0} + 1`]: "all" }, "~sum: [slot, 0x01]", [], []],
      ["The last byte of each name slot is its length flag",
        { [`${al} + 1`]: "31", [`${rec} + 1`]: "31", [`${cl0} + 1`]: "31" },
        "name: length-flag", [], []],
      ["The last byte decides the form: even → short (alice, bob), odd → "
        + "long (carol)", { [`${al} + 1`]: "31",
        [`${rec} + 1`]: "31", [`${cl0} + 1`]: "all" }, "else:", [], []],
      ["Each short text is in its slot, from the left", {
        [`${al} + 1`]: "0,1,2,3,4", [`${rec} + 1`]: "0,1,2" },
        "in: { name: data", [], []],
      ["The text starts at keccak(slot …9979) = …c248: 34 bytes over 2 slots",
        { [cdata]: "all", [`${cdata} + 1`]: "0,1" }, "start: { ~keccak256",
        [], []],
    ];
    const N = want.length;
    expect([w.length, ctl]).toEqual([N, 1]);
    expect(down(w)).toBe(true);
    want.forEach(([cap, lit, ptr, gut, whole], k) => {
      const x = w[k];
      expect(x.cap!.startsWith(cap), `${k + 1}: ${x.cap}`).toBe(true);
      expect(x.litN, `${k + 1} lit`).toEqual(lit);
      expect(x.fullN, `${k + 1} full`).toEqual(lit);
      expect(x.dim).toBe(true);
      expect(x.count).toBe(`${k + 1} / ${N}`);
      expect(x.kind).toBeTruthy();
      expect([...x.gutN].sort(), `${k + 1} gut`).toEqual([...gut].sort());
      expect([...x.wholeN].sort(), `${k + 1} whole`)
        .toEqual([...whole].sort());
      if (ptr) {
        expect(x.ptr.some((l) => l.includes(ptr)), `${k + 1}: ${x.ptr}`)
          .toBe(true);
      } else expect(x.ptr).toEqual([]);
      // (and the found step's chip, last)
      expect(x.chips).toBe([...want, null].map((_, j) => j < k ? "done"
        : j === k ? "cur" : "later").join());
    });
    // step 0: every slot touched, whole, yellow; no labels, no band
    expect(goal?.count).toBe("start");
    expect(Object.values(goal!.litN).every((v) => v === "all")).toBe(true);
    expect(Object.keys(goal!.litN).length).toBeGreaterThanOrEqual(9);
    // the record's step: its define, then the template it enters, whose
    // frame ends the band; the next starts inside that template
    expect(w[3].ptr.slice(-3).join("|")).toBe("Player:|expect: [slot]|for:");
    expect(w[4].ptr[0].startsWith("- name: score")).toBe(true);
    for (const x of ["alice (0x7099…79c8)→[0]", "bob (0x3c44…93bc)→[1]",
      "carol (0x90f7…b906)→[2]"]) expect(w[0].form).toContain(x);
    expect(w[3].form).toContain("keccak(alice, slot 3) = …aa80");
    expect(w[7].form).toContain("even: 0x0a → 5 bytes inline");
    expect(w[7].form).toContain("odd: 0x45 → 34 bytes at keccak(slot …9979)");
  });

test("step 0: no labels, no band; ⏮ and ◀ reach it; a re-target keeps it",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", "players");
    await page.locator('#details button[data-r="start"]').click();
    await page.mouse.move(1, 1);
    expect(await page.evaluate(() => ({
      pops: document.querySelectorAll("#panel .view:not([hidden]) .pop")
        .length,
      hues: [...document.querySelectorAll(
        "#panel .view:not([hidden]) .b.hl")].filter((b) =>
        /\bpk\d/.test(b.className)).length,
      band: document.querySelectorAll("#ptr .line.on").length,
      cur: document.querySelectorAll("#dots .dot[data-n].cur").length })))
      .toEqual({ pops: 0, hues: 0, band: 0, cur: 0 });
    await page.locator('#details button[data-r="next"]').click();
    await page.locator('#details button[data-r="prev"]').click();
    // (the bar counts the found step too)
    expect((await stepNow(page)).count).toBe("start");
    await page.locator('#dots .dot:last-child').click();
    expect((await stepNow(page)).count).toBe("done");
    await page.locator('#dots .dot:first-child').click();
    expect((await stepNow(page)).count).toBe("start");
    await row(page, C).click();
    expect((await stepNow(page)).count).toBe("start");
    await page.keyboard.press("Escape");
    await select(page, "mid", null);
    const t = await walk(page, "totalScore");
    expect([t.goal, t.steps[0].count]).toEqual([undefined, "1 / 1"]);
  });

test("carol's record: eleven steps; bob's plays and carol's name",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", null);
    const cw = (await walk(page, C)).steps;
    const cwant: [string, Record<string, string>, string[], string,
      string[]][] = [
      ["The key: carol's address. A mapping does not store its keys; the " +
        "page takes it from playerList[2]",
        { "keccak(slot 0) + 2": range(12, 31) }, [], "", []],
      ["players is declared at slot 3", {}, ["slot 3"], "slot: 0x03", []],
      ["The template mapping(address => Player) takes slot and key", {},
        ["slot 3"], "expect: [slot, key]", []],
      ["The record is at keccak(key, slot 3); the template Player takes it",
        { [cl0]: "all" }, [], "~keccak256", []],
      ["The first slot packs six fields", { [cl0]: "all" }, [],
        "name: lastBlock", []],
      ["name is in the next slot, slot + 1", { [`${cl0} + 1`]: "all" }, [],
        "template: string", []],
      ["The last byte of name's slot is its length flag",
        { [`${cl0} + 1`]: "31" }, [], "name: length-flag", []],
      ["Odd → long: the slot holds 2 × length + 1, so length = 34",
        { [`${cl0} + 1`]: "all" }, [], "long-length", []],
      ["The text starts at keccak(slot …9979) = …c248: 34 bytes over 2 slots",
        { [cdata]: "all", [`${cdata} + 1`]: "0,1" }, [], "name: data", []]];
    expect(cw.length).toBe(9);
    expect(down(cw)).toBe(true);
    cwant.forEach(([cap, lit, gut, band, whole], k) => {
      expect(cw[k].cap!.startsWith(cap), `${k + 1}: ${cw[k].cap}`)
        .toBe(true);
      expect(cw[k].litN, `${k + 1}`).toEqual(lit);
      expect(cw[k].gutN.join(), `${k + 1}`).toBe(gut.join());
      expect(cw[k].wholeN.join(), `${k + 1}`).toBe(whole.join());
      if (band) expect(cw[k].ptr.some((l) => l.includes(band))).toBe(true);
      else expect(cw[k].ptr).toEqual([]);
    });
    await select(page, "mid", null);
    const bw = await walk(page, `${B}.plays`);
    expect(bw.steps.map((x) => x.cap!.split(" ")[1]).join())
      .toBe("key:,is,template,record,is");
    expect(bw.steps[0].form).toContain("bob (0x3c44…93bc)");
    expect(bw.steps[4].litN).toEqual({ [rec]: range(12, 15) });
    expect(bw.ctl).toBe(1);
    const st = await stepNow(page);
    expect(st.resolved).toBe(true);
    await select(page, "mid", null);
    const nw = await walk(page, `${C}.name`);
    expect(nw.steps.map((x) => x.cap!.split(" ")[1]).join())
      .toBe("key:,is,template,record,is,last,→,text");
  });

// (the review's redesign: one title, ◀ ▶, the place, the steps as dots,
// the step's one wording; ⏮ ⏭ are Home and End and the dots)
test("the bar: entry, title, ◀ ▶ at the ends, the place, dots, keys, Exit",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", null);
    await row(page, `${B}.plays`).click();
    const barNow = () => page.evaluate(() => {
      const b = document.querySelector("#details")!;
      const dis = (r: string) => b.querySelector<HTMLButtonElement>(
        `button[data-r="${r}"]`)?.disabled;
      return { tint: b.classList.contains("replaying"),
        title: b.querySelector(".rtitle")?.textContent ?? "",
        count: b.querySelector(".rcount")?.textContent ?? "",
        off: ["prev", "next"].filter(dis).join(),
        dots: b.querySelectorAll(".dot").length,
        exit: !!b.querySelector('button[data-r="exit"]'),
        start: b.querySelector('button[data-r="start"]')?.textContent };
    });
    let bs = await barNow();
    expect(bs).toMatchObject({ tint: false, title: "", exit: false,
      start: "▶ How it was found" });
    await page.locator('#details button[data-r="start"]').dblclick();
    bs = await barNow();
    // (the title names the key by name, not by address)
    expect(bs).toMatchObject({ tint: true,
      title: "How the pointer finds players[bob].plays", count: "1 / 5",
      off: "prev", dots: 6, exit: true });
    await page.locator("#dots .dot:last-child").click();
    expect(await barNow()).toMatchObject({ count: "done", off: "next" });
    await page.keyboard.press("ArrowRight");
    expect((await barNow()).count).toBe("done");
    await page.locator("#dots .dot:first-child").click();
    expect((await barNow()).count).toBe("1 / 5");
    await page.locator('#details button[data-r="next"]').click();
    await page.keyboard.press("ArrowRight");
    expect((await barNow()).count).toBe("3 / 5");
    await page.evaluate(() => (document.activeElement as HTMLElement)
      ?.blur());
    await page.keyboard.press("Home");
    expect((await barNow()).count).toBe("1 / 5");
    await page.keyboard.press("End");
    expect((await barNow()).count).toBe("done");
    // (a dot's caption, on hover and for the screen reader)
    expect(await page.locator('#dots .dot[data-n="1"]').getAttribute(
      "title")).toBe("players is declared at slot 3; that slot holds nothing");
    await page.locator('#details button[data-r="exit"]').click();
    expect((await barNow()).tint).toBe(false);
    await page.locator('#details button[data-r="start"]').click();
    await page.locator('#dots .dot[data-n="1"]').click();
    expect((await stepNow(page)).count).toBe("2 / 5");
    await page.locator("#details").focus();
    await page.keyboard.press("ArrowLeft");
    expect((await stepNow(page)).count).toBe("1 / 5");
    await page.keyboard.press("Escape");
    const st = await stepNow(page);
    expect(st.resolved).toBe(true);
    await expect(page.locator("#tree .row.sel")).toHaveCount(1);
  });

test("the focus: all by default for players; one entry echoes",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", "players");
    await page.locator('#details button[data-r="start"]').click();
    const btns = () => page.locator("#dpick button").evaluateAll((bs) =>
      bs.map((b) => `${b.textContent}${b.getAttribute("aria-pressed") ===
        "true" ? "*" : ""}`).join("|"));
    // (the picker only at the step it changes, the packed fields, its row
    // kept at the others; the players by the scene's names)
    const muted = [];
    const shown = [];
    for (let k = 0; k < 10; k++) {
      await page.locator(`#dots .dot[data-n="${k}"]`).dispatchEvent("click");
      muted.push(await page.locator(
        "#panel .view:not([hidden]) .b.hl.muted").count());
      shown.push((await btns()) ? k : -1);
    }
    expect(shown.filter((k) => k >= 0)).toEqual([4]);
    await page.locator('#dots .dot[data-n="4"]').dispatchEvent("click");
    expect(await btns()).toBe("all*|alice|bob|carol");
    expect(muted.some(Boolean)).toBe(false);
    await page.locator('#dots .dot[data-n="4"]').dispatchEvent("click");
    const boxes = () => page.evaluate(() => JSON.stringify([
      ...document.querySelectorAll("#details, #dpanel, #dpick button, " +
        "#dots .dot, #panel .view:not([hidden]) .wrow, #tree")].map((e) => {
      const r = e.getBoundingClientRect();
      return [r.left, r.top, r.width, r.height].map(Math.round);
    })));
    await page.mouse.move(1, 1);
    const b0 = await boxes();
    await page.locator("#dpick button", { hasText: "bob" }).click();
    await page.mouse.move(1, 1);
    expect(await boxes()).toBe(b0);
    expect(await page.locator("#panel .view:not([hidden]) .b.hl.muted")
      .count()).toBeGreaterThan(0);
    const x = await stepNow(page);
    expect(litNamed(x.full, await names(page))).toEqual({ [rec]: "all" });
    await page.keyboard.press("Escape");
  });

test("entries and fields never share a colour; found rows keep labels",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", "players");
    const huesAt = async (k: number) => {
      await page.locator('#details button[data-r="start"]').click();
      await page.locator(`#dots .dot[data-n="${k}"]`).dispatchEvent("click");
      await page.mouse.move(1, 1);
      const hs = await page.evaluate(() => [...new Set([...document
        .querySelectorAll("#panel .view:not([hidden]) .rows .b.hl:not(" +
          ".pksrc)")].map((c) => getComputedStyle(c).backgroundColor))]);
      await page.keyboard.press("Escape");
      return hs;
    };
    const entryHues = await huesAt(0);
    const fieldHues = await huesAt(4);
    expect(entryHues.length).toBe(3);
    expect(fieldHues.length).toBe(6);
    expect(fieldHues.some((x) => entryHues.includes(x))).toBe(false);
    // (the input step: playerList's items in their entries' colours)
    await page.locator('#details button[data-r="start"]').click();
    await page.locator('#dots .dot[data-n="0"]').dispatchEvent("click");
    const col = (ps: string[]) => page.evaluate((x) => x.map((p) =>
      document.querySelector(`#tree li[data-path="${p}"] > .row`)
        ?.className.match(/pk\d/)?.[0]), ps);
    const ks = await col(["playerList[0]", "playerList[1]", "playerList[2]"]);
    await page.locator('#dots .dot[data-n="3"]').dispatchEvent("click");
    const es = await col([A, B, C]);
    // (the record's step: their tree rows in their entries' colours too,
    // as the slots it outlines)
    expect(ks.every((k, i) => k && k === es[i])).toBe(true);
    // (carol's data rows keep their labels only from her text's step)
    const labelled = () => page.evaluate(() => Object.fromEntries([
      ...document.querySelectorAll<HTMLElement>(
        "#panel .view:not([hidden]) .wrow[data-name]")].map((r) =>
      [r.dataset.name, r.querySelector(":scope > .addr")!.classList
        .contains("grp")])));
    await page.locator('#dots .dot[data-n="8"]').dispatchEvent("click");
    await page.mouse.move(1, 1);
    expect((await labelled())[cdata]).toBeFalsy();
    await page.locator('#dots .dot[data-n="9"]').dispatchEvent("click");
    await page.mouse.move(1, 1);
    expect((await labelled())[cdata]).toBe(true);
    await expect(page.locator("#panel .pop.kept")).not.toHaveCount(0);
    await page.locator('#details button[data-r="prev"]').click();
    await page.mouse.move(1, 1);
    expect((await labelled())[cdata]).toBeFalsy();
    await page.keyboard.press("Escape");
  });

test("footnotes link to the spec; the pointer as YAML, coloured",
  async ({ page }) => {
    await ready(page);
    await select(page, "mid", "players");
    await page.locator('#details button[data-r="start"]').click();
    const hrefs: string[] = [];
    for (let k = 0; k < 10; k++) {
      await page.locator(`#dots .dot[data-n="${k}"]`).dispatchEvent("click");
      hrefs.push(...await page.locator("#details .fnotes a").evaluateAll(
        (as) => as.map((a) => (a as HTMLAnchorElement).href)));
    }
    expect(hrefs.length).toBeGreaterThan(0);
    expect(hrefs.every((h) => h.startsWith(
      "https://ethdebug.github.io/format/spec/pointer/"))).toBe(true);
    await expect(page.locator("#ptr .line span[style]").first())
      .toBeAttached();
    const y = await page.evaluate(() => ({
      clipped: document.querySelector("#ptr")!.scrollWidth >
        document.querySelector("#ptr")!.clientWidth + 1,
      ids: document.querySelector("#ptr .pids")?.textContent ?? "" }));
    expect(y.clipped).toBe(false);
    expect(y.ids).toContain("t_array$");
    await page.keyboard.press("Escape");
  });

test("Vyper: Solidity's rule, then the misread: Vyper's own layout, "
  + "hand-written for comparison, not under the compiler's data",
  async ({ page }) => {
    await ready(page);
    await select(page, "vyper");
    await page.locator('#details button[data-r="start"]').click();
    await expect(page.locator("#details .rcount")).toHaveText("1 / 6");
    // (no list of Vyper's words in the box of the compiler's data)
    await expect(page.locator(".ptr ol.vyper, #ptr .howside"))
      .toHaveCount(0);
    await page.locator('#dots .dot:last-child').click();
    await page.mouse.move(1, 1);
    const cap = (await page.locator("#details .rcap").innerText())
      .replace(/\s+/g, " ");
    expect(cap).toContain("The misread: Vyper keeps players[alice].score " +
      "in slot …0446, where it is 30");
    expect(await page.locator("#details .rsrc").innerText()).toContain(
      "from: Vyper's layout, hand-written for comparison (Vyper emits no " +
      "ethdebug)");
    expect(await page.locator("#details .rcount").innerText()).toBe("done");
    // (Vyper's word, lit in its own colour, beside Solidity's reading)
    const lit = await page.evaluate(() => [...document.querySelectorAll(
      "#panel .view:not([hidden]) .b.hl.pk9")].map((c) =>
      (c.closest(".wrow") as HTMLElement).dataset.slot!.slice(-4)));
    expect([...new Set(lit)]).toEqual(["0446"]);
    // (carol, re-targeted: her Vyper words)
    // (re-targeted at the last step: it stays there)
    await row(page, `${C}.score`).click();
    expect(await page.locator("#details .rcap").innerText()).toContain(
      "where it is 100");
    await page.keyboard.press("Escape");
  });

// (vanilla 5c1edfa run.mjs: one line, 32 cells in four groups whose gaps
// match the dump's, each field's span over its own cells, at 1280, 1440)
test("the packed fields: a strip shaped like a dump row, the fields in "
  + "order over their cells", async ({ page }) => {
  for (const wd of [1280, 1440]) {
    await page.setViewportSize({ width: wd, height: 900 });
    await ready(page);
    await select(page, "mid", "players");
    await page.locator('#details button[data-r="start"]').click();
    await page.locator('#dots .dot[data-n="4"]').click();
    await expect(page.locator("#dtext .bstrip")).toBeAttached();
    const x = await page.evaluate(() => {
      const s = document.querySelector("#dtext .bstrip .bs32")!;
      const idx = [...s.querySelectorAll(".bsidx span")].map((e) =>
        e.getBoundingClientRect());
      // (equal steps from cell to cell, across the groups too: vanilla
      // 6767a25)
      const steps = idx.slice(1).map((q, i) => q.left - idx[i].left);
      const even = Math.max(...steps) - Math.min(...steps) < 1;
      const spans = [...s.querySelectorAll(".bsv")].map((v) => {
        const r = v.getBoundingClientRect();
        const a = idx.findIndex((q) => Math.abs(q.left - r.left) < 2);
        const b = idx.findIndex((q) => Math.abs(q.right - r.right) < 2);
        return `${v.textContent} ${a}-${b}`;
      });
      const rows = [...s.querySelectorAll<HTMLElement>(".bsv .bsn")]
        .every((n) => n.getClientRects().length === 1 &&
          n.scrollHeight <= n.clientHeight + 1);
      return { even, spans,
        rows, oneLine: s.querySelector(".bsrow")!.getBoundingClientRect()
          .height < parseFloat(getComputedStyle(s).fontSize) * 2 };
    });
    expect(x, `${wd}`).toEqual({ even: true, spans: ["lastBlock 0-7",
      "hits 8-11", "plays 12-15", "bestCombo 16-19", "combo 20-23",
      "score 24-31"], rows: true, oneLine: true });
    await page.keyboard.press("Escape");
  }
  // (a name too long for its span stands over it, whole, with a tick;
  // never cut to a letter: carol's one-byte length flag; vanilla 5ec2f00)
  await select(page, "mid", C);
  await page.locator('#details button[data-r="start"]').click();
  await page.locator('#dots .dot[data-n="6"]')
    .evaluate((e: HTMLElement) => e.click());
  await expect(page.locator("#dtext .bstrip .bs32 .bsl")).toBeAttached();
  const call = await page.evaluate(() => {
    const s = document.querySelector("#dtext .bstrip .bs32")!;
    const l = s.querySelector(".bsl");
    const v = s.querySelector(".bsv");
    const lr = l?.getBoundingClientRect();
    const vr = v?.getBoundingClientRect();
    return { text: l?.textContent, inside: !v?.textContent,
      over: !!lr && !!vr && lr.bottom <= vr.top && lr.right >= vr.left &&
        lr.left <= vr.right,
      cut: [...s.querySelectorAll<HTMLElement>(".bsn")].some((n) =>
        n.scrollWidth > n.clientWidth + 1) };
  });
  expect(call).toEqual({ text: "length-flag = 0x45", inside: true,
    over: true, cut: false });
});

test("stepping moves nothing; the details unfold only at entry and exit",
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await ready(page);
    await select(page, "mid", "players");
    await page.locator('#details button[data-r="start"]').click();
    const h = () => page.evaluate(() =>
      document.querySelector<HTMLElement>("#dwrap")!.offsetHeight);
    const early = await h();
    // (the page scrolls to the bar first, then the details unfold)
    await page.waitForTimeout(1500);
    const full = await h();
    expect(early).toBeLessThan(full);
    // (the panel sticks to the top of the view: its boxes on screen; the
    // rest on the page, which a step may scroll)
    const boxes = () => page.evaluate(() => JSON.stringify([
      ...[...document.querySelectorAll("#details, #dpanel, #dots")]
        .map((e) => {
          const r = e.getBoundingClientRect();
          return [r.left, r.top, r.width, r.height].map(Math.round);
        }),
      ...[...document.querySelectorAll(
        "#panel .view:not([hidden]) .wrow:not(.cmp *), #tree")].map((e) => {
        const r = e.getBoundingClientRect();
        return [r.left, r.top + scrollY, r.width, r.height].map(Math.round);
      })]));
    const b0 = await boxes();
    for (let k = 0; k < 6; k++) {
      await page.locator('#details button[data-r="next"]').click();
      expect(await boxes(), `step ${k + 1}`).toBe(b0);
    }
  });

test("every lit run has its popover at every step (not step 0, which has "
  + "no labels)", async ({ page }) => {
  await ready(page);
  const bare: string[] = [];
  for (const x of ["players", C]) {
    await select(page, "mid", x);
    await page.locator('#details button[data-r="start"]').click();
    for (let k = 0; k < 20; k++) {
      await page.mouse.move(1, 1);
      const goal = (await stepNow(page)).count === "start";
      // (a block of slots with a lit row: its label under or over it,
      // in one place for the whole walkthrough)
      const miss = await page.evaluate(() => {
        const out: HTMLElement[][] = [];
        let run: HTMLElement[] | null = null;
        for (const el of [...document.querySelector(
          "#panel .view:not([hidden]) .rows")!.children] as HTMLElement[]) {
          if (el.classList.contains("wrow")) {
            if (!run) out.push(run = []);
            run.push(el);
          } else if (!el.classList.contains("cmp")) run = null;
        }
        return out.filter((r) => r.some((e) => e.classList.contains("on")) &&
          !r.some((e) => e.querySelector(".pop")))
          .map((r) => r.find((e) => e.classList.contains("on"))!.dataset
            .slot!.slice(-4));
      });
      if (!goal && miss.length) bare.push(`${x.slice(0, 12)} ${k}: ${miss}`);
      const n = page.locator(
        '#details button[data-r="next"]:not([disabled])');
      if (!(await n.count())) break;
      await n.click();
    }
    await page.keyboard.press("Escape");
  }
  expect(bare).toEqual([]);
});

test("the pointer's box: no scrollbar; edge buttons where there is more; "
  + "blurred and still at step 0 (vanilla 00f6f8c)", async ({ page }) => {
  await ready(page);
  await select(page, "mid", "players");
  await page.locator('#details button[data-r="start"]').click();
  const pb = () => page.evaluate(() => {
    const p = document.querySelector<HTMLElement>("#ptr")!;
    return { bar: p.offsetWidth - p.clientWidth - 2 * p.clientLeft,
      top: p.scrollTop, up: document.querySelector(".pedge.up")!.classList
        .contains("on"), down: document.querySelector(".pedge.down")!
        .classList.contains("on"), blur: getComputedStyle(p.querySelector(
        ".ptrlines")!).filter, head: document.querySelector(".ptr .plabel")!
        .textContent! };
  });
  await page.locator("#ptr").hover();
  await page.mouse.wheel(0, 300);
  await page.waitForTimeout(150);
  const z = await pb();
  await page.locator('#details button[data-r="next"]').click();
  await page.waitForTimeout(100);
  const o = await pb();
  if (o.down) await page.locator("#pedge-down").click();
  await page.waitForTimeout(200);
  const d = await pb();
  await page.keyboard.press("Escape");
  expect(z).toMatchObject({ bar: 0, top: 0, up: false, down: false });
  expect(z.blur).toMatch(/blur/);
  expect(z.head.startsWith("Ethdebug data from the compiler")).toBe(true);
  expect([o.blur, o.down, o.up]).toEqual(["none", true, false]);
  expect(d.top).toBeGreaterThan(o.top);
  expect(d.up).toBe(true);
});

test("a step's own gutter rows keep a dark label (not muted, not dropped)",
  async ({ page }) => {
    await ready(page);
    const bad: string[] = [];
    for (const x of [C, "motd", "players"]) {
      await select(page, "mid", x);
      await page.locator('#details button[data-r="start"]').click();
      for (let k = 0; k < 20; k++) {
        await page.mouse.move(1, 1);
        const goal = (await stepNow(page)).count === "start";
        const miss = await page.evaluate(() => {
          // (runs of gutter rows; each has one label, on a row of it)
          const runs: HTMLElement[][] = [];
          let run: HTMLElement[] | null = null;
          for (const el of [...document.querySelector(
            "#panel .view:not([hidden]) .rows")!.children] as HTMLElement[]) {
            // (but a row only consulted, found's resting view: its light
            // label, as at rest: the anchor)
            if (el.classList.contains("gut") &&
              !el.classList.contains("rel")) {
              if (!run) runs.push(run = []);
              run.push(el);
            } else if (!el.classList.contains("cmp")) run = null;
          }
          return runs.filter((r) => !r.some((e) => {
            const p = e.querySelector(".pop");
            return p && !p.classList.contains("kept");
          })).map((r) => r[0].dataset.slot!.slice(-4));
        });
        if (!goal && miss.length) bad.push(`${x.slice(0, 12)} ${k}: ${miss}`);
        const n = page.locator(
          '#details button[data-r="next"]:not([disabled])');
        if (!(await n.count())) break;
        await n.click();
      }
      await page.keyboard.press("Escape");
    }
    expect(bad).toEqual([]);
  });

// (vanilla 23c7c00 run.mjs: at step 0, a plain label over the blurred
// pointer, ending in an arrow glyph toward ▶, and a halo on ▶; none from
// step 1 on)
test("step 0: the way on, its glyph toward ▶, and ▶'s halo",
  async ({ page }) => {
  await ready(page);
  await select(page, "mid", "players");
  await page.locator('#details button[data-r="start"]').click();
  const go = () => page.evaluate(() => {
    const l = document.querySelector<HTMLElement>("#pgo")!;
    const n = document.querySelector('#details button[data-r="next"]')!;
    return { label: !l.hidden && l.tagName === "P" &&
      /[⤴↖]$/.test(l.textContent!.trim()),
    arrow: !!document.querySelector("svg#goarrow"),
    halo: n.classList.contains("halo") };
  });
  expect(await go()).toEqual({ label: true, arrow: false, halo: true });
  await page.locator('#details button[data-r="next"]').click();
  await expect(page.locator(".rcount")).toHaveText(/^1 \//);
  expect(await go()).toEqual({ label: false, arrow: false, halo: false });
});

// (vanilla 6b1df3a run.mjs: the last step, "found", is the resting view:
// the same lit bytes, colours, rows and labels; a re-target there stays
// on found)
test("the last step, found: the selection's resting view",
  async ({ page }) => {
  await ready(page);
  const view = () => page.evaluate(() => JSON.stringify({
    b: [...document.querySelectorAll<HTMLElement>(
      "#panel .view:not([hidden]) .b.hl")].map((c) =>
      `${c.closest<HTMLElement>(".wrow")!.dataset.slot!.slice(-4)} ${
        c.dataset.i} ${c.className.match(/pk\d/)?.[0] ?? ""}`),
    r: [...document.querySelectorAll<HTMLElement>("#tree .row.hl")]
      .map((r) => `${(r.parentElement as HTMLElement).dataset.path} ${
        r.className.match(/pk\d/)?.[0] ?? ""}`),
    p: [...document.querySelectorAll("#panel .view:not([hidden]) .pop")]
      .map((p) => p.textContent) }));
  for (const x of ["players", C, "playerList"]) {
    await select(page, "mid", x);
    await page.mouse.move(1, 1);
    const rest = await view();
    await page.locator('#details button[data-r="start"]').click();
    await page.locator('#dots .dot:last-child').click();
    await page.mouse.move(1, 1);
    expect(await view(), x).toBe(rest);
    expect((await stepNow(page)).cap, x).toMatch(/^That's /);
    if (x === C) {
      await row(page, `${C}.name`).click();
      const r = await stepNow(page);
      expect(r.cap).toMatch(/^That's /);
      expect(r.count).toBe("done");
    }
    await page.keyboard.press("Escape");
  }
});
