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
// Every data set: a tab, or a tab and its variant.
const DATASETS = ["sol", "fe", "bug-O0", "bug-O2", "old"];
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
          // The state panel: soldb's state(i), first and last steps, and
          // each value that changes, in order.
          const panel = box.querySelector(".state");
          const table = () => Object.fromEntries([...panel.querySelectorAll(
            "tr")].map((tr) => [tr.cells[0].textContent,
            tr.cells[1]?.textContent]));
          const settle = async () => {
            await window.stateReady();
            return panel.dataset.step === String(at());
          };
          go(0);
          let synced = await settle();
          const first = table(), changes = [];
          let prev = first;
          for (const i of w.changes) {
            go(i);
            synced &&= await settle();
            const t = table();
            for (const [k, v] of Object.entries(t)) {
              if (prev[k] !== v) changes.push(`${k}=${v}`);
            }
            prev = t;
          }
          go(w.n - 1);
          synced &&= await settle();
          out.state = { shown: !panel.querySelector("table").hidden,
            synced, first, last: table(), changes,
            marked: panel.querySelectorAll(".chg").length };
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
        // No multi-line span: the first span in the main file.
        if (multi < 0) multi = w.spans.findIndex((s) => s && s[0] === 0);
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
        // Each inlined body: its first step with a local of the inlined
        // function that has a value, and the call stack there.
        o.inlineLocals = [];
        for (let i = 1; i < w.n; i++) {
          if (!w.inline?.[i] || w.inline[i - 1]) continue;
          for (let j = i; j < w.n && w.inline[j]; j++) {
            go(j);
            await fsettle();
            const x = rows().filter((r) => r.inline
              && !r.value.startsWith("<"));
            if (x.length) {
              o.inlineLocals.push({ step: j, fn: w.inline[j].fn, locals: x,
                frames: stack() });
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
        // as read through its pointer: the values of every name, in
        // order, without repeats. And the Inlining panel, the source note
        // and the innermost call stack frame.
        o.scan = { values: {}, names: [], inlining: [], stacks: [] };
        const inlCur = box.querySelector(".inlining .cur");
        for (let i = 0; i < w.n; i++) {
          go(i);
          await fsettle();
          o.scan.names.push(rows().map((r) => r.name));
          o.scan.stacks.push(stack());
          const top = frames.querySelector("li:not(.muted)");
          o.scan.inlining.push({ panel: inlCur.textContent,
            note: note.textContent,
            top: top?.textContent.replace(/\s+/g, " ") ?? null,
            topInline: !!top?.querySelector(".badge") });
          for (const r of rows()) {
            const vs = o.scan.values[r.name] ??= [];
            if (!vs.includes(r.value)) vs.push(r.value);
          }
        }
        o.lineMs = lineMsOf(w);
      }
      // The old way, both data sets: at every step, the step line, the
      // source note and the call stack (from the source map's i and o).
      {
        await window.select("old");
        const w = window.walked.old;
        const o = out.old = { steps: [], aboutShown: !document
          .querySelector(".about[data-about=old]").hidden,
          framesShown: !frames.querySelector("ol").hidden,
          varsShown: !panel.querySelector("table").hidden };
        for (let i = 0; i < w.n; i++) {
          go(i);
          await fsettle();
          o.steps.push({ where: document.getElementById("where")
            .textContent, note: note.textContent, stack: stack(),
            hl: [...box.querySelectorAll(".hl")].map((e) => e.textContent)
              .join("") });
        }
      }
      // Skip compiler and library code. On (the default): into, over and
      // out never stop on a compiler-generated step (no span) or in a
      // library file, forward or back. Off: stepping into stops on one.
      // Over and out only where enabled (BUG; on Solidity and Fe every
      // step is at EVM depth 1).
      const skip = document.getElementById("skip");
      const setSkip = (on) => { if (skip.checked !== on) skip.click(); };
      out.skip = { default: skip.checked };
      for (const ds of ["sol", "fe", "bug-O0", "bug-O2", "old"]) {
        if (ds.includes("-")) await window.selectLevel(ds.split("-")[1]);
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
      // The Solidity tab at its first multi-line span in Arcade.sol.
      const showcase = () => page.evaluate(async (i) => {
        await window.select("sol");
        const range = document.querySelector("#stepper input[type=range]");
        range.value = String(i);
        range.dispatchEvent(new Event("input"));
        return i;
      }, ui.sol.multi);
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
      // The old way: the first step with a frame in its call stack.
      await page.evaluate(async (i) => {
        await window.select("old");
        const range = document.querySelector("#stepper input[type=range]");
        range.value = String(i);
        range.dispatchEvent(new Event("input"));
        await window.stateReady();
      }, ui.old.steps.findIndex((x) => x.stack.length > 1));
      await page.screenshot({ path: "screenshot-old.png", fullPage: true });
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
      for (const ds of ["sol", "fe", "bug-O0", "bug-O2", "old"]) {
        if (ds.includes("-")) await window.selectLevel(ds.split("-")[1]);
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
// What the transaction gives each variable, checked by hand against the
// sources (sol/Arcade.sol, bug/arcade.bug) and the story
// (arcade-story.json): deploy with a 50-byte motd; alice, bob and carol
// join (accounts 1, 2, 3); alice hits twice (+10, +20), bob hits (+10),
// carol misses; then the traced call, alice's third play, a hit. Before
// it: alice's combo 2; total 40, rounds 3. In it: hit = true; combo = 2
// + 1 = 3; multiplied(10, 3): m = 5, then 3 (3 < 5), so gained = 10 * 3
// = 30; then total = 40 + 30 = 70, rounds = 4. roster: the three
// players, in the order they joined. players' pointer names only its
// base slot. <no location>: a local listed by type only.
const NONE = "<no location>";
const MOTD = "season 2 starts friday, see you on the leaderboard";
const ROSTER = ["0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  "0x90f79bf6eb2c4f870365e785982e1f101e93b906"];
const EXPECT = {
  values: { points: ["10"], combo: ["3"], m: ["5", "3"], gained: ["30"],
    hit: ["true"], total: ["40", "70"], rounds: ["3", "4"],
    motd: [JSON.stringify(MOTD)],
    roster: [`length 3: [${ROSTER.join(", ")}]`],
    players: ["<mapping at slot 4>"] },
  last: { players: "<mapping at slot 4>",
    roster: `length 3: [${ROSTER.join(", ")}]`,
    motd: JSON.stringify(MOTD), total: "70", rounds: "4" },
  storage: ["roster", "motd", "total", "rounds", "players"],
  // The names as joined (story): each stored by Solidity's string rule.
  names: ["alice", "bob", "carol, the unstoppable combo queen"],
  // soldb's state at the Solidity tab's last step (play never reads
  // roster or motd, so the trace has no value for them).
  sol: { total: "70", rounds: "4", roster: "<unknown>" },
  // The real call at -O0, as the call stack lists it.
  call: "multiplied(points: 10, combo: 3)",
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const rd = (f) => JSON.parse(fs.readFileSync(new URL(f, import.meta.url),
  "utf8"));
// From bugc's program and its trace at each level, not from the page:
// for each function, the pcs where a real call enters it (its entry
// JUMPDEST, with an invoke) and leaves it (a return); and, for each
// inlined function, the steps of its inlined bodies.
const contexts = (c, out = []) => {
  if (!c) return out;
  out.push(c);
  for (const x of [...c.gather ?? [], ...c.pick ?? []]) contexts(x, out);
  return out;
};
const bugFacts = (lvl) => {
  const program = rd(`bug/arcade-${lvl}/arcade.program.json`);
  const pcs = rd(`bug/arcade-${lvl}/tx.debug-trace.json`).structLogs
    .map((l) => l.pc);
  const at = new Map(program.instructions.map((i) =>
    [i.offset, { op: i.operation?.mnemonic, cs: contexts(i.context) }]));
  const inline = new Set(), real = {};
  for (const { op, cs } of at.values()) {
    const inl = cs.some((c) => c.transform?.includes("inline"));
    for (const c of cs) {
      if (c.invoke && inl) inline.add(c.invoke.identifier);
    }
  }
  for (const [pc, { op, cs }] of at) {
    for (const c of cs) {
      const f = (c.invoke ?? c.return)?.identifier;
      if (!f || inline.has(f)) continue;
      const r = real[f] ??= { entry: new Set(), exit: new Set() };
      if (c.invoke?.jump && op === "JUMPDEST") r.entry.add(pc);
      if (c.return) r.exit.add(pc);
    }
  }
  // An inlined body: a run of steps whose instruction carries transform
  // "inline", from the one with the inlined invoke. Contexts are
  // postconditions, so the page lists it from the step after its first
  // instruction through the step of its inlined return, or, if the run
  // ends before a return, to the step after its last. (A run without an
  // invoke, such as a hoisted msg.sender, opens no body. At -O2, bugc
  // leaves the transform off part of multiplied's body, so its frame
  // closes early; a known bugc gap.)
  const spans = {};
  let run = null;
  pcs.forEach((pc, i) => {
    const cs = at.get(pc)?.cs ?? [];
    if (!cs.some((c) => c.transform?.includes("inline"))) {
      run = null;
      return;
    }
    const f = cs.find((c) => c.invoke)?.invoke.identifier;
    if (!run && f) (spans[f] ??= []).push(run = []);
    if (run && cs.some((c) => c.return)) {
      run = null;
      return;
    }
    run?.push(i + 1);
  });
  return { pcs, inline, real, spans };
};
const BUG = { O0: bugFacts("O0"), O2: bugFacts("O2") };
// The old way: the source and the AST's function definitions (name,
// range) of solc's optimized build.
const OLD = (() => {
  const out = rd("old/combined.json");
  const src = fs.readFileSync(new URL("sol/Arcade.sol", import.meta.url),
    "utf8");
  const fns = {};
  const walk = (x) => {
    if (Array.isArray(x)) return x.forEach(walk);
    if (!x || typeof x !== "object") return;
    if (x.nodeType === "FunctionDefinition") {
      const [s, l] = x.src.split(":").map(Number);
      fns[x.name] = src.slice(s, s + l);
    }
    Object.values(x).forEach(walk);
  };
  walk(out.sources["Arcade.sol"].AST);
  return { fns, lines: [null, ...src.split("\n")] };
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
  console.log("old", JSON.stringify(r0.old));
  console.log("ui", JSON.stringify(r0.ui), "shiki", JSON.stringify(r0.shiki));
  console.log("redirect", JSON.stringify(r0.redirect));
  console.log("panels", JSON.stringify(r0.ui.panels));
  console.log("skip", JSON.stringify(r0.ui.skip));
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
    check(name, "part old", r.old?.ok);
    for (const lvl of ["O0", "O2"]) {
      const o = u.bug[lvl], F = BUG[lvl];
      check(name, `BUG ${lvl} stepping`, o.stepperShown && o.aboutShown
        && o.framesShown && o.varsShown && o.intoOk && o.overOutEnabled
        && o.over.ok);
      check(name, `BUG ${lvl} call stack depth >= 1`, o.stack.synced
        && o.stack.depth >= 1 && o.stack.frames.length >= 1);
      check(name, `BUG ${lvl} final values`, !!o.local
        && Object.entries(EXPECT.last).every(([k, v]) => o.last[k] === v));
      // Real calls: a frame is listed from the first step inside the
      // callee (its entry JUMPDEST) through its exit JUMP, and gone at
      // the first step back in the caller (exact since ethdebug/format
      // #349).
      for (const [fn, { entry, exit }] of Object.entries(F.real)) {
        let live = 0;
        const wrong = [];
        F.pcs.forEach((pc, i) => {
          if (i > 0 && exit.has(F.pcs[i - 1])) live--;
          if (entry.has(pc)) live++;
          const shown = o.scan.stacks[i].filter((f) =>
            new RegExp(`^${fn}[( ]`).test(f) && !/inlined/.test(f)).length;
          if (shown !== live) wrong.push(i);
        });
        check(name, `BUG ${lvl} ${fn} frames open and close exactly` +
          (wrong.length ? ` (not at ${wrong.slice(0, 5)})` : ""),
        F.pcs.length === o.scan.stacks.length && entry.size > 0
          && exit.size > 0 && wrong.length === 0);
      }
      check(name, `BUG ${lvl} type-only local with its reason`,
        /no location here.*#291/.test(o.typeOnly?.note ?? ""));
      // Every value read through a pointer is one the transaction gives,
      // and each name is read at some step.
      const bad = Object.entries(o.scan.values).flatMap(([n, vs]) =>
        vs.filter((v) => v !== NONE && !EXPECT.values[n]?.includes(v))
          .map((v) => `${n}=${v}`));
      const unread = Object.keys(EXPECT.values).filter((n) =>
        !o.scan.values[n]?.some((v) => v !== NONE));
      check(name, `BUG ${lvl} every pointer reads the transaction's value` +
        (bad.length ? ` (${bad.join(", ")})` : "") +
        (unread.length ? ` (never read: ${unread.join(", ")})` : ""),
      !bad.length && !unread.length);
      // In an inlined body, the caller's storage variables stay listed.
      const inl = Object.values(F.spans).flat(2);
      const lost = inl.filter((i) => !EXPECT.storage.every((n) =>
        o.scan.names[i].includes(n)));
      check(name, `BUG ${lvl} storage listed at every inlined step` +
        (lost.length ? ` (not at ${lost.slice(0, 5)})` : ""),
      !lost.length);
      // The Inlining panel and the call stack agree at every step: the
      // panel names an inlined body exactly when the innermost frame is
      // an inlined one, of the same function, at the steps after the
      // instructions marked inline (the frame opens one step late;
      // known). Neither panel nor note reads "?" or "-1".
      const sc = o.scan.inlining, wrong = [], inBody = {};
      sc.forEach((x, i) => {
        const m = /in the body of (\S+), inlined at line (\S+)\./
          .exec(x.panel);
        const fn = x.top?.split(/[ (]/)[0];
        if (!!m !== x.topInline || (m && m[1] !== fn)
          || /\?|-1/.test(x.panel) || /body of \?|line -1|call \?/
            .test(x.note)) wrong.push(i);
        if (m) (inBody[m[1]] ??= []).push(i);
      });
      check(name, `BUG ${lvl} Inlining panel agrees with the call stack`
        + (wrong.length ? ` (not at ${wrong.slice(0, 5)})` : ""),
      sc.length > 0 && wrong.length === 0);
      check(name, `BUG ${lvl} inlined steps: invoke to return`,
        same(Object.keys(inBody).sort(), Object.keys(F.spans).sort())
        && Object.entries(F.spans).every(([fn, sp]) =>
          same(inBody[fn], sp.flat())));
    }
    // -O0: bonus is a real call, with its arguments; -O2: it is inlined,
    // and its locals read their values inside the inlined body.
    check(name, "BUG O0 the real call, with its arguments",
      u.bug.O0.scan.stacks.some((st) => st.some((f) =>
        f.startsWith(EXPECT.call))));
    // The names, from the storage before the transaction (written by
    // the joins): a short name sits in its slot with 2 * length in the
    // last byte; a long one has 2 * length + 1 there and its bytes in
    // the words from keccak256(slot) on.
    for (const lvl of ["O0", "O2"]) {
      const st = Object.values(rd(`bug/arcade-${lvl}/tx.storage-before.json`))
        .map((w) => w.slice(2));
      const ok = EXPECT.names.every((n) => {
        const hex = Buffer.from(n).toString("hex");
        if (n.length < 32) {
          return st.includes(hex.padEnd(62, "0") +
            (2 * n.length).toString(16).padStart(2, "0"));
        }
        return st.includes((2 * n.length + 1).toString(16).padStart(64, "0"))
          && st.includes(hex.slice(0, 64))
          && st.includes(hex.slice(64).padEnd(64, "0"));
      });
      check(name, `BUG ${lvl} names stored as joined`, ok);
    }
    check(name, "BUG O0 nothing inlined", !BUG.O0.inline.size
      && u.bug.O0.inlineLocals.length === 0);
    const xs = u.bug.O2.inlineLocals;
    check(name, "BUG O2 inlined locals read through their pointers",
      BUG.O2.inline.size > 0 && xs.length > 0 && xs.every((e) =>
        BUG.O2.inline.has(e.fn) && e.frames.some((f) => /inline/.test(f))
        && e.locals.every((l) => EXPECT.values[l.name]?.includes(l.value)
          && new RegExp(`inline in ${e.fn}`).test(l.note))));
    check(name, "BUG O2 inline marker", BUG.O2.inline.has(u.bug.O2.inline?.fn)
      && u.bug.O2.inline.noteVisible === "visible"
      && u.bug.O2.inline.site > 0);
    // The old way. (1) Most steps map to the whole contract. (3) No
    // inlined helper gets a frame: rolledHit and
    // multiplied run, with no frame named for any of the three
    // helpers; instead, five jumps marked i open frames with no
    // function in the AST, three of them on `+= 1` statements.
    const old = u.old, rec = old.steps;
    const whole = rec.filter((x) => /the whole contract/.test(x.note));
    check(name, "old: most steps map to the whole contract",
      whole.length > 0.6 * rec.length && whole.length === r.old.whole
      && rec.every((x) => / source map -?\d+:-?\d+:-?\d+:[io-]$/
        .test(x.where)));
    // (2) The roll's `% 3`: its constant 3, pushed just before the roll
    // starts and used by the roll's MOD (hand-checked: pc 1986 PUSH1 03,
    // the operand of the MOD at pc 2023), maps to `players` on line 26.
    // So the step before rolledHit (line 40) shows line 26.
    const mod = rec.findIndex((x) => / MOD,/.test(x.where));
    const k = rec.findLastIndex((x, i) => i < mod
      && /Arcade\.sol:26,/.test(x.where) && x.hl === "players");
    check(name, "old: the roll's 3 maps to players on line 26",
      OLD.lines[40].includes("% 3") && OLD.lines[26].includes("players")
      && mod > 0 && k > 0 && / pc 1986 PUSH1,/.test(rec[k].where)
      && /Arcade\.sol:40,/.test(rec.slice(k + 1).find((x) => x.hl)?.where)
      && /the whole contract/.test(rec[mod].note));
    const helpers = ["rolledHit", "multiplied", "resetCombo"];
    check(name, "old: no frame for an inlined helper",
      ["rolledHit", "multiplied"].every((fn) => rec.some((x) =>
        new RegExp(`, function ${fn},`).test(x.where)))
      && rec.every((x) => !x.stack.some((f) =>
        helpers.some((h) => f.startsWith(h)))));
    const unnamed = r.old.jumps.filter((j) => j.name === null);
    check(name, "old: five frames enter compiler helpers",
      unnamed.length === 5
      && unnamed.filter((j) => /\+= 1$/.test(j.site ?? "")).length === 3
      && r.old.jumps.some((j) => j.name === "play"));
    check(name, "old: the panels", old.aboutShown && old.framesShown
      && !old.varsShown);
    check(name, "skip compiler code on by default", u.skip.default);
    // Panels: call stack, inlining, variables on every tab; those without
    // data give their reason (expected: the data set's whyNot).
    const NAMES = ["Call stack", "Variables", "Inlining"];
    const missing = { sol: ["Call stack", "Inlining"], fe: NAMES,
      "bug-O0": ["Inlining"], "bug-O2": [], old: ["Variables", "Inlining"] };
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
    // soldb's state(i), read through solc's pointers: the values the
    // transaction gives (EXPECT.sol), as of the last step.
    check(name, "sol state panel: last step" + ` (${JSON.stringify(
      u.state?.last)})`, u.state?.shown && u.state.synced
      && Object.entries(EXPECT.sol).every(([k, v]) => u.state.last[k] === v));
    for (const ds of DATASETS) {
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
      u.endsWith("/sol/play.trace.json")));
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
    .filter((p) => /^((art|bug|fe|old|sol|replay|vendor)\/|pkg-)/.test(p)
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
  for (const tab of ["sol", "fe", "bug", "old"]) {
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
  await ctx.route("**/sol/play.trace.json", (route) =>
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
