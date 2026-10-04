// The memory section: memory at two handpicked points of a BUG program's
// trace, as two dumps (A, then B), linked to the values bugc says are in
// memory there. Each value's bytes are the regions that the reference
// library (@ethdebug/pointers) returned for bugc's pointer, against that
// point's memory (decode.js decodeLocals); this file only lays those
// regions over words. The decoding to a value is the page's own.
import { decodeLocals, decodeStored, typeName } from "./decode.js";
import {
  octets, ruler, paint, initialHash, setHash, locked, details,
} from "./panel.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = (h) => Number(BigInt(h === undefined || h === "0x" ? 0 : h));
const hex = (n, w = 4) => "0x" + n.toString(16).padStart(w, "0");
const SIDES = ["before", "after"]; // A and B: the page's dump styles
const TINTS = 5;

window.memResults = { done: false, errors: [], decoded: {} };

let data; // fixtures/memory.json
const values = {}; // point id -> decoded values in memory
const stored = {}; // point id -> decoded values in storage
const chains = {}; // point id -> frame bases, newest first
const pick = { before: "before", after: "loop" }; // side -> point id
// Which dump to show: "before" (A) or "after" (B)
let mode = "after";

// ------------------------------------------------------------- model

// The memory bytes a region covers, as [word offset, byte index] pairs
function regionBytes(r) {
  if (r.location !== "memory") return [];
  const o = num(r.offset);
  const n = num(r.length ?? "0x20");
  return Array.from({ length: n }, (_, k) =>
    [hex(Math.floor((o + k) / 32) * 32), (o + k) % 32]);
}

// "0x01a0–0x01bf"
const span = (r) => {
  const o = num(r.offset);
  return `${hex(o)}–${hex(o + num(r.length ?? "0x20") - 1)}`;
};

const point = (side) => data.points.find((p) => p.id === pick[side]);
const word = (o) => ({ location: "memory", offset: hex(o), length: "0x20" });
const FRAMES = "#frames"; // the frame chain's row

// The frames on the stack at a point: from the frame pointer at 0x80,
// each frame's first word to the caller's frame (0 ends it). Read by
// this page from memory, not from bugc's pointers.
function frameChain(memory) {
  const b = pairs(memory);
  const at = (o) => num("0x" + (b.slice(o, o + 32).join("") || "0"));
  const out = [];
  for (let f = at(0x80); f && out.length < 16; f = at(f)) out.push(f);
  return out;
}
const pairs = (m) => (m.slice(2).match(/../g) ?? []);

function build() {
  const owners = new Map(); // id -> { id, row, label, regions, text }
  const cover = { before: new Map(), after: new Map() };
  const own = (id, row, label, side, region, text) => {
    if (!owners.has(id)) {
      owners.set(id, { id, row, label, text: {},
        regions: { before: [], after: [] } });
    }
    const o = owners.get(id);
    o.regions[side].push(region);
    if (text !== undefined) o.text[side] = text;
    for (const [w, i] of regionBytes(region)) {
      if (!cover[side].has(w)) {
        cover[side].set(w, Array.from({ length: 32 }, () => []));
      }
      const ids = cover[side].get(w)[i];
      if (!ids.includes(id)) ids.push(id);
    }
  };
  for (const side of SIDES) {
    for (const v of values[pick[side]]) {
      own(v.name, v.name, v.name, side, v.region, v.text);
      for (const p of v.parts) {
        own(`${v.name}#${p.region.name}`, v.name,
          `${v.name} (${p.region.name} pointer)`, side, p.region);
      }
    }
    // The frame chain: the frame pointer at 0x80, and each frame's
    // first word, which holds its caller's frame pointer
    const fp = chains[pick[side]];
    if (fp.length) {
      own(FRAMES, FRAMES, "frame pointer (0x80)", side, word(0x80));
      fp.forEach((f, k) => own(`${FRAMES}${f}`, FRAMES,
        `frame ${hex(f)}: caller's frame pointer${k === fp.length - 1
          ? " (none)" : ""}`, side, word(f)));
    }
  }
  const bytes = { before: pairs(point("before").memory),
    after: pairs(point("after").memory) };
  // Words to show: those a value lives in, and those that changed
  const words = new Set([...cover.before.keys(), ...cover.after.keys()]);
  const size = Math.max(bytes.before.length, bytes.after.length);
  for (let w = 0; w < size; w += 32) {
    const a = bytes.before.slice(w, w + 32).join("");
    const b = bytes.after.slice(w, w + 32).join("");
    if (a !== b) words.add(hex(w));
  }
  const order = [...words].sort((x, y) => num(x) - num(y));
  return { owners, cover, bytes, order };
}

