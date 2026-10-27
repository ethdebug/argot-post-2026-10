// The walkthrough's figure loads clean: no console errors on load, nor
// once its pointer is coloured (an old copy of the library in the dev
// server's cache fails here, "failure to recognize kind of expression",
// see repin.spec.ts)
import { test, expect, ready } from "../../page";

test("pointer-walkthrough: no console errors on load, nor once its " +
  "pointer is coloured", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await ready(page, { scene: "pointer-walkthrough" });
  await page.locator('#details button[data-r="next"]').click();
  await expect(page.locator("#ptr .line span[style]").first())
    .toBeAttached();
  expect(errors).toEqual([]);
});
