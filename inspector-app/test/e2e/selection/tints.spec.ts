// One tint per owner: every byte of a value has its colour, wherever
// its bytes fall (a region that crosses rows, or a word's two lines)
import type { Page } from "@playwright/test";
import { test, expect, ready, select } from "../../page";
import { A, B, C } from "../../expect";

const at = async (page: Page, width: number, scene: string) => {
  // (the calldata section, on hold, drawn for this check)
  await ready(page, { width, hash: "#calldata=1" });
  await select(page, scene, null);
};
// each owner's tint classes (at rest, and lit by its selection)
const tints = (page: Page, panel: string) => page.evaluate((q) => {
  const by: Record<string, string[]> = {};
  for (const b of document.querySelectorAll<HTMLElement>(
    `${q} .view:not([hidden]) .b[data-owners]`)) {
    const k = [...b.classList].filter((c) => /^(t|pk)\d$/.test(c)).join();
    const o = b.dataset.owners!;
    by[o] = [...new Set([...(by[o] ?? []), k])];
  }
  return by;
}, panel);
const one = (by: Record<string, string[]>) =>
  Object.entries(by).filter(([, ks]) => ks.length !== 1);

test("calldata: each part one tint across its rows, at rest and lit",
  async ({ page }) => {
    await at(page, 1600, "motd");
    const rest = await tints(page, "#cpanel");
    expect(Object.keys(rest).length).toBeGreaterThanOrEqual(4);
    expect(one(rest)).toEqual([]);
    // (the selector and the offset, which meet in row 0x0000: two)
    expect(rest["selector"]).not.toEqual(rest["text.offset"]);
    await page.locator('#ctree li[data-part="m"] > .row').click();
    expect(one(await tints(page, "#cpanel"))).toEqual([]);
  });

test("storage, 16 bytes a line: each value one tint", async ({ page }) => {
  await at(page, 390, "mid");
  expect(one(await tints(page, "#panel"))).toEqual([]);
  await select(page, "mid", "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]");
  expect(one(await tints(page, "#panel"))).toEqual([]);
});

// (each lit tree row's colour, and each lit byte owner's: "pk0" is the
// selection's own)
const colours = (page: Page) => page.evaluate(() => {
  const k = (el: Element) => [...el.classList].find((c) =>
    /^pk\d$/.test(c)) ?? "pk0";
  const tree: Record<string, string> = {};
  for (const r of document.querySelectorAll("#tree li[data-path] > .row.hl")) {
    tree[(r.parentElement as HTMLElement).dataset.path!] = k(r);
  }
  const dump: Record<string, Set<string>> = {};
  for (const c of document.querySelectorAll<HTMLElement>(
    "#panel .view[data-side=after] .b.hl[data-owners]")) {
    for (const o of c.dataset.owners!.split("|")) {
      (dump[o.replace(/#length$/, "")] ??= new Set()).add(k(c));
    }
  }
  return { tree, dump: Object.fromEntries(Object.entries(dump).map(
    ([o, v]) => [o, [...v].join()])) };
});
const agree = (c: Awaited<ReturnType<typeof colours>>) => Object.entries(
  c.tree).filter(([p, k]) => p in c.dump && c.dump[p] !== k);

test("a composite selected: its children apart, the same colour in the "
  + "tree and the dump; the selection's own colour never a child's",
  async ({ page }) => {
    await at(page, 1280, "mid");
    await select(page, "mid", "players");
    await page.mouse.move(1, 1);
    let c = await colours(page);
    const byEntry = [A, B, C].map((p) => new Set(Object.entries(c.tree)
      .filter(([q]) => q.startsWith(p)).map(([, k]) => k)));
    expect(byEntry.map((x) => x.size)).toEqual([1, 1, 1]);
    expect(new Set(byEntry.map((x) => [...x][0])).size).toBe(3);
    expect(byEntry.some((x) => x.has("pk0"))).toBe(false);
    expect(c.tree.players).toBe("pk0");
    expect(agree(c)).toEqual([]);
    // (a record: its seven members)
    await select(page, "mid", A);
    await page.mouse.move(1, 1);
    c = await colours(page);
    const members = Object.entries(c.tree).filter(([q]) => q !== A)
      .map(([, k]) => k);
    expect(new Set(members).size).toBe(7);
    expect(members).not.toContain("pk0");
    expect([c.tree[A], agree(c)]).toEqual(["pk0", []]);
    // (an array: its length in the selection's colour, its items apart)
    await select(page, "mid", "playerList");
    await page.mouse.move(1, 1);
    c = await colours(page);
    expect([c.tree.playerList, c.dump.playerList]).toEqual(["pk0", "pk0"]);
    for (const i of [0, 1, 2]) {
      expect(c.tree[`playerList[${i}]`]).toMatch(/^pk[1-9]$/);
    }
    expect(agree(c)).toEqual([]);
    // (a leaf: one colour)
    await select(page, "mid", `${A}.combo`);
    await page.mouse.move(1, 1);
    expect(Object.values((await colours(page)).tree)).toEqual(["pk0"]);
  });