// --------------------------------------------------------- the dumps

function groups(ids) {
  const out = [];
  ids.forEach((list, i) => {
    const key = list.join("|");
    const last = out[out.length - 1];
    if (last && last.key === key) last.to = i;
    else out.push({ key, owners: list, from: i, to: i });
  });
  return out;
}

function wordHtml(m, w, side, tint) {
  const at = num(w);
  const mine = m.bytes[side];
  const other = m.bytes[side === "before" ? "after" : "before"];
  const ids = m.cover[side].get(w) ?? Array.from({ length: 32 }, () => []);
  const cells = [];
  for (const g of groups(ids)) {
    const label = g.owners.map((id) => m.owners.get(id).label).join(", ");
    for (let i = g.from; i <= g.to; i++) {
      const b = mine[at + i];
      const cls = ["b"];
      if (g.owners.length) cls.push(`t${tint.get(g.owners[0]) % TINTS}`);
      else cls.push("free");
      if (i === g.from) cls.push("gs");
      if (i === g.to) cls.push("ge");
      if (b === undefined) cls.push("past");
      else if (b === "00") cls.push("z");
      if (b !== undefined && b !== other[at + i]) cls.push("chg");
      const first = i === g.from && g.owners.length;
      cells.push(`<span class="${cls.join(" ")}" data-i="${i}"` +
        ` data-g="${g.from}-${g.to}"${g.owners.length
          ? ` data-owners="${esc(g.owners.join("|"))}"` : ""}` +
        `${first ? ` tabindex="0" role="button" aria-label="${esc(
          `${label}, bytes ${g.from} to ${g.to} of word ${w}, ${
            side === "before" ? "A" : "B"}`)}"` : ""}` +
        `>${b ?? "··"}</span>`);
    }
  }
  return `<div class="word" data-side="${side}" data-slot="${w}">` +
    `<div class="bytes">${octets(cells)}</div></div>`;
}

function renderDumps(m) {
  const rows = m.order.map((w) => {
    const tint = new Map();
    for (const side of SIDES) {
      for (const ids of m.cover[side].get(w) ?? []) {
        for (const id of ids) if (!tint.has(id)) tint.set(id, tint.size);
      }
    }
    const at = num(w);
    const a = m.bytes.before.slice(at, at + 32);
    const b = m.bytes.after.slice(at, at + 32);
    const facts = !a.length ? "not yet in memory at A"
      : !b.length ? "not in memory at B"
        : a.join("") === b.join("") ? "unchanged" : "changed";
    return { w, n: at, tint, facts, same: facts === "unchanged" };
  });
  const gap = `<div class="gap" aria-hidden="true"><span>⋯</span></div>`;
  const view = (side) => {
    const p = point(side);
    const tag = side === "before" ? "A" : "B";
    const lines = [];
    rows.forEach((x, k) => {
      if (k === 0 ? x.n !== 0 : x.n !== rows[k - 1].n + 32) lines.push(gap);
      const what = `word ${x.w}, ${x.facts}`;
      lines.push(`<div class="wrow${x.same ? " same" : ""}${k % 2
        ? " zb" : ""}"` +
        ` data-slot="${x.w}" data-name="word ${x.w}"` +
        ` data-facts="${esc(x.facts)}">` +
        `<span class="addr" tabindex="0" title="${esc(what)}"` +
        ` aria-label="${esc(what)}"><span class="a">${x.w}</span></span>` +
        wordHtml(m, x.w, side, x.tint) + `</div>`);
    });
    lines.push(gap);
    return `<div class="view" data-side="${side}" role="group"` +
      ` aria-label="Memory at ${tag}, ${esc(p.title)}">` +
      `<div class="view-head"><span class="view-name">${tag} · ${
        esc(p.title)}</span>` +
      `<div class="wrow head"><span class="addr"></span>${ruler()}</div>` +
      `</div><div class="rows">${lines.join("")}</div></div>`;
  };
  return `<p class="muted small swipe">Each word is one line of 32 bytes;
    scroll sideways to see bytes 24 to 31.</p>` +
    `<div class="views">${view("before")}${view("after")}</div>`;
}

