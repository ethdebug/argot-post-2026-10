// Opens the page in real browsers (Playwright) and collects
// window.results. Usage: node run.mjs [runs]
import { chromium, firefox, webkit, devices } from "playwright";
const PAGE = process.env.PAGE ?? "http://localhost:8000/demos/soldb/";
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
      const range = box.querySelector("input");
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
      for (const p of ["sol", "fe"]) {
        await window.select(p);
        const w = window.walked[p];
        if (p === "fe") out.feStateHidden = panel.hidden;
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
          out.state = { shown: !panel.hidden, first, last, synced, fast,
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
        out[p] = { intoOk, backOk, keyOk, keyLeftOk, disabled, shiftNoMove,
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
        const note = box.querySelector(".gen-note");
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
      // BUG tab: ethdebug's reference viewer, linked; soldb's stepper hidden.
      await window.select("bug");
      const about = document.querySelector("[data-about=bug]");
      out.bug = { stepperHidden: box.hidden, aboutShown: !about.hidden,
        src: document.getElementById("bug-src").textContent.slice(0, 10),
        link: about.querySelector("a[href*='trace-playground']")?.href,
        keysIgnored: (() => { press("ArrowRight"); return box.hidden; })() };
      await window.select("sol");
      return out;
    });
    r.ui = ui; r.shikiInfo = r.shiki;
    if (name === "chromium" && i === 0) {
      // Show the state panel where it says the most: a step in user code
      // that changes a value, with as few unknowns as possible.
      const showcase = () => page.evaluate(async () => {
        const box = document.getElementById("stepper");
        const range = box.querySelector("input");
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
        const range = document.querySelector("#stepper input");
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
      await page.evaluate(() => window.select("bug"));
      await page.screenshot({ path: "screenshot-bug.png", fullPage: true });
    }
    all[name].runs.push(r);
    await ctx.close();
  }
  await browser.close();
}
// Phone: iPhone 15 emulation (WebKit), stepped to a multi-line span.
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
    const range = document.querySelector("#stepper input");
    const sp = window.walked.fe.spans;
    range.value = String(sp.findIndex((s) => s && s[0] === 0 &&
      s[2] - s[1] > 60));
    range.dispatchEvent(new Event("input"));
    const d = document.documentElement;
    return { scrollW: d.scrollWidth, clientW: d.clientWidth };
  });
  await page.locator("#stepper").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "screenshot-highlight-iphone.png" });
  console.log("phone", JSON.stringify(w), logs);
  await browser.close();
}
// The state panel's expected values (Shop.place on a fresh contract).
const MAP = "<mapping; index it with [key]>", UNK = "<unknown>";
const want = {
  first: { orders: MAP, nextId: UNK, revenue: UNK, owner: UNK },
  last: { orders: MAP, nextId: "1", revenue: "30", owner: UNK },
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const stateOk = (st, fe) => st?.shown && st.synced && st.fast && fe
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
  console.log("ui", JSON.stringify(r0.ui), "shiki", JSON.stringify(r0.shiki));
  console.log("state panel", b.runs.map((r) =>
    stateOk(r.ui.state, r.ui.feStateHidden) ? "ok" : "FAIL").join(","));
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
      check(name, `${p} stepping`, u[p].intoOk && u[p].backOk
        && u[p].keyOk && u[p].keyLeftOk && u[p].run.ok && u[p].hl > 0
        && u[p].hlWhenGen === 0 && !u[p].pageScrollX);
    }
    check(name, "BUG tab", u.bug.stepperHidden && u.bug.aboutShown
      && u.bug.src.length > 0 && u.bug.keysIgnored);
    check(name, "state panel", stateOk(u.state, u.feStateHidden));
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
console.log(fails.length ? `\nFAIL\n${fails.join("\n")}` : "\nPASS");
process.exitCode = fails.length ? 1 : 0;
import("node:fs").then((fs) =>
  fs.writeFileSync("results.json", JSON.stringify(all, null, 1)));
