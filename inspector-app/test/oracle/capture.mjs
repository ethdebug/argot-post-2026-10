// What a reader sees at each step of a walkthrough, on either page
// (vanilla's or the port's; the same DOM contract, bin/run.mjs's): the
// count, caption, form, short caption, source, footnotes, chips, the
// pointer's band, the lit and full-strength bytes, the gutters, the
// address groups, the labels and the focus picker. bin/oracle.mjs
// captures vanilla's at sync-base (the oracle); test/e2e/oracle.spec.ts
// captures the port's and compares.

export const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
export const B = "players[0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc]";
export const C = "players[0x90f79bf6eb2c4f870365e785982e1f101e93b906]";

// [scene, side, selection]: each scene's variables at each of its sides,
// and each record and a field and a name in it
const vars = ["players", "roster", "motd", "total", "rounds"];
const deep = [A, B, C, `${B}.plays`, `${C}.name`, "roster[1]"];
export const WALKS = [
  ...[...vars, ...deep].map((p) => ["mid", "after", p]),
  ...["before", "after"].flatMap((s) => [...vars, A, `${A}.combo`]
    .map((p) => ["alice", s, p])),
  ...["before", "after"].flatMap((s) => ["motd", "players"]
    .map((p) => ["motd", s, p])),
  ...["players", A, `${A}.name`].map((p) => ["vyper", "after", p]),
];

const stepNow = (page) => page.evaluate(() => {
  const v = "#panel .view:not([hidden])";
  const nm = Object.fromEntries([...document.querySelectorAll(
    `${v} .wrow[data-name]`)].map((r) => [r.dataset.slot, r.dataset.name]));
  const by = (sel) => {
    const o = {};
    for (const c of document.querySelectorAll(sel)) {
      const s = c.closest(".wrow").dataset.slot;
      (o[nm[s] ?? s] ??= []).push(+c.dataset.i);
    }
    return Object.fromEntries(Object.entries(o).sort().map(([k, x]) =>
      [k, x.length === 32 ? "all" : x.join()]));
  };
  const text = (q) => document.querySelector(q)?.textContent
    .replace(/\s+/g, " ").trim();
  return {
    count: text("#details .rcount"),
    cap: text("#dtext .rcap"),
    form: text("#dtext .rform"),
    short: text("#details .rshort"),
    src: text("#dtext .rsrc, #dtext .src"),
    foot: [...document.querySelectorAll("#dtext a")].map((a) =>
      a.getAttribute("href")).join(),
    chips: [...document.querySelectorAll("#chips .chip")].map((c) =>
      c.className.replace("chip ", "") + ":" + c.textContent).join("|"),
    ptr: [...document.querySelectorAll("#ptr .line.on")].map((l) =>
      l.textContent.trim()),
    lit: by(`${v} .b.hl`),
    full: by(`${v} .b.hl:not(.muted)`),
    gut: [...document.querySelectorAll(`${v} .wrow.gut`)].map((r) =>
      nm[r.dataset.slot] ?? r.dataset.slot).sort(),
    pops: [...document.querySelectorAll("#panel .pop")].filter((p) =>
      p.offsetParent).map((p) => (p.classList.contains("kept") ? "k:" : "")
      + p.textContent.replace(/\s+/g, " ").trim()).sort(),
    picker: [...document.querySelectorAll("#details .rfocus button, " +
      "#details [data-focus]")].map((b) => b.textContent.trim() +
      (b.getAttribute("aria-pressed") === "true" ? "*" : "")).join(","),
  };
});

// every step of one walkthrough
export async function walk(page, [scene, side, path]) {
  await page.evaluate(([b, s, p]) => window.select(b, { sel: p, mode: s }),
    [scene, side, path]);
  await page.mouse.move(1, 1);
  const start = page.locator('#details button[data-r="start"]');
  if (!(await start.count()) || await start.isDisabled()) return null;
  await start.click();
  const steps = [];
  for (let k = 0; k < 30; k++) {
    await page.mouse.move(1, 1);
    await page.waitForTimeout(80);
    steps.push(await stepNow(page));
    const nx = page.locator('#details button[data-r="next"]');
    if (await nx.isDisabled()) break;
    await nx.click();
  }
  await page.locator('#details button[data-r="exit"]').click();
  await page.waitForTimeout(80);
  return steps;
}

export async function captureAll(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.waitForFunction(() => window.results?.done, null,
    { timeout: 60000 });
  const out = {};
  for (const w of WALKS) out[w.join(" ")] = await walk(page, w);
  return out;
}