// ------------------------------------------------------- the values

function renderValues(m) {
  const names = [];
  for (const side of SIDES) {
    for (const v of values[pick[side]]) {
      if (!names.includes(v.name)) names.push(v.name);
    }
  }
  const find = (side, n) => values[pick[side]].find((v) => v.name === n);
  return `<ul>${names.map((n) => {
    const [a, b] = SIDES.map((side) => find(side, n));
    const v = b ?? a;
    const val = (x) => x ? esc(x.text) : `<i title="bugc's variables ` +
      `context at this point does not list it">not listed here</i>`;
    const changed = a?.text !== b?.text;
    const one = mode === "before" ? a : b;
    const where = (x) => x ? span(x.region) : "—";
    const moved = a && b && span(a.region) !== span(b.region);
    const part = v.parts.length ? ` · offset read from the ${esc(
      v.parts.map((p) => `${p.region.name} pointer at ${span(p.region)}`)
        .join(", "))}` : "";
    return `<li data-path="${esc(n)}" class="top ${changed ? "chg" : "same"}">` +
      `<div class="row" tabindex="0" role="button" aria-pressed="false">` +
      `<span class="name">${esc(n)}</span>` +
      `<span class="type">${esc(typeName(v.type, {}))}</span>` +
      `<span class="mval ${changed ? "chg" : "same"}"><span>${val(one)}` +
      `</span></span></div>` +
      `<div class="mwhere small muted">A ${where(a)} · B ${where(b)}${
        moved ? " (moved)" : ""}${part}</div></li>`;
  }).join("")}${framesRow()}${storedRows()}</ul>`;
}

// One row: a name, a type and the value at A and at B
function rowHtml(path, name, type, a, b, where) {
  const changed = a !== b;
  const val = (x) => x === undefined ? "<i>none</i>" : esc(x);
  const one = mode === "before" ? a : b;
  return `<li data-path="${esc(path)}" class="top ${changed ? "chg"
    : "same"}"><div class="row" tabindex="0" role="button"` +
    ` aria-pressed="false"><span class="name">${esc(name)}</span>` +
    `<span class="type">${esc(type)}</span>` +
    `<span class="mval ${changed ? "chg" : "same"}"><span>${val(one)}` +
    `</span></span></div><div class="mwhere small muted">${where}</div></li>`;
}

// The frames on the stack, newest first, as the page reads them
function framesRow() {
  const [a, b] = SIDES.map((s) => chains[pick[s]]);
  if (!a.length && !b.length) return "";
  const list = (fp) => fp.length ? fp.map((f) => hex(f)).join(", ")
    : "none";
  return rowHtml(FRAMES, "frames", "read by this page", list(a), list(b),
    "Newest first. 0x80 holds the current frame; each frame's first " +
    "word holds its caller's frame (0: none). Each call has its own " +
    "<code>a</code> and <code>b</code> in its frame.");
}

