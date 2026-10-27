// Every scene of the registry, opened by its id (#scene=<id>) in the
// embed, shows its own moments and values (test/expect.ts): never
// another scene of its lens, never a fixture
import type { Page } from "@playwright/test";
import fs from "node:fs";
import { test, expect } from "../../page";
import { A, lastBlock, STEPPER } from "../../expect";

const ids = fs.readdirSync("scenes").map((f) => f.replace(/\.json$/, ""));
const val = (page: Page, path: string) =>
  page.locator(`li[data-path="${path}"] > .row .val`).first();

// (each scene: what its first view shows)
const checks: Record<string, (page: Page) => Promise<void>> = {
  "pitfall-compiler": async (page) => {
    await expect(val(page, `${A}.score`)).toHaveText("0");
  },
  // (alice's record, its rows only)
  "pitfall-nesting": async (page) => {
    await expect(val(page,
      "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8].score"))
      .toHaveText("30");
    await expect(val(page, `${A}.lastBlock`)).toHaveText(lastBlock[0]);
  },
  // (the shared moment, annotated: carol's record, labelled)
  "reveal": async (page) => {
    await expect(page.locator('[data-area="moment"] .moment-note'))
      .toContainText(/hand-written for this post/i);
    await expect(page.locator('[data-area="snote"] .moment-note'))
      .toContainText(/comes straight from solc/);
    await expect(page.locator(".pop.note").filter({ hasText:
      /^players\[carol\].*score 100/ })).toHaveCount(1);
  },
  "pointer-walkthrough": async (page) => {
    await expect(page.locator(".rbar.replaying")).toHaveCount(1);
  },
};
// (the stepper's: carol's join, its first moment, the name's length
// read from the call: 34 bytes; its first moment selects `name`; Escape
// shows every local)
checks[STEPPER.O2] = async (page) => {
  await expect(page.locator(".mbar .rcap")).toHaveText(
    /^Carol joins the game\./);
  await expect(val(page, "name")).toBeVisible();
  await page.locator(".mbar").focus();
  await page.keyboard.press("Escape");
  await expect(val(page, "len")).toHaveText("34");
};

// (the real debugger, soldb's own: its first step drawn, soldb loaded)
checks["real-debugger"] = async (page) => {
  await expect(page.locator("[data-figure=real-debugger][data-ready]"))
    .toHaveCount(1, { timeout: 90_000 });
};

// (the program x-ray: solc's entry at `player.plays += 1`)
checks["program-xray"] = async (page) => {
  await expect(page.locator("[data-figure=program-xray] .xentry pre"))
    .toHaveAttribute("data-offset", "4432");
};

test("every scene has its check", () => {
  expect(Object.keys(checks).sort()).toEqual([...ids].sort());
});

for (const id of ids) {
  test(`embed.html#scene=${id}: its own`, async ({ page }) => {
    await page.goto(`./embed.html#scene=${id}`);
    await checks[id](page);
  });
}
