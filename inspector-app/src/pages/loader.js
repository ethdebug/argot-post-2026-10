// The loader (vanilla index.html's, inlined at the end of the body by
// vite.config.ts): fetches the decoder bundle and the data with
// progress (bytes of total; a gzipped response is counted as its bytes
// after gzip is undone, which is what the sizes below give), and keeps
// each file it fetched. A failed load shows its error and a Retry
// button. The app (its module script) fetches a scene's data through
// window.loading.load() when the scene is shown.
(() => {
  // the size of each file, in bytes; the app's code, the entry last
  // (both written into the built page; the dev server loads the code
  // itself)
  const SIZES = /* sizes */{}/* end sizes */;
  const CODE = /* code */[]/* end code */;
  const bar = document.getElementById("loadbar");
  const files = new Map(); // url -> { got, size, label, shown, promise }
  let failures = []; // { text, retry }
  let hide;
  const kb = (n) => `${Math.round(n / 1024)} KB`;

  function draw() {
    const on = [...files.values()].filter((f) => f.shown);
    const busy = on.some((f) => !f.done);
    clearTimeout(hide);
    bar.classList.toggle("failed", failures.length > 0);
    const text = bar.querySelector(".text");
    const fill = bar.querySelector(".fill");
    bar.querySelector("button")?.remove();
    if (failures.length) {
      bar.hidden = false;
      text.textContent = failures.map((f) => f.text).join(" ");
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Retry";
      b.onclick = retry;
      bar.querySelector(".msg").append(b);
      fill.style.width = "100%";
      return;
    }
    if (!busy) {
      // done: the bar goes, and the next load starts from zero
      for (const f of on) f.shown = false;
      fill.style.width = "100%";
      hide = setTimeout(() => {
        bar.hidden = true;
      }, 300);
      return;
    }
    const got = on.reduce((n, f) => n + f.got, 0);
    const size = on.reduce((n, f) => n + Math.max(f.size, f.got), 0);
    const labels = [...new Set(on.filter((f) => !f.done)
      .map((f) => f.label))];
    bar.hidden = false;
    text.textContent = `Loading ${labels.length === 1 ? labels[0]
      : "the decoder and the data"}: ${kb(got)} of ${kb(size)}`;
    fill.style.width = `${size ? (100 * got) / size : 0}%`;
  }

  // Fetch a file once: JSON, or text with { text: true }. `quiet`: no
  // progress (a prefetch); a later load of the same file shows it.
  function load(url, { label = url, text = false, quiet = false } = {}) {
    let f = files.get(url);
    if (f) {
      if (!quiet && !f.shown && !f.done) {
        Object.assign(f, { shown: true, label });
        draw();
      }
      return f.promise;
    }
    f = { got: 0, size: SIZES[url] ?? 0, label, shown: !quiet,
      done: false };
    files.set(url, f);
    f.promise = (async () => {
      let res;
      try {
        res = await fetch(url);
      } catch {
        throw new Error("the network request failed");
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parts = [];
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
        f.got += value.length;
        if (f.shown) draw();
      }
      const all = new Uint8Array(f.got);
      let at = 0;
      for (const p of parts) {
        all.set(p, at);
        at += p.length;
      }
      const body = new TextDecoder().decode(all);
      return text ? body : JSON.parse(body);
    })().then((x) => {
      f.done = true;
      draw();
      return x;
    }, (e) => {
      files.delete(url);
      draw();
      throw new Error(`Could not load ${url} (${e.message}).`);
    });
    draw();
    return f.promise;
  }

  // Show a load error with a Retry button; `retry` loads again. Retry
  // retries every failed load.
  function fail(e, again) {
    failures.push({ text: String(e?.message ?? e), retry: again });
    draw();
  }

  function retry() {
    const again = failures.map((f) => f.retry);
    failures = [];
    draw();
    again.forEach((f) => f());
  }

  window.loading = { load, fail, retry, busy: () =>
    [...files.values()].some((f) => !f.done) };

  // The decoder and the app's code, the index, the scene the page opens
  // with, and the memory section's data, all at once; then the app runs
  // (its code from the HTTP cache). The decoder bundle is the app's own
  // chunk, vendor/pointers.js (on the dev server, a copy, for the bar).
  function boot() {
    const hash = new URLSearchParams(location.hash.slice(1));
    const ex = hash.get("ex");
    const buttons = [...document.querySelectorAll("#picker button")];
    // (the storage scene the page loads, and the scene shown: another
    // lens's, "Raw bytes", when the hash names it)
    const scenes = buttons.filter((b) => b.dataset.snapshot);
    const first = scenes.find((b) => b.dataset.id === ex) ?? scenes[0];
    const other = buttons.find((b) => b.dataset.lens &&
      b.dataset.id === hash.get("scene"));
    for (const b of buttons) {
      b.setAttribute("aria-checked", String(b === (other ?? first)));
    }
    document.querySelector("main")?.toggleAttribute("data-lens", !!other);
    // its intro, and no Before | After for a scene with one point
    for (const p of document.querySelectorAll("#intros [data-scene]")) {
      p.hidden = p.dataset.scene !== first?.dataset.id;
    }
    document.querySelector("main")?.toggleAttribute("data-single",
      !!first?.hasAttribute("data-single"));
    const label = "the decoder and the data";
    for (const f of ["fixtures/index.json",
      `snapshots/${first?.dataset.snapshot}.json`, "fixtures/memory.json",
      ...(other ? ["fixtures/raw.json"] : [])]) {
      // (the app loads them again, and shows a failure)
      load(f, { label }).catch(() => {});
    }
    const code = CODE.length ? CODE : ["vendor/pointers.js"];
    Promise.all(code.map((f) => load(f, { label, text: true })))
      .then(() => CODE.length && import(`./${CODE[CODE.length - 1]}`))
      .catch((e) => fail(e, boot));
  }
  boot();
})();
