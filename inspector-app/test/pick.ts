import type { Locator } from "@playwright/test";

// Selects what a locator shows, as a reader does: a click; with a
// selection that does not light it, that click only ends the selection
// (ui/types.ts exiting), so a second one selects it
export async function pick(l: Locator) {
  const exits = await l.evaluate((e) => !!e.closest("[data-exits]") &&
    !e.classList.contains("hl"));
  await l.click();
  if (exits) await l.click();
}
