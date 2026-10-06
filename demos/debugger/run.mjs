// Opens the page in real browsers (Playwright) and collects
// window.results. Usage: node run.mjs [runs]
import { chromium, firefox, webkit, devices } from "playwright";
const PAGE = process.env.PAGE
  ?? "http://localhost:8765/files/demos/debugger/";
// Shiki and its grammar/themes come from a CDN; nothing else may.
const CDN = ["esm.sh", "cdn.jsdelivr.net"];
const runs = +(process.argv[2] ?? 3);
const all = {};
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
    const el = document.getElementById("loading");
    if (el && !el.hidden && !window.walked?.sol) f.loadingShown = true;
    if (!window.results?.done) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};
for (const [name, type] of [["chromium", chromium], ["firefox", firefox],
  ["webkit", webkit]]) {
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
    await page.waitForFunction(() => window.results?.done, null,
      { timeout: 120000 });
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
      // call stack of depth >= 2, a local variable with a value (-O0)
      // and an inline marker (-O2).
      const frames = box.querySelector(".frames");
      const fsettle = async () => {
        await window.stateReady();
        return frames.dataset.step === String(at());
      };
      const rows = () => [...panel.querySelectorAll("tr")]
        .filter((tr) => tr.cells.length > 1).map((tr) =>
        ({ name: tr.cells[0].textContent, value: tr.cells[1].textContent,
          scope: tr.dataset.scope }));
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
  await page.waitForFunction(() => window.results?.done, null,
    { timeout: 120000 });
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
    await page.waitForFunction(() => window.results?.done, null,
      { timeout: 120000 });
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
    // Weights: sum = 4 + 6 + (8 + 3) + (10 + 6) = 37.
    check(name, "BUG O0 local variable with a value", !!u.bug.O0.local
      && same(u.bug.O0.last, { total: "37", calls: "1", n: "4",
        sum: "37" }));
    check(name, "BUG O2 storage", same(u.bug.O2.last,
      { total: "37", calls: "1" }));
    check(name, "BUG O2 inline marker", u.bug.O2.inline?.fn === "dbl"
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
check("iPhone 15", "BUG tab: no sideways scroll",
  phone.bug.scrollW <= phone.bug.clientW);
console.log(fails.length ? `\nFAIL\n${fails.join("\n")}` : "\nPASS");
process.exitCode = fails.length ? 1 : 0;
import("node:fs").then((fs) =>
  fs.writeFileSync("results.json", JSON.stringify(all, null, 1)));
