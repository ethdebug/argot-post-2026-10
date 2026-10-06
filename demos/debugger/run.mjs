// Opens the page in real browsers (Playwright) and collects
// window.results. Usage: node run.mjs [runs]
// BROWSERS=chromium,firefox,webkit (default: all three) picks the
// browsers for the main runs.
import { chromium, firefox, webkit, devices } from "playwright";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { pagesServer } from "./pages-server.mjs";
const PAGE = process.env.PAGE
  ?? "http://localhost:8765/files/demos/debugger/";
const BROWSERS = (process.env.BROWSERS ?? "chromium,firefox,webkit")
  .split(",");
// Shiki and its grammar/themes come from a CDN; nothing else may.
const CDN = ["esm.sh", "cdn.jsdelivr.net"];
const runs = +(process.argv[2] ?? 3);
const all = {};
// The page loads only its default tab at first; the rest loads when
// opened. The checks load everything (window.loadAll), then wait until
// the page is done.
const loadAll = async (page) => {
  await page.waitForFunction(() => window.results?.ready, null,
    { timeout: 120000 });
  await page.evaluate(() => window.loadAll());
  await page.waitForFunction(() => window.results?.done, null,
    { timeout: 120000 });
};
// The main thread must stay free while soldb works (in a Web Worker):
// a requestAnimationFrame loop runs from the start, and no gap between
// frames may exceed LONG ms until the page is done.
const LONG = 100;
const frames = () => {
  const f = { max: 0, maxBeforeSol: 0, loadingShown: false };
  window.frames_ = f;
  let last = performance.now();
  const tick = () => {
    const t = performance.now();
    f.max = Math.max(f.max, t - last);
    if (!window.walked?.sol) f.maxBeforeSol = f.max;
    last = t;
    // The loader: in the source card, while the default tab loads.
    const el = document.getElementById("loading");
    if (el && el.getClientRects().length && !window.walked?.sol) {
      f.loadingShown = true;
    }
    if (!window.results?.done) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
for (const [name, type] of [["chromium", chromium], ["firefox", firefox],
  ["webkit", webkit]].filter(([n]) => BROWSERS.includes(n))) {
  let browser;
  try { browser = await type.launch(); } catch (e) {
    all[name] = { error: String(e).split("\n")[0] }; continue;
  }
  all[name] = { version: browser.version(), runs: [] };
  for (let i = 0; i < runs; i++) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const foreign = [], logs = [];
    // Block and record anything that is not this static server.
    await ctx.route("**/*", (route) => {
      const u = new URL(route.request().url());
      if (u.host !== new URL(PAGE).host && !CDN.includes(u.host)) {
        foreign.push(u.href); return route.abort();
      }
      return route.continue();
    });
    page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
    page.on("pageerror", (e) => logs.push(`pageerror: ${e}`));
    await page.addInitScript(frames);
    await page.goto(PAGE);
    await loadAll(page);
    const r = await page.evaluate(() => window.results);
    if (i === 0) {
      // The old path redirects here and keeps the hash.
      const old = await ctx.newPage();
      await old.goto(new URL("../soldb/#kept", PAGE).href);
      await old.waitForURL((u) => u.pathname.endsWith("/demos/debugger/"),
        { timeout: 10000 }).catch(() => {});
      const u = new URL(old.url());
      r.redirect = { path: u.pathname, hash: u.hash,
        ok: u.pathname === new URL(PAGE).pathname && u.hash === "#kept" };
      await old.close();
    }
    r.frames = await page.evaluate(() => window.frames_);
    r.foreign = foreign; r.logs = logs;
    if (i === 0 && name === "chromium") {
      await page.screenshot({ path: "screenshot-chromium.png",
        fullPage: true });
    }
    // Step through the display, per data set: line buttons, a multi-line
    // span, a compiler-generated step, and (Fe) a std-library step.
    const ui = await page.evaluate(async () => {
      const out = {};
      const box = document.getElementById("stepper");
      const range = box.querySelector("input[type=range]");
      const go = (i) => {
        range.value = String(i);
        range.dispatchEvent(new Event("input"));
      };
      const btn = (go, d) =>
        box.querySelector(`button[data-go=${go}][data-d='${d}']`);
      const at = () => +range.value;
      const key = (w, i) => w.spans[i] && w.spans[i].join(":");
      const press = (k, shiftKey = false) => document.dispatchEvent(
        new KeyboardEvent("keydown", { key: k, shiftKey, bubbles: true }));
      // The state panel (Solidity only): soldb's state(i) at a step.
      const panel = box.querySelector(".state");
      const table = () => Object.fromEntries([...panel.querySelectorAll(
        "tr")].map((tr) => [tr.cells[0].textContent, tr.cells[1]
        .textContent]));
      const marked = () => [...panel.querySelectorAll(".chg")]
        .map((e) => e.closest("tr").cells[0].textContent);
      // The state comes from the worker: wait for the shown step's.
      const settle = async () => {
        await window.stateReady();
        return panel.dataset.step === String(at());
      };
      const lineMsOf = () => {
        const t = performance.now();
        for (let k = 0; k < 10; k++) btn("into", 1).click();
        return (performance.now() - t) / 10;
      };
      const note = box.querySelector(".gen-note");
      for (const p of ["sol", "fe"]) {
        await window.select(p);
        const w = window.walked[p];
        if (p === "sol") {
          // First and last steps, then step into until a value changes.
          go(0);
          let synced = await settle();
          const first = table();
          go(w.n - 1);
          synced &&= await settle();
          const last = table();
          go(0);
          synced &&= await settle();
          let from = 0, changed = [], row = null;
          while (!changed.length && at() < w.n - 1) {
            from = at();
            btn("into", 1).click();
            synced &&= await settle();
            changed = marked();
            row = table();
          }
          const to = at();
          btn("into", 1).click();
          synced &&= await settle();
          // Step fast: only the last step's state is drawn.
          for (let k = 0; k < 10; k++) btn("into", 1).click();
          const fast = await settle();
          out.state = { shown: !panel.querySelector("table").hidden,
            first, last, synced, fast,
            change: { from, to, changed, row }, afterNext: marked(),
            lines: [...panel.querySelectorAll("p")]
              .map((e) => e.textContent.replace(/\s+/g, " ")) };
          go(0);
        }
        // Step into, 20 times: each lands on a new span, further on.
        const fwd = btn("into", 1);
        const t = performance.now();
        let intoOk = true;
        for (let k = 0; k < 20; k++) {
          const i = at();
          fwd.click();
          const j = at();
          intoOk &&= j > i && !!w.spans[j] && key(w, j) !== key(w, i);
        }
        const lineMs = (performance.now() - t) / 20;
        // The slider follows the buttons.
        const sliderOk = range.type === "range" && +range.value === +document
          .getElementById("where").textContent.match(/^step (\d+)/)[1];
        // Back into: an earlier step with another span; keys match buttons.
        const i0 = at();
        btn("into", -1).click();
        const back = at();
        const backOk = back < i0 && key(w, back) !== key(w, i0);
        press("ArrowRight");
        const keyRight = at();
        go(back); fwd.click();
        const keyOk = keyRight === at();
        press("ArrowLeft");
        const keyLeftOk = at() === back;
        // Over and out: EVM depth is 1 at every step, so disabled.
        const disabled = ["over", "out"].flatMap((g) => [1, -1]
          .map((d) => btn(g, d).disabled));
        const before = at();
        press("ArrowRight", true);
        const shiftNoMove = at() === before;
        // Run to here: click the line of a later step in the shown file.
        const shownId = w.spans[before] ? w.spans[before][0] : 0;
        let target = -1;
        for (let j = before + 1; j < w.n && target < 0; j++) {
          if (w.spans[j] && w.spans[j][0] === shownId &&
            w.lineNo[j] !== w.lineNo[before]) target = j;
        }
        const line = w.lineNo[target];
        box.querySelectorAll(".src .line")[line - 1].click();
        const ran = at();
        const runOk = ran > before && ran <= target && w.lineNo[ran] === line
          && w.spans[ran][0] === shownId;
        out[p] = { intoOk, sliderOk, backOk, keyOk, keyLeftOk, disabled,
          shiftNoMove,
          run: { from: before, line, to: ran, ok: runOk } };
        // A multi-line span in the main file (source 0).
        let multi = -1;
        for (let i = 0; i < w.n && multi < 0; i++) {
          const s = w.spans[i];
          if (!s || s[0] !== 0 || s[2] - s[1] >= 400) continue;
          go(i);
          if (box.querySelectorAll(".line.hl, .line:has(.hl)").length > 1) {
            multi = i;
          }
        }
        go(multi);
        Object.assign(out[p], { lineMs, multi,
          hl: box.querySelectorAll(".hl").length,
          hlLines: box.querySelectorAll(".line.hl, .line:has(.hl)").length,
          hlText: [...box.querySelectorAll(".hl")].map((e) => e.textContent)
            .join("").slice(0, 80),
          pageScrollX: document.documentElement.scrollWidth
            > document.documentElement.clientWidth });
        const gen = w.spans.findIndex((s) => !s);
        go(gen);
        Object.assign(out[p], { gen,
          noteVisible: getComputedStyle(note).visibility,
          faded: box.querySelector(".src").classList.contains("faded"),
          hlWhenGen: box.querySelectorAll(".hl").length });
        const lib = w.spans.findIndex((s) => s && s[0] !== 0);
        if (lib >= 0) {
          go(lib);
          out[p].lib = { step: lib, note: note.textContent,
            noteVisible: getComputedStyle(note).visibility,
            hlText: [...box.querySelectorAll(".hl")]
              .map((e) => e.textContent).join("").slice(0, 60) };
        }
        go(multi);
      }
      // BUG tab: the reference engine, at -O0 then -O2. It steps, shows a
      // call stack of depth >= 2, local variables with values (both
      // levels) and an inline marker (-O2).
      const frames = box.querySelector(".frames");
      const fsettle = async () => {
        await window.stateReady();
        return frames.dataset.step === String(at());
      };
      const rows = () => [...panel.querySelectorAll("tr")]
        .filter((tr) => tr.cells.length > 1).map((tr) =>
        ({ name: tr.cells[0].textContent, value: tr.cells[1].textContent,
          scope: tr.dataset.scope, note: tr.cells[2]?.textContent
            .replace(/\s+/g, " ") ?? null,
          inline: !!tr.cells[2]?.querySelector(".badge") }));
      const stack = () => [...frames.querySelectorAll("li:not(.muted)")]
        .map((li) => li.textContent.replace(/\s+/g, " "));
      out.bug = {};
      for (const lvl of ["O0", "O2"]) {
        await window.selectLevel(lvl);
        const w = window.walked[`bug-${lvl}`];
        const o = out.bug[lvl] = { stepperShown: !box.hidden,
          aboutShown: !document.querySelector("[data-about=bug]").hidden,
          framesShown: !frames.querySelector("ol").hidden,
          varsShown: !panel.querySelector("table").hidden };
        go(0);
        const fwd = btn("into", 1);
        let intoOk = true;
        for (let k = 0; k < 20; k++) {
          const i = at();
          fwd.click();
          const j = at();
          intoOk &&= j > i && !!w.spans[j] && key(w, j) !== key(w, i);
        }
        o.intoOk = intoOk;
        o.overOutEnabled = ["over", "out"].some((g) => !btn(g, 1).disabled);
        // The deepest call stack, at the first step that reaches it.
        const deep = w.depths.indexOf(Math.max(...w.depths));
        go(deep + 1);
        const synced = await fsettle();
        o.stack = { step: at(), synced, depth: +frames.dataset.depth,
          frames: stack() };
        // Step over from a call: lands at the same or a lower depth.
        const call = w.depths.findIndex((d, i) => i > 0 &&
          d > w.depths[i - 1]);
        go(call - 1);
        btn("over", 1).click();
        o.over = { from: call - 1, to: at(),
          ok: w.depths[at()] <= w.depths[call - 1] };
        // The first step with a local variable that has a value, and the
        // values at the last step.
        o.local = null;
        for (let i = 0; i < w.n && !o.local; i += 5) {
          go(i);
          await fsettle();
          const r = rows().find((r) => r.scope === "local"
            && !r.value.startsWith("<"));
          if (r) o.local = { step: i, ...r, all: rows() };
        }
        go(w.n - 1);
        await fsettle();
        o.last = Object.fromEntries(rows().map((r) => [r.name, r.value]));
        // The first step in an inlined body.
        const inl = (w.inline ?? []).findIndex((x) => x);
        o.inline = null;
        if (inl >= 0) {
          go(inl + 1);
          await fsettle();
          o.inline = { step: at(), fn: note.dataset.inline,
            text: note.textContent.replace(/\s+/g, " "),
            noteVisible: getComputedStyle(note).visibility,
            site: box.querySelectorAll(".src .site").length,
            frames: stack() };
        }
        // Each inlined body of sq(k): at its first step with x located,
        // x (sq's parameter, read through its pointer) and the call
        // stack. score(k) passes k to sq, so x must be k.
        o.inlineLocals = [];
        for (let i = 1; i < w.n; i++) {
          if (!w.inline?.[i] || w.inline[i - 1]) continue;
          for (let j = i; j < w.n && w.inline[j]; j++) {
            go(j);
            await fsettle();
            const x = rows().find((r) => r.name === "x");
            if (x && !x.value.startsWith("<")) {
              o.inlineLocals.push({ step: j, x, frames: stack() });
              break;
            }
          }
        }
        // Locals listed by type only, with their reason.
        o.typeOnly = null;
        for (let i = 0; i < w.n && !o.typeOnly; i += 3) {
          go(i);
          await fsettle();
          const r = rows().find((r) => r.scope === "local"
            && r.value.startsWith("<"));
          if (r) o.typeOnly = { step: i, ...r };
        }
        // Every step: each local or storage variable with a location,
        // as read through its pointer. Collects the values of recent
        // (in order, without repeats), of bonus, and of every name.
        o.scan = { values: {}, recent: [], bonus: [], names: [] };
        for (let i = 0; i < w.n; i++) {
          go(i);
          await fsettle();
          o.scan.names.push(rows().map((r) => r.name));
          for (const r of rows()) {
            const vs = o.scan.values[r.name] ??= [];
            if (!vs.includes(r.value)) vs.push(r.value);
            if (r.name === "recent" && !r.value.startsWith("<")
              && o.scan.recent.at(-1) !== r.value) {
              o.scan.recent.push(r.value);
            }
            if (r.name === "bonus" && !o.scan.bonus.some((b) =>
              b.value === r.value)) {
              o.scan.bonus.push({ step: i, value: r.value, note: r.note });
            }
          }
        }
        o.lineMs = lineMsOf(w);
      }
      // Skip compiler and library code. On (the default): into, over and
      // out never stop on a compiler-generated step (no span) or in a
      // library file, forward or back. Off: stepping into stops on one.
      // Over and out only where enabled (BUG; on Solidity and Fe every
      // step is at EVM depth 1).
      const skip = document.getElementById("skip");
      const setSkip = (on) => { if (skip.checked !== on) skip.click(); };
      out.skip = { default: skip.checked };
      for (const ds of ["sol", "fe", "bug-O0", "bug-O2"]) {
        if (ds.startsWith("bug")) await window.selectLevel(ds.slice(4));
        else await window.select(ds);
        const w = window.walked[ds];
        const walk = (go, d) => {
          const b = btn(go, d);
          let gen = 0, lib = 0, stops = 0;
          while (!b.disabled && stops < w.n) {
            b.click();
            stops++;
            if (!w.spans[at()]) gen++;
            if (w.lib[at()]) lib++;
          }
          return { stops, gen, lib };
        };
        const o = out.skip[ds] = {
          note: document.getElementById("skip-note").textContent,
          link: document.querySelector("#skip-note a")?.href ?? null,
          libSteps: w.lib.filter(Boolean).length };
        // The same panels on every tab; missing data says why.
        go(w.changes[0] ?? 0);
        await window.stateReady();
        out.panels ??= {};
        out.panels[ds] = [...box.querySelectorAll(".panel")].map((e) => ({
          name: e.querySelector(".ph").textContent,
          shown: !e.hidden && e.getClientRects().length > 0,
          why: [...e.querySelectorAll(".why")].map((x) => x.textContent)
            .filter((t) => t).join(" | "),
          whyMuted: [...e.querySelectorAll(".why")].every((x) =>
            getComputedStyle(x).color === getComputedStyle(note).color),
          data: [...e.querySelectorAll("[data-has]")]
            .some((x) => !x.hidden) }));
        for (const on of [true, false]) {
          setSkip(on);
          const r = o[on ? "on" : "off"] = {};
          for (const g of ["into", "over", "out"]) {
            go(0);
            const off = btn(g, 1).disabled && btn(g, -1).disabled
              && w.depths.every((x) => x === w.depths[0]);
            if (off) continue;
            // "out" starts from the deepest call stack.
            const deep = w.depths.indexOf(Math.max(...w.depths));
            go(g === "out" ? deep : 0);
            r[`${g}+`] = walk(g, 1);
            go(g === "out" ? deep : w.n - 1);
            r[`${g}-`] = walk(g, -1);
          }
        }
        setSkip(true);
      }
      await window.select("sol");
      return out;
    });
    r.ui = ui; r.shikiInfo = r.shiki;
    if (name === "chromium" && i === 0) {
      // Show the state panel where it says the most: a step in user code
      // that changes a value, with as few unknowns as possible.
      const showcase = () => page.evaluate(async () => {
        const box = document.getElementById("stepper");
        const range = box.querySelector("input[type=range]");
        const go = (i) => {
          range.value = String(i);
          range.dispatchEvent(new Event("input"));
        };
        // Score: values known, plus one if a value differs from the step
        // before; only steps with a highlighted source line count.
        const vals = () => [...box.querySelectorAll(".state .val")]
          .map((v) => v.textContent).join("|");
        let best = 0, bestScore = -1, prev = "";
        for (let s = 0; s <= +range.max; s++) {
          go(s);
          await window.stateReady();
          const now = vals();
          const changed = s > 0 && now !== prev;
          prev = now;
          if (!box.querySelector(".hl")) continue;
          const known = box.querySelectorAll(".state .val:not(.unk)").length;
          const score = known * 2 + (changed ? 1 : 0);
          if (score >= bestScore) { bestScore = score; best = s; }
        }
        go(best - 1);
        await window.stateReady();
        go(best);
        await window.stateReady();
        console.log("showcase step", best);
        return best;
      });
      await page.evaluate(() => window.select("sol"));
      r.showcaseStep = await showcase();
      await page.screenshot({ path: "screenshot-highlight.png",
        fullPage: true });
      await page.evaluate(async (i) => {
        await window.select("fe");
        const range = document.querySelector("#stepper input[type=range]");
        range.value = String(i);
        range.dispatchEvent(new Event("input"));
      }, ui.fe.multi);
      await page.screenshot({ path: "screenshot-fe.png", fullPage: true });
      await page.emulateMedia({ colorScheme: "dark" });
      await page.screenshot({ path: "screenshot-fe-dark.png",
        fullPage: true });
      await page.evaluate(() => window.select("sol"));
      await showcase();
      await page.screenshot({ path: "screenshot-highlight-dark.png",
        fullPage: true });
      await page.emulateMedia({ colorScheme: "light" });
      // BUG: -O2 at the first step after an inlined body opens (inline
      // marker, inline frame); -O0 at the first step from the deepest
      // call stack on where a local variable has a value. The step before
      // is shown first, so changed values are marked as when stepping.
      const bugAt = (lvl, i) => page.evaluate(async ([lvl, i]) => {
        await window.selectLevel(lvl);
        const range = document.querySelector("#stepper input[type=range]");
        const go = async (j) => {
          range.value = String(j);
          range.dispatchEvent(new Event("input"));
          await window.stateReady();
        };
        const local = () => [...document.querySelectorAll(
          ".state tr[data-scope=local] .val:not(.unk)")].length > 0;
        await go(i);
        if (lvl === "O0") while (!local()) await go(++i);
        await go(i - 1);
        await go(i);
      }, [lvl, i]);
      await bugAt("O2", ui.bug.O2.inline.step);
      await page.screenshot({ path: "screenshot-bug.png", fullPage: true });
      await bugAt("O0", ui.bug.O0.stack.step);
      await page.screenshot({ path: "screenshot-bug-O0.png",
        fullPage: true });
    }
    all[name].runs.push(r);
    await ctx.close();
  }
  await browser.close();
}
// Phone: iPhone 15 emulation (WebKit), stepped to a multi-line span.
let phone;
{
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices["iPhone 15"] });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
  page.on("pageerror", (e) => logs.push(`pageerror: ${e}`));
  await page.goto(PAGE);
  await loadAll(page);
  const w = await page.evaluate(async () => {
    await window.select("fe");
    const range = document.querySelector("#stepper input[type=range]");
    const sp = window.walked.fe.spans;
    range.value = String(sp.findIndex((s) => s && s[0] === 0 &&
      s[2] - s[1] > 60));
    range.dispatchEvent(new Event("input"));
    const d = document.documentElement;
    return { scrollW: d.scrollWidth, clientW: d.clientWidth };
  });
  await page.locator("#stepper").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshot-highlight-iphone.png" });
  // BUG, -O2, at an inline step with its call stack: no sideways scroll.
  w.bug = await page.evaluate(async () => {
    await window.selectLevel("O2");
    const range = document.querySelector("#stepper input[type=range]");
    range.value = String(window.walked["bug-O2"].inline
      .findIndex((x) => x) + 1);
    range.dispatchEvent(new Event("input"));
    await window.stateReady();
    const d = document.documentElement;
    return { scrollW: d.scrollWidth, clientW: d.clientWidth };
  });
  console.log("phone", JSON.stringify(w), logs);
  phone = w;
  await browser.close();
}
// Layout (Chromium), at 1440 and 390 px wide, on every data set: the
// source and the three panels show, with no sideways scroll. The boxes
// keep their place and size when the tab or the step changes: at 1440
// px the source and the panels, at 390 px the source card.
const layoutFails = [];
{
  const browser = await chromium.launch();
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({
      viewport: { width, height: width > 500 ? 900 : 844 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(PAGE);
    await loadAll(page);
    const r = await page.evaluate(async (wide) => {
      const out = {};
      const range = document.querySelector("#stepper input[type=range]");
      const boxes = () => (wide ? [".src", ".frames", ".state", ".inlining"]
        : [".view"]).map((s) => {
        const b = document.querySelector(`#stepper ${s}`)
          .getBoundingClientRect();
        return [b.x, b.y + scrollY, b.width, b.height].map(Math.round)
          .join(",");
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
          shown: [".src", ".panel.frames", ".panel.state",
            ".panel.inlining"].map((s) => document.querySelector(
            `#stepper ${s}`).getBoundingClientRect().height > 20),
          sideways: d.scrollWidth > d.clientWidth, boxes: at };
      }
      await window.select("sol");
      return out;
    }, width > 500);
    for (const [ds, x] of Object.entries(r)) {
      const n = `layout ${width}px ${ds}`;
      if (!x.shown.every(Boolean)) layoutFails.push(`${n}: shown ${x.shown}`);
      if (x.sideways) layoutFails.push(`${n}: sideways scroll`);
    }
    const all = new Set(Object.values(r).flatMap((x) => x.boxes));
    if (all.size !== 1) {
      layoutFails.push(`layout ${width}px: boxes move: ${[...all]
        .join(" | ")}`);
    }
    if (errors.length) layoutFails.push(`layout ${width}px: ${errors}`);
    console.log("layout", width, JSON.stringify(Object.fromEntries(
      Object.entries(r).map(([k, x]) => [k, x.boxes[0]]))));
  }
  await browser.close();
}
// The state panel's expected values (Shop.place on a fresh contract).
const MAP = "<mapping; index it with [key]>", UNK = "<unknown>";
const want = {
  first: { orders: MAP, nextId: UNK, revenue: UNK, owner: UNK },
  last: { orders: MAP, nextId: "1", revenue: "30", owner: UNK },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stateOk = (st) => st?.shown && st.synced && st.fast
  && same(st.first, want.first)
  && same(st.last, want.last) && same(st.change.changed, ["nextId"])
  && st.change.row.nextId === "1" && st.afterNext.length === 0;
// From bugc's -O2 program and its trace, not from the page: the steps
// whose instruction is inlined code (transform "inline"), and, for each
// inlined call of sq, the steps from the one after its invoke to the
// one of its return.
const sqInline = (() => {
  const dir = new URL("bug/scores-O2/", import.meta.url);
  const read = (f) => JSON.parse(fs.readFileSync(new URL(f, dir), "utf8"));
  const program = read("scores.program.json");
  const logs = read("tx.debug-trace.json").structLogs;
  const ctx = new Map(program.instructions.map((i) => [i.offset, i.context]));
  const any = (c, f) => !!c && (f(c) || [...c.gather ?? [], ...c.pick ?? []]
    .some((x) => any(x, f)));
  const inline = [], spans = [];
  let open = null;
  logs.forEach((l, i) => {
    const c = ctx.get(l.pc);
    if (any(c, (x) => x.transform?.includes("inline"))) inline.push(i);
    if (any(c, (x) => x.invoke?.identifier === "sq")) open = i;
    if (any(c, (x) => x.return?.identifier === "sq") && open !== null) {
      spans.push(Array.from({ length: i - open }, (_, k) => open + 1 + k));
      open = null;
    }
  });
  return { inline, spans };
})();
const fails = [];
const check = (name, what, ok) => { if (!ok) fails.push(`${name}: ${what}`); };
const med = (xs) => xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)];
for (const [name, b] of Object.entries(all)) {
  console.log(`\n== ${name} ${b.version ?? ""} ${b.error ?? ""}`);
  if (!b.runs) continue;
  const r0 = b.runs[0];
  console.log("env", JSON.stringify(r0.env));
  for (const part of ["a", "fe", "bug", "b"]) {
    const ok = b.runs.map((r) => r[part]?.ok);
    console.log(`part ${part} ok`, ok.join(","),
      r0[part]?.error ?? "");
    if (!r0[part]?.ok) continue;
    for (const k of Object.keys(r0[part].times)) {
      console.log(`  ${k}: median ${med(b.runs.map((r) => r[part].times[k]))
        .toFixed(1)} ms  [${b.runs.map((r) => r[part].times[k].toFixed(1))
        .join(", ")}]`);
    }
    const { times, ...rest } = r0[part];
    console.log("  ", JSON.stringify(rest));
  }
  console.log("ref", JSON.stringify(r0.ref));
  console.log("ui", JSON.stringify(r0.ui), "shiki", JSON.stringify(r0.shiki));
  console.log("redirect", JSON.stringify(r0.redirect));
  console.log("panels", JSON.stringify(r0.ui.panels));
  console.log("skip", JSON.stringify(r0.ui.skip));
  console.log("state panel", b.runs.map((r) =>
    stateOk(r.ui.state) ? "ok" : "FAIL").join(","));
  const errors = b.runs.flatMap((r) => r.logs)
    .filter((l) => /^(error|pageerror)/.test(l));
  console.log("console errors", errors.length);
  console.log("main thread: longest frame gap ms (until Solidity ready / " +
    "until done)", b.runs.map((r) => `${r.frames.maxBeforeSol.toFixed(0)}` +
    ` / ${r.frames.max.toFixed(0)}`).join(", "),
    "loading shown", b.runs.map((r) => r.frames.loadingShown).join(","));
  for (const r of b.runs) {
    for (const part of ["a", "fe", "bug", "b"]) {
      check(name, `part ${part}`, r[part]?.ok);
    }
    const u = r.ui;
    for (const p of ["sol", "fe"]) {
      check(name, `${p} stepping`, u[p].intoOk && u[p].sliderOk
        && u[p].backOk
        && u[p].keyOk && u[p].keyLeftOk && u[p].run.ok && u[p].hl > 0
        && u[p].hlWhenGen === 0 && !u[p].pageScrollX);
    }
    check(name, "part ref", r.ref?.ok);
    for (const lvl of ["O0", "O2"]) {
      const o = u.bug[lvl];
      check(name, `BUG ${lvl} stepping`, o.stepperShown && o.aboutShown
        && o.framesShown && o.varsShown && o.intoOk && o.overOutEnabled
        && o.over.ok);
      check(name, `BUG ${lvl} call stack depth >= 2`, o.stack.synced
        && o.stack.depth >= 2 && o.stack.frames.length >= 2);
    }
    // Scores, by hand: score(k) = k * k + sumTo(k) + 3, so score(1) =
    // 1 + 1 + 3 = 5, score(2) = 4 + 3 + 3 = 10, score(3) = 9 + 6 + 3 =
    // 18. Round i writes its score to recent[i - 1], one element per
    // round: [5, 0, 0], [5, 10, 0], [5, 10, 18]. stats.total = 5 + 10 +
    // 18 = 33; stats.plays = 1 at the end. last's pointer names only
    // its base slot (no entries).
    const RECENT = ["[0, 0, 0]", "[5, 0, 0]", "[5, 10, 0]", "[5, 10, 18]"]
      .map((a) => `length 3: ${a}`);
    // The values the program gives each variable (k: score's and
    // sumTo's; x: the inlined sq's). <no location>: listed by type only.
    const NONE = "<no location>";
    const VALUES = { i: ["1", "2", "3", "4"], s: ["5", "10", "18"],
      k: ["0", "1", "2", "3"], x: ["1", "2", "3"], bonus: ["3"],
      recent: RECENT, last: ["<mapping at slot 1>"],
      stats: ["0", "5", "15", "33"].map((t) =>
        `{ plays: 0, total: ${t} }`).concat("{ plays: 1, total: 33 }") };
    for (const lvl of ["O0", "O2"]) {
      const o = u.bug[lvl];
      check(name, `BUG ${lvl} final values`, !!o.local
        && same(o.last, { stats: "{ plays: 1, total: 33 }",
          last: "<mapping at slot 1>", recent: RECENT[3] }));
      // The deepest stack: sumTo(3) recurses down to sumTo(0), in
      // score(3).
      check(name, `BUG ${lvl} call stack frames`, same(
        o.stack.frames.map((f) => f.replace(/ (called|inlined) at.*/, "")),
        ["sumTo(k: 0)", "sumTo(k: 1)", "sumTo(k: 2)", "sumTo(k: 3)",
          "score(k: 3)"]));
      check(name, `BUG ${lvl} type-only local with its reason`,
        /no location here.*#291/.test(o.typeOnly?.note ?? ""));
      // recent, read through its pointer (the word, the length region,
      // the list of elements), takes each value in order.
      check(name, `BUG ${lvl} array recent: length and elements`,
        same(o.scan.recent, RECENT));
      // Every value read through a pointer is one the program gives.
      const bad = Object.entries(o.scan.values).flatMap(([n, vs]) =>
        vs.filter((v) => v !== NONE && !VALUES[n]?.includes(v))
          .map((v) => `${n}=${v}`));
      check(name, `BUG ${lvl} every pointer reads the program's value`
        + (bad.length ? ` (${bad.join(", ")})` : ""), bad.length === 0
        // Each name is read at some step (x: O2 only; bonus: O0 only).
        && Object.keys(VALUES).every((n) => (lvl === "O0" ? n === "x"
          : n === "bonus") || o.scan.values[n]?.some((v) => v !== NONE)));
    }
    // bonus: in memory at -O0 (3); folded at -O2, so listed by type
    // only, with its reason, at every step.
    const b0 = u.bug.O0.scan.bonus, b2 = u.bug.O2.scan.bonus;
    check(name, "BUG O0 bonus located (3)",
      b0.some((b) => b.value === "3"));
    check(name, "BUG O2 bonus folded: type-only at every step",
      b2.length === 1 && b2[0].value === NONE
      && /no location here.*#291/.test(b2[0].note));
    // sq inlined, three times (k = 1..3): x is marked inline, and its
    // pointer reads k, the argument score(k) gives it.
    const xs = u.bug.O2.inlineLocals;
    check(name, "BUG O2 inlined local x reads k through its pointer",
      xs.length === 3 && xs.every((e, k) => e.x.value === String(k + 1)
        && e.x.inline && /inline in sq/.test(e.x.note)
        && e.frames.some((f) => f.startsWith(`score(k: ${k + 1})`))));
    check(name, "BUG O0 no inline locals", u.bug.O0.inlineLocals
      .length === 0);
    // In sq's inlined bodies: the caller's storage variables stay
    // listed at every step, and x is listed from the step after the
    // inlined invoke up to the step of the instruction that carries
    // sq's return (contexts are postconditions), and nowhere else.
    const names = u.bug.O2.scan.names, inl = sqInline.inline;
    const lost = inl.filter((i) => !names[i].includes("stats")
      || !names[i].includes("last"));
    check(name, "BUG O2 storage listed at every inlined step" +
      (lost.length ? ` (not at ${lost.slice(0, 5)})` : ""),
      inl.length > 0 && lost.length === 0);
    const xAt = names.flatMap((ns, i) => ns.includes("x") ? [i] : []);
    check(name, "BUG O2 x: from the inlined invoke to the inlined return",
      sqInline.spans.length === 3 && same(xAt, sqInline.spans.flat()));
    check(name, "BUG O2 inline marker", u.bug.O2.inline?.fn === "sq"
      && u.bug.O2.inline.noteVisible === "visible"
      && u.bug.O2.inline.site > 0);
    check(name, "state panel", stateOk(u.state));
    check(name, "skip compiler code on by default", u.skip.default);
    // Panels: call stack, inlining, variables on every tab; those without
    // data give their reason (expected: the data set's whyNot).
    const NAMES = ["Call stack", "Variables", "Inlining"];
    const missing = { sol: ["Call stack", "Inlining"],
      fe: NAMES, "bug-O0": ["Inlining"], "bug-O2": [] };
    for (const [ds, want] of Object.entries(missing)) {
      const ps = u.panels[ds];
      check(name, `${ds} panels`, same(ps.map((x) => x.name), NAMES)
        && ps.every((x) => x.shown && x.whyMuted));
      for (const x of ps) {
        const miss = want.includes(x.name);
        check(name, `${ds} ${x.name}: ${miss ? "reason" : "data"}`,
          miss ? !x.data && x.why.length > 20 : x.data);
      }
    }
    check(name, "sol: no-locals reason", /local variables/
      .test(u.panels.sol[1].why));
    for (const ds of ["sol", "fe", "bug-O0", "bug-O2"]) {
      const o = u.skip[ds];
      const on = Object.values(o.on), off = Object.values(o.off);
      check(name, `${ds} skip on: no stop on compiler code`,
        o.on["into+"].stops > 0 && on.every((x) => x.gen === 0));
      check(name, `${ds} skip off: a stop on compiler code`,
        off.some((x) => x.gen > 0));
      check(name, `${ds} skip note`, /ethdebug has no explicit marker/
        .test(o.note) && /Library code|Imported code/.test(o.note));
      check(name, `${ds} skip on: no stop in a library file`,
        on.every((x) => x.lib === 0));
    }
    // Fe steps through its standard library; skipping it is the point.
    check(name, "fe skip off: a stop in a library file",
      u.skip.fe.libSteps > 0 && Object.values(u.skip.fe.off)
        .some((x) => x.lib > 0));
    check(name, "sol skip note links ethdebug/format#329",
      u.skip.sol.link === "https://github.com/ethdebug/format/issues/329");
    if (r.redirect) check(name, "redirect from demos/soldb/", r.redirect.ok);
    check(name, "loading state", r.frames.loadingShown);
    check(name, `main thread free (gap < ${LONG} ms)`, r.frames.max < LONG);
    check(name, "worker requests listed", r.requests.some((u) =>
      u.endsWith("/shop-debug-rpc.trace.json")));
  }
  check(name, "no console errors", errors.length === 0);
  check(name, "no foreign requests",
    b.runs.every((r) => r.foreign.length === 0));
  console.log("total median ms", med(b.runs.map((r) => r.totalMs)).toFixed(0));
  console.log("foreign requests", b.runs.flatMap((r) => r.foreign));
  console.log("requests", r0.requests.map((u) => new URL(u).pathname));
  console.log("logs", [...new Set(b.runs.flatMap((r) => r.logs))]);
}
for (const [name, b] of Object.entries(all)) {
  check(name, `browser launch ${b.error ?? ""}`, !!b.runs);
}
for (const f of layoutFails) fails.push(f);

// sizes.js (make-sizes.sh) gives the loading bars each data file's
// size: it must match the files, and list every file the engines fetch.
{
  const sizes = Object.fromEntries([...fs.readFileSync(
    new URL("sizes.js", import.meta.url), "utf8")
    .matchAll(/"([^"]+)": (\d+)/g)].map((m) => [m[1], +m[2]]));
  const here = new URL("./", import.meta.url);
  const stale = Object.entries(sizes).filter(([f, n]) => {
    const u = new URL(f, here);
    return !fs.existsSync(u) || fs.statSync(u).size !== n;
  }).map(([f]) => f);
  check("sizes.js", "matches the files" +
    (stale.length ? ` (not: ${stale.join(", ")})` : ""), !stale.length);
  const base = new URL(PAGE).pathname;
  const fetched = Object.values(all).flatMap((b) => b.runs ?? [])
    .flatMap((r) => r.requests).map((u) => new URL(u).pathname)
    .filter((p) => p.startsWith(base)).map((p) => p.slice(base.length))
    .filter((p) => /^((art|bug|fe|replay|vendor)\/|pkg-|shop-)/.test(p)
      && !p.endsWith(".mjs"));
  const missing = [...new Set(fetched)].filter((p) => !(p in sizes));
  check("sizes.js", "lists every data file the page fetches" +
    (missing.length ? ` (not: ${missing.join(", ")})` : ""),
  fetched.length > 0 && !missing.length);
}

// A slow link: Chromium with CDP network emulation at Slow 3G (400
// kbps, 400 ms round trip), the page served as GitHub Pages serves it
// (every file gzipped: pages-server.mjs). One fresh page per tab: the
// default tab (Solidity) until it is usable, then a click on the tab.
// Times are from the start of navigation. Checks: the loader with its
// bar shows within 1 s of the HTML; the status line counts bytes; the
// default tab and each other tab become usable; no console errors.
const SLOW = { offline: false, latency: 400,
  downloadThroughput: 400 * 1000 / 8, uploadThroughput: 400 * 1000 / 8 };
const slow = {};
{
  const srv = await pagesServer(fileURLToPath(new URL("../..",
    import.meta.url)));
  const browser = await chromium.launch();
  for (const tab of ["sol", "fe", "bug"]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", SLOW);
    const errors = [];
    let wire = 0;
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    ctx.on("requestfinished", async (q) => {
      wire += (await q.sizes().catch(() => ({}))).responseBodySize ?? 0;
    });
    await page.addInitScript(() => {
      const t = window.__t = {};
      const tick = () => {
        const n = performance.now();
        const l = document.getElementById("loading");
        const bar = l?.querySelector(".progress");
        if (!t.loader && bar && bar.getClientRects().length) t.loader = n;
        const text = l?.querySelector(".load-status")?.textContent ?? "";
        if (!t.bytes && / of [\d.]+ [KM]B\)/.test(text)) {
          t.bytes = n;
          t.status = text;
        }
        if (!window.results?.ready) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    try {
      await page.goto(srv.url + "demos/debugger/", { waitUntil: "commit" });
      await page.waitForFunction(() => window.results?.ready, null,
        { timeout: 300000, polling: 100 });
      const ready = wire;
      slow[tab] = await page.evaluate(async (tab) => {
        const nav = performance.getEntriesByType("navigation")[0];
        const out = { ...window.__t, html: nav.responseEnd,
          ready: window.results.readyMs,
          hl: document.querySelectorAll("#stepper .hl").length };
        if (tab !== "sol") {
          const t = performance.now();
          await window.select(tab);
          out.click = performance.now() - t;
          out.hl = document.querySelectorAll("#stepper .hl").length;
        }
        out.usable = performance.now();
        if (tab === "sol") out.usable = out.ready;
        return out;
      }, tab);
      slow[tab].readyKB = Math.round(ready / 1000);
      slow[tab].tabKB = Math.round((wire - ready) / 1000);
    } catch (e) {
      slow[tab] = { error: String(e).split("\n")[0] };
    }
    slow[tab].errors = errors;
    await ctx.close();
  }
  await browser.close();
  await srv.close();
}
console.log("\nSlow 3G (Pages gzip), ms from navigation start; KB on the " +
  "wire until the default tab is ready, then for the tab:");
for (const [tab, r] of Object.entries(slow)) {
  console.log(`  ${tab}: ${JSON.stringify(r)}`);
  check("Slow 3G", `${tab}: usable`, !r.error && r.hl > 0);
  check("Slow 3G", `${tab}: no console errors (${r.errors})`,
    !r.errors.length);
}
const s0 = slow.sol;
check("Slow 3G", "loader and bar within 1 s of the HTML",
  !s0.error && s0.loader - s0.html <= 1000);
check("Slow 3G", "status line counts bytes", !s0.error && !!s0.bytes);

// A failed fetch, in each browser: the trace's request is aborted. The
// loader names what failed and offers a retry; the retry loads it.
const failure = {};
for (const [name, type] of [["chromium", chromium], ["firefox", firefox],
  ["webkit", webkit]]) {
  const browser = await type.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let block = true;
  await ctx.route("**/shop-debug-rpc.trace.json", (route) =>
    block ? route.abort() : route.continue());
  try {
    await page.goto(PAGE);
    await page.waitForSelector("#loading.err .btn:not([hidden])",
      { timeout: 60000 });
    const f = failure[name] = await page.evaluate(() => ({
      status: document.querySelector("#loading .load-status").textContent,
      tabsUsable: [...document.querySelectorAll("[role=tab]")]
        .every((t) => !t.disabled) }));
    block = false;
    await page.click("#loading .btn");
    await page.waitForFunction(() => window.results?.ready, null,
      { timeout: 60000 });
    f.recovered = await page.evaluate(() =>
      document.querySelectorAll("#stepper .hl").length > 0
      && !document.getElementById("stepper").classList.contains("loading"));
  } catch (e) {
    failure[name] = { error: String(e).split("\n")[0] };
  }
  console.log(`failure ${name}: ${JSON.stringify(failure[name])}`);
  check(name, "a failed fetch: its reason and a retry",
    /Could not load the transaction trace/.test(failure[name].status));
  check(name, "a failed fetch: the retry loads it",
    failure[name].recovered === true);
  await browser.close();
}
check("iPhone 15", "BUG tab: no sideways scroll",
  phone.bug.scrollW <= phone.bug.clientW);
console.log(fails.length ? `\nFAIL\n${fails.join("\n")}` : "\nPASS");
process.exitCode = fails.length ? 1 : 0;
fs.writeFileSync("results.json", JSON.stringify({ browsers: all, slow,
  failure }, null, 1));