// Values bugc says are in storage (no bytes in memory to light)
function storedRows() {
  const names = [...new Set(SIDES.flatMap((s) =>
    stored[pick[s]].map((v) => v.name)))];
  return names.map((n) => {
    const [a, b] = SIDES.map((s) =>
      stored[pick[s]].find((v) => v.name === n));
    const v = b ?? a;
    return rowHtml(`storage:${n}`, n, typeName(v.type, {}), a?.text,
      b?.text, `In storage, slot ${num(v.region.slot)} (not in memory);` +
      " read by the library from bugc's storage pointer.");
  }).join("");
}

// ------------------------------------------------------- highlight

const key = (side, w, i) => `${side}|${w}|${i}`;

function ownerBytes(m, ids) {
  const out = new Set();
  for (const id of ids) {
    const o = m.owners.get(id);
    for (const side of SIDES) {
      for (const r of o?.regions[side] ?? []) {
        for (const [w, i] of regionBytes(r)) out.add(key(side, w, i));
      }
    }
  }
  return out;
}

function valueLabel(m, n) {
  if (n === FRAMES) {
    const list = (s) => chains[pick[s]].map((f) => hex(f)).join(" → ") ||
      "none";
    return `frames · A: ${list("before")} · B: ${list("after")}`;
  }
  if (n.startsWith("storage:")) {
    const k = n.slice(8);
    const v = (s) => stored[pick[s]].find((x) => x.name === k);
    const t = (s) => v(s)?.text ?? "none";
    const slot = num((v("after") ?? v("before")).region.slot);
    return `${k} · storage slot ${slot} · A: ${t("before")} · B: ${
      t("after")}`;
  }
  const side = (s) => {
    const v = values[pick[s]].find((x) => x.name === n);
    return v ? `${span(v.region)} = ${v.text}` : "not listed";
  };
  return `${n} · A: ${side("before")} · B: ${side("after")}`;
}

function forValue(m, n) {
  const ids = [...m.owners.keys()].filter((id) => m.owners.get(id).row === n);
  // the details: one row per point, from the label's parts
  const [name, ...parts] = valueLabel(m, n).split(" · ");
  const code = (x) => `<code>${esc(x)}</code>`;
  return { bytes: ownerBytes(m, ids), rows: new Set([n]),
    label: valueLabel(m, n),
    info: [["Value", code(name)], ...parts.map((p) => {
      const k = p.match(/^(A|B): (.*)$/);
      return k ? [k[1], esc(k[2])] : ["", esc(p)];
    })] };
}

function forBytes(m, cell) {
  const w = cell.closest(".word").dataset.slot;
  const ids = (cell.dataset.owners ?? "").split("|").filter(Boolean);
  const [from, to] = cell.dataset.g.split("-").map(Number);
  const at = num(w);
  const h = (side) => {
    const b = m.bytes[side].slice(at + from, at + to + 1);
    return b.length ? "0x" + b.join("") : "not in memory";
  };
  const range = from === to ? `byte ${from}` : `bytes ${from}–${to}`;
  const where = `${range} of word ${w} (${hex(at + from)}–${hex(at + to)})`;
  const vals = h("before") === h("after") ? `${h("after")} (same at A and B)`
    : `A ${h("before")} → B ${h("after")}`;
  if (!ids.length) {
    return { bytes: new Set(), rows: new Set(), at: { s: w, from, to },
      label: `${where} · ${vals} · no value shown owns these bytes` };
  }
  const names = ids.map((id) => m.owners.get(id).label).join(", ");
  return { bytes: ownerBytes(m, ids), at: { s: w, from, to },
    rows: new Set(ids.map((id) => m.owners.get(id).row)),
    label: `${names} · ${where} · ${vals}` };
}

function forWord(m, w) {
  return { bytes: new Set(), rows: new Set(), at: { s: w, from: 0, to: 31 },
    label: `word ${w} (${hex(num(w))}–${hex(num(w) + 31)})` };
}

// ------------------------------------------------------------ page

let model;
let hover = null;
let chosen = null; // the selected value's name
const PROBE = "Point at a value or a byte for its details.";

