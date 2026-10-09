// Every scene of the registry, opened by its id (#scene=<id>), in the
// shell and in the embed, shows its own moments and values
// (test/expect.ts): never another scene of its lens, never a fixture
import type { Page } from "@playwright/test";
import fs from "node:fs";
import { test, expect } from "../../page";
import { A, MOTD, lastBlock, mid } from "../../expect";

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
  "vyper-rules": async (page) => {
    await expect(val(page, `${A}.score`)).toHaveText("0");
  },
  // (carol's play, right after her combo resets: 140 points so far)
  "raw-named": async (page) => {
    await expect(val(page, "totalScore")).toHaveText("140");
  },
  "raw-hero": async (page) => {
    await expect(page.locator(".moment")).toContainText("combo resets");
  },
  // (the shared moment, annotated: carol's record, labelled)
  "raw-annotated": async (page) => {
    await expect(page.locator(".moment")).toContainText("carol plays");
    await expect(page.locator(".alabel").filter({ hasText:
      /^players\[carol\]: score 100/ })).toHaveCount(1);
  },
  "players-walk": async (page) => {
    await expect(page.locator(".rbar.replaying")).toHaveCount(1);
  },
};
// (the memory section's: its own level, its first pause, its run's
// values: alice's lastBlock 13, the story's)
for (const o of ["0", "2"]) {
  checks[`bug-O${o}`] = async (page) => {
    await expect(page.locator('[data-opt][aria-checked="true"]'))
      .toHaveAttribute("data-opt", o);
    await expect(val(page, "hit")).toHaveText("true");
    // (her record before play() writes its copy back: as her play
    // before left it)
    await expect(val(page, `${A}.lastBlock`)).toHaveText(lastBlock.mid[0]);
  };
}

// (the stepper's: carol's join, its first moment, the name's length
// read from the call: 34 bytes)
for (const o of ["0", "2"]) {
  checks[`stepper-O${o}`] = async (page) => {
    await expect(page.locator(".tbar .tline"))
      .toHaveText("the name's length, read from the call");
    await expect(val(page, "len")).toHaveText("34");
  };
}

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
