// Every scene of the registry, opened by its id (#scene=<id>), in the
// shell and in the embed, shows its own moments and values
// (test/expect.ts): never another scene of its lens, never a fixture
import type { Page } from "@playwright/test";
import fs from "node:fs";
import { test, expect } from "../../page";
import { A, MOTD, lastBlock, mid, STEPPER } from "../../expect";

const ids = fs.readdirSync("scenes").map((f) => f.replace(/\.json$/, ""));
const val = (page: Page, path: string) =>
  page.locator(`li[data-path="${path}"] > .row .val`).first();
const want = Object.fromEntries(mid);

// (each scene: what its first view shows)
const checks: Record<string, (page: Page) => Promise<void>> = {
  "mid": async (page) => {
    await expect(val(page, "totalScore")).toHaveText(want.totalScore);
    await expect(val(page, `${A}.lastBlock`)).toHaveText(lastBlock.mid[0]);
  },
  "alice": async (page) => {
    await expect(val(page, `${A}.score`)).toHaveText("60");
    await expect(val(page, `${A}.lastBlock`)).toHaveText(lastBlock.alice);
  },
  "alice-plays": async (page) => {
    await expect(val(page, "totalScore")).toHaveText("170");
  },
  "motd": async (page) => {
    await expect(val(page, "motd")).toHaveText(`"${MOTD[1]}"`);
  },
  "vyper": async (page) => {
    await expect(val(page, `${A}.score`)).toHaveText("0");
  },
  "pitfall-compiler": async (page) => {
    await expect(val(page, `${A}.score`)).toHaveText("0");
  },
  // (carol's play, right after her combo resets: 140 points so far)
  // (alice's record, its rows only)
  "pitfall-nesting": async (page) => {
    await expect(val(page,
      "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8].score"))
      .toHaveText("30");
  },
  "raw-named": async (page) => {
    await expect(val(page, "totalScore")).toHaveText("140");
  },
  "raw-hero": async (page) => {
    // (carol's record, her score 100 = 0x64: the moment's bytes)
    await expect(page.locator('.view[data-view$=":storage"] ' +
      '.word[data-slot$="9978"]')).toContainText("64");
  },
  // (the shared moment, annotated: carol's record, labelled)
  "reveal": async (page) => {
    await expect(page.locator(".moment-note")).toContainText(
      /ethdebug data written by hand, not from solc/i);
    await expect(page.locator(".pop.note").filter({ hasText:
      /^players\[carol\].*score 100/ })).toHaveCount(1);
  },
  "pointer-walkthrough": async (page) => {
    await expect(page.locator(".rbar.replaying")).toHaveCount(1);
  },
};
// (the stepper's: carol's join, its first moment, the name's length
// read from the call: 34 bytes)
for (const id of Object.values(STEPPER)) {
  checks[id] = async (page) => {
    await expect(page.locator(".tbar .tline"))
      .toHaveText("the name's length, read from the call");
    await expect(val(page, "len")).toHaveText("34");
  };
}

// (the memory section's old ids, in the embed: the stepper's)
test("embed.html#scene=bug-O2: the stepper at -O2", async ({ page }) => {
  await page.goto("./embed.html#scene=bug-O2");
  await checks["optimized-locals"](page);
});

test("every scene has its check", () => {
  expect(Object.keys(checks).sort()).toEqual([...ids].sort());
});

for (const host of ["shell.html", "embed.html"]) {
  for (const id of ids) {
    test(`${host}#scene=${id}: its own`, async ({ page }) => {
      await page.goto(`./${host}#scene=${id}`);
      await checks[id](page);
    });
  }
}
