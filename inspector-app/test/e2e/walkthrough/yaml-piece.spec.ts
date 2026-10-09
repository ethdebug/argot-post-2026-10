// The pointer pane shows the piece of the pointer the step is in: the
// variable's own pointer, or the template the dereference has entered,
// with where that is in the label's line (players › mapping › Player);
// step 0 and found show the variable's own pointer. The pane keeps its
// size as the pieces swap.
import { test, expect, ready, select } from "../../page";

const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";

test("each step's piece of the pointer, and where it is", async ({ page }) => {
  await ready(page, { width: 1440, height: 900 });
  await select(page, "mid", `${A}.score`);
  await page.locator('#details button[data-r="start"]').click();
  const seen: [string, string][] = [];
  const size = new Set<string>();
  for (let k = 0; k < 12; k++) {
    await page.mouse.move(1, 1);
    const [chain, head, box] = await page.evaluate(() => {
      const ptr = document.querySelector("#ptr")!;
      const r = ptr.getBoundingClientRect();
      return [document.querySelector("#dpanel .pchain")!.textContent!,
        ptr.querySelector(".ptrlines .line")?.textContent ?? "",
        `${Math.round(r.width)}x${Math.round(r.height)}`];
    });
    seen.push([chain, head.trim()]);
    size.add(box);
    const n = page.locator('#details button[data-r="next"]');
    if (await n.isDisabled()) break;
    await n.click();
  }
  // (step 0 and found: the variable's own pointer)
  expect(seen[0]).toEqual(["players", "players:"]);
  expect(seen.at(-1)).toEqual(["players", "players:"]);
  // (the template steps: each its own piece, headed by its name)
  expect(seen).toContainEqual(["players › mapping(address => Player)",
    "mapping(address => Player):"]);
  expect(seen).toContainEqual(["players › mapping(address => Player) › " +
    "Player", "Player:"]);
  // (one size for the pane, whatever piece it shows)
  expect(size.size).toBe(1);
});
