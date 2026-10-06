// Checks the layout options (?layout=a|b|c) in Chromium. For each
// option, at 1440 and 390 px wide, on each data set: the three panels
// and the source show, with no sideways scroll and no console errors.
// At 1440 px, the source and the panels keep their place and size when
// the tab or the step changes. Usage: node check-layouts.mjs
import { chromium } from "playwright";
const PAGE = process.env.PAGE
  ?? "http://localhost:8765/files/demos/debugger/";
const fails = [];
const browser = await chromium.launch();
for (const layout of ["a", "b", "c"]) {
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width > 500 ? 900 : 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${PAGE}?layout=${layout}`);
    await page.waitForFunction(() => window.results?.done, null,
      { timeout: 120000 });
    const r = await page.evaluate(async () => {
      const out = {};
      const range = document.querySelector("#stepper input[type=range]");
      const boxes = () => [".src", ".frames", ".inlining", ".state"]
        .map((s) => {
          const b = document.querySelector(`#stepper ${s}`)
            .getBoundingClientRect();
          return [b.x, b.y + scrollY, b.width, b.height]
            .map(Math.round).join(",");
        }).join(" ");
      for (const ds of ["sol", "fe", "bug-O0", "bug-O2"]) {
        if (ds.startsWith("bug")) await window.selectLevel(ds.slice(4));
        else await window.select(ds);
        const at = [];
        for (const f of [0.1, 0.5, 0.9]) {
          range.value = String(Math.round(+range.max * f));
          range.dispatchEvent(new Event("input"));
          await window.stateReady();
          at.push(boxes());
        }
        const d = document.documentElement;
        out[ds] = {
          panels: [...document.querySelectorAll("#stepper .panel")]
            .map((p) => p.getClientRects().length > 0
              && p.getBoundingClientRect().height > 20),
          src: document.querySelector("#stepper .src")
            .getBoundingClientRect().height > 100,
          sideways: d.scrollWidth > d.clientWidth,
          boxes: at };
      }
      return out;
    });
    const all = Object.values(r).flatMap((x) => x.boxes);
    for (const [ds, x] of Object.entries(r)) {
      const name = `${layout} ${width}px ${ds}`;
      if (x.panels.length !== 3 || !x.panels.every(Boolean)) {
        fails.push(`${name}: panels ${x.panels}`);
      }
      if (!x.src) fails.push(`${name}: no source`);
      if (x.sideways) fails.push(`${name}: sideways scroll`);
    }
    if (width > 500 && new Set(all).size !== 1) {
      fails.push(`${layout} ${width}px: boxes move: ${[...new Set(all)]
        .join(" | ")}`);
    }
    if (errors.length) fails.push(`${layout} ${width}px: ${errors}`);
    console.log(layout, width, "checked");
    await ctx.close();
  }
}
await browser.close();
console.log(fails.length ? `FAIL\n${fails.join("\n")}` : "PASS");
process.exitCode = fails.length ? 1 : 0;