function show() {
  const sel = chosen ? forValue(model, chosen) : null;
  const h = hover ?? sel;
  paint($("mpanel"), $("mtree"), h,
    { before: "at A", after: "at B", dumps: { before: "A", after: "B" } });
  for (const r of $("mtree").querySelectorAll("li[data-path] > .row")) {
    const on = r.parentElement.dataset.path === chosen;
    r.classList.toggle("sel", on);
    r.setAttribute("aria-pressed", String(on));
  }
  $("mdetails").innerHTML = details(h, PROBE);
  $("mviewing").hidden = !chosen;
  $("mviewing").textContent = chosen ? `viewing ${chosen === "#frames"
    ? "frames" : chosen.replace(/^storage:/, "")} · Esc to clear` : "";
  keep();
}

// The view in the URL hash: points A and B, the mode, the selection
let restored = false;
function keep() {
  if (!restored) return;
  setHash({ a: pick.before, b: pick.after, mmode: mode, msel: chosen });
}

// The source, with the code range of A and of B marked
function renderSource() {
  const src = data.program.source;
  const bytes = new TextEncoder().encode(src);
  const cls = new Array(bytes.length).fill("");
  for (const side of SIDES) {
    const r = point(side).range;
    if (!r) continue;
    for (let k = r.offset; k < r.offset + r.length; k++) {
      cls[k] += side === "before" ? "a" : "b";
    }
  }
  let html = "";
  let k = 0;
  const dec = (a, b) => new TextDecoder().decode(bytes.slice(a, b));
  while (k < bytes.length) {
    let e = k;
    while (e < bytes.length && cls[e] === cls[k]) e++;
    const t = esc(dec(k, e));
    html += cls[k] ? `<mark class="m${cls[k]}" title="${cls[k] === "ab"
      ? "A and B" : cls[k].toUpperCase()}">${t}</mark>` : t;
    k = e;
  }
  $("msrc").innerHTML = html;
}

function render() {
  model = build();
  $("mtree").innerHTML = renderValues(model);
  $("mpanel").innerHTML = renderDumps(model);
  for (const v of $("mpanel").querySelectorAll(".view")) {
    v.hidden = v.dataset.side !== mode;
  }
  for (const b of $("mmode").querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(b.dataset.mode === mode));
  }
  renderSource();
  for (const side of SIDES) {
    for (const b of $(`mpick-${side}`).querySelectorAll("button")) {
      b.setAttribute("aria-checked", String(b.dataset.id === pick[side]));
      b.disabled = b.dataset.id === pick[side === "before" ? "after"
        : "before"];
    }
  }
  const p = (side) => point(side);
  $("mnote").textContent = `A: ${p("before").title} (${p("before").note}) ·` +
    ` B: ${p("after").title} (${p("after").note})`;
  hover = null;
  show();
}

function target(el) {
  if (!model || !el?.closest) return null;
  if (el.closest("#mpanel .tray")) return hover;
  const cell = el.closest("#mpanel .b[data-g]");
  if (cell) return forBytes(model, cell);
  const addr = el.closest("#mpanel .wrow[data-slot] .addr");
  if (addr) return forWord(model, addr.parentElement.dataset.slot);
  const li = el.closest("#mtree li[data-path]");
  if (li) return forValue(model, li.dataset.path);
  return null;
}

const same = (a, b) => a?.label === b?.label &&
  JSON.stringify(a?.at) === JSON.stringify(b?.at);

function onOver(e) {
  if (!e.target.closest?.("#memory")) {
    if (hover) {
      hover = null;
      show();
    }
    return;
  }
  // while a value is selected, the view stays on it
  const h = locked(target(e.target), chosen && forValue(model, chosen));
  if (!same(h, hover)) {
    hover = h;
    show();
  }
}

// Select the value a row or a byte belongs to; the selected row again,
// or a byte no value owns, clears the selection
function choose(el) {
  const row = el.closest("#mtree li[data-path]");
  const cell = el.closest("#mpanel .b[data-g]");
  const id = cell && (cell.dataset.owners ?? "").split("|")[0];
  const p = row ? row.dataset.path : id ? model.owners.get(id).row : null;
  chosen = row && p === chosen ? null : p;
  hover = null;
  show();
}

function wire() {
  document.addEventListener("pointerover", onOver);
  document.addEventListener("focusin", onOver);
  const sec = $("memory");
  sec.addEventListener("click", (e) => {
    const b = e.target.closest(".mpick button");
    if (b) {
      pick[b.closest(".mpick").dataset.side] = b.dataset.id;
      return render();
    }
    const m = e.target.closest("#mmode button");
    if (m) {
      mode = m.dataset.mode;
      return render();
    }
    if (e.target.closest("#mpanel .b[data-g], #mtree .row")) {
      return choose(e.target);
    }
    // Empty space clears the selection; controls and text do not
    if (e.target.closest("a, button, summary, #msrc, #mdetails, .addr, " +
      ".tray, " +
      ".mwhere") || String(window.getSelection?.() ?? "")) return;
    if (chosen) {
      chosen = null;
      show();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !chosen) return;
    const f = document.activeElement;
    if (f?.closest?.("#memory") || !f || f === document.body) {
      chosen = null;
      show();
    }
  });
  sec.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const c = e.target.closest?.("#mpanel .b[tabindex], #mtree .row");
    if (c) {
      e.preventDefault();
      choose(c);
    }
  });
}

async function main() {
  data = await (await fetch("fixtures/memory.json")).json();
  for (const p of data.points) {
    values[p.id] = await decodeLocals(p.variables, p.memory);
    stored[p.id] = await decodeStored(p.variables, p.storage);
    chains[p.id] = frameChain(p.memory);
    window.memResults.decoded[p.id] = Object.fromEntries(
      values[p.id].map((v) => [v.name, { text: v.text, region: v.region,
        parts: v.parts.map((x) => x.region) }])
        .concat(stored[p.id].map((v) => [`storage:${v.name}`,
          { text: v.text, region: v.region }]))
        .concat([["frames", { chain: chains[p.id].map((f) => hex(f)) }]]));
  }
  $("mmode").innerHTML = [["before", "A"], ["after", "B"]].map(([m, t]) =>
    `<button role="radio" data-mode="${m}" aria-checked="false">${t}` +
    "</button>").join("");
  for (const side of SIDES) {
    $(`mpick-${side}`).innerHTML = data.points.map((p) =>
      `<button role="radio" data-id="${esc(p.id)}" aria-checked="false"` +
      ` title="${esc(p.note)}">${esc(p.title)}</button>`).join("");
  }
  $("mmeta").innerHTML = `Program <code>${esc(data.program.file)}</code>,` +
    ` compiled by bugc from PR #${data.compiler.pr} (commit <code>${
      data.compiler.commit.slice(0, 9)}</code>); the trace has ${
      data.trace.steps} steps.`;
  // Back to what the URL hash says, if it still makes sense
  const h = initialHash;
  const ids = data.points.map((p) => p.id);
  const [a, b] = [h.get("a"), h.get("b")];
  if (ids.includes(a) && ids.includes(b) && a !== b) {
    pick.before = a;
    pick.after = b;
  }
  if (["before", "after"].includes(h.get("mmode"))) {
    mode = h.get("mmode");
  }
  const sel = h.get("msel");
  wire();
  render();
  if (sel && $("mtree").querySelector(`li[data-path="${CSS.escape(sel)}"]`)) {
    chosen = sel;
  }
  restored = true;
  show();
  window.memResults.done = true;
}

main().catch((e) => {
  console.error(e);
  window.memResults.errors.push(String(e?.message ?? e));
  window.memResults.done = true;
  $("mtree").innerHTML = `<p class="error">Could not decode: ${esc(
    e?.message ?? e)}</p>`;
});
