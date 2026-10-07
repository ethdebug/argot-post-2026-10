// The memory section: memory at two handpicked points of a BUG program's
// trace (A, then B), linked to the local variables bugc says are in
// memory there. Each value's bytes are the regions that the reference
// library (@ethdebug/pointers) returned for bugc's pointer, against that
// point's memory (decode.js decodeLocals); this file only lays those
// regions over words. The decoding to a value is the page's own.
import { decodeLocals, typeName } from "./decode.js";
import {
  octets, ruler, paint, initialHash, setHash, locked, details, keySection,
} from "./panel.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = (h) => Number(BigInt(h === undefined || h === "0x" ? 0 : h));
const hex = (n, w = 4) => "0x" + n.toString(16).padStart(w, "0");
const SIDES = ["before", "after"]; // A and B: the page's dump styles
const TAG = { before: "A", after: "B" };
const TINTS = 5;

window.memResults = { done: false, errors: [], decoded: {} };

let data; // fixtures/memory.json
const trees = {}; // point id -> decoded locals (decode.js nodes)
const pick = { before: "built", after: "replaced" }; // side -> point id
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
  const n = num(r.length ?? "0x20");
  return n ? `${hex(o)}–${hex(o + n - 1)}` : `${hex(o)} (no bytes)`;
};

const point = (side) => data.points.find((p) => p.id === pick[side]);
const pairs = (m) => (m.slice(2).match(/../g) ?? []);

// What a region is to the value it leads to, from its name in bugc's
// pointer: "names", "names-length", "names-element", "names-element-data"
function role(name) {
  if (name.endsWith("-length")) return "length";
  if (name.endsWith("-data")) return "bytes";
  if (name.endsWith("-frame")) return "frame pointer";
  return "address";
}

// Join A's and B's trees by path
function merge(a = [], b = []) {
  const byPath = new Map();
  for (const n of a) byPath.set(n.path, { a: n });
  for (const n of b) byPath.set(n.path, { ...byPath.get(n.path), b: n });
  return [...byPath.values()].map(({ a, b }) => {
    const n = b ?? a;
    const node = { label: n.label, path: n.path, type: n.type,
      before: a?.value, after: b?.value,
      children: n.children || a?.children
        ? merge(a?.children, b?.children) : undefined };
    node.changed = node.before?.text !== node.after?.text ||
      (node.children ?? []).some((c) => c.changed);
    return node;
  });
}

const walk = (nodes, f) => nodes.forEach((n) => {
  f(n);
  walk(n.children ?? [], f);
});
const find = (nodes, path) => {
  let out;
  walk(nodes, (n) => {
    if (n.path === path) out = n;
  });
  return out;
};

function build() {
  const tree = merge(trees[pick.before], trees[pick.after]);
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
  // Each region once a side, owned by the first value that reads it: an
  // array's word and length belong to the array, an element's word and
  // length to the element. A local that holds the same address as an
  // element owns its own regions, over the same bytes.
  for (const side of SIDES) {
    const seen = new Set();
    walk(tree, (n) => {
      const v = n[side];
      if (!v) return;
      for (const r of [...v.parts, v.region]) {
        const k = `${r.name} ${r.offset} ${r.length}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const main = r === v.region;
        own(main ? n.path : `${n.path}#${r.name}`, n.path,
          main && !v.length ? n.path : `${n.path} (${role(r.name)})`, side,
          r, main ? v.text : undefined);
      }
    });
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
  return { tree, owners, cover, bytes, order };
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
            TAG[side]}`)}"` : ""}` +
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
      ` aria-label="Memory at ${TAG[side]}, ${esc(p.title)}">` +
      `<div class="view-head"><span class="view-name">${TAG[side]} · ${
        esc(p.title)}</span>` +
      `<div class="wrow head"><span class="addr"></span>${ruler()}</div>` +
      `</div><div class="rows">${lines.join("")}</div></div>`;
  };
  return `<p class="muted small swipe">Each word is one line of 32 bytes;
    scroll sideways to see bytes 24 to 31.</p>` +
    `<div class="views">${view("before")}${view("after")}</div>`;
}

// ------------------------------------------------------- the values

function row(n, top) {
  const changed = n.before?.text !== n.after?.text;
  const val = (x) => x ? esc(x.text) : `<i title="bugc's variables ` +
    `context at this point does not list it">not listed</i>`;
  const kids = n.children?.length
    ? `<ul>${n.children.map((c) => row(c)).join("")}</ul>` : "";
  return `<li data-path="${esc(n.path)}" class="${n.changed ? "chg"
    : "same"}${top ? " top" : ""}">` +
    `<div class="row" tabindex="0" role="button" aria-pressed="false">` +
    `<span class="name">${esc(n.label)}</span>` +
    `<span class="type">${esc(typeName(n.type, {}))}</span>` +
    `<span class="val ${changed ? "chg" : "same"}"><span>${
      val(n[mode])}</span></span></div>${kids}</li>`;
}

const renderValues = (m) =>
  `<ul>${m.tree.map((n) => row(n, true)).join("")}</ul>`;

// ------------------------------------------------- how this was found

const code = (x) => `<code>${esc(x)}</code>`;
const expr = (e) => code(JSON.stringify(e));
// A value from the library's evaluator, { int?, hex }: small numbers in
// decimal, addresses in hex
const shown = (v) => {
  const n = BigInt(v.hex === "0x" ? 0 : v.hex);
  return n < 256n ? `<b>${n}</b>` : `<b>${hex(Number(n))}</b>`;
};
const args = (s) => s.args ? `<div class="args">where ${s.args.map((a) =>
  `${expr(a.expr)} = ${shown(a.value)}`).join(", ")}</div>` : "";

// What a region's bytes are, as read at that point
function readText(s) {
  const k = role(s.at.name);
  const n = BigInt(s.read === "0x" ? 0 : s.read);
  if (k === "bytes") return `the bytes, ${code(s.read)}`;
  if (k === "length") return `the length, <b>${n}</b>`;
  return `an address, <b>${hex(Number(n))}</b>`;
}

// The steps of one point's derivation, each with a key for its
// structure (what it does, not the values it finds), its evaluation in
// short, and the HTML of its list item
function items(n, v, side) {
  const linked = (r) => ` data-region="${esc(JSON.stringify(r))}"` +
    ` data-side="${side}" tabindex="0"`;
  const top = n.path.split("[")[0];
  const out = [{ key: "start", eval: "",
    html: `<li><span class="k">Start</span>
      ${code(top)} is a local in memory here
      <span class="tag">from bugc</span><br>Its pointer is in the
      variables context of the instruction at this point.</li>` }];
  for (const s of v.how.steps) {
    if (s.kind === "list") {
      out.push({ key: `list ${s.each} ${s.index}`,
        eval: `of ${shown(s.count.value)}`,
        html: `<li><span class="k">Item</span> ${code(s.each)} =
          <b>${esc(s.index)}</b>, of ${expr(s.count.expr)} =
          ${shown(s.count.value)} items</li>` });
    } else if (s.kind === "region") {
      const ev = s.fields.map((f) => `${f.field} ${shown(f.value)}`)
        .join("; ");
      out.push({ key: `region ${s.name} ${JSON.stringify(
        s.fields.map((f) => [f.field, f.expr]))}`,
      eval: `${ev}: ${readText(s)}`,
      html: `<li${linked(s.at)}><span class="k">Region</span>
        ${code(s.name)}: ${s.fields.map((x) => `${x.field} ${
          typeof x.expr === "object" ? `${expr(x.expr)} = ` : ""}${
          shown(x.value)}${args(x)}`).join("; ")}.
        <div>Holds ${readText(s)}</div></li>` });
    }
  }
  const r = v.region;
  out.push({ key: "result", eval: `${span(r)} = ${esc(v.text)}`,
    html: `<li class="final"${linked(r)}><span class="k">Result</span>
    memory ${span(r)}, ${num(r.length)} bytes.
    <div>Read at ${TAG[side]}: <b>${esc(v.text)}</b></div></li>` });
  // each item as two columns: its kind, and the rest
  return out.map((x) => ({ ...x, html: x.html.trim().replace(
    /^(<li[^>]*>)\s*(<span class="k">[^<]*<\/span>)([\s\S]*)<\/li>$/,
    '$1$2<div class="c">$3</div></li>') }));
}

function renderHow() {
  const box = $("mhow");
  const n = chosen && find(model.tree, chosen);
  if (!n) {
    box.innerHTML = `<p class="muted howrest">Click any value, or a byte
      in the words, to see how the page found it.</p>`;
    return;
  }
  const head = `<p class="howhead">${code(n.path)} <span class="type">${
    esc(typeName(n.type, {}))}</span></p>`;
  const side = mode;
  const other = side === "before" ? "after" : "before";
  const v = n[side];
  if (!v) {
    box.innerHTML = head + `<p class="small">At ${TAG[side]}, bugc's ` +
      "variables context does not list it.</p>";
    return;
  }
  // The other point's derivation beside this one: shared steps once, a
  // step that evaluates differently with both evaluations; where the
  // two part (a local kept in another word), the rest as two lists
  const A = items(n, v, side);
  const B = n[other] ? items(n, n[other], other) : null;
  let k = 0;
  while (B && k < A.length && k < B.length && A[k].key === B[k].key) k++;
  const forked = B && (k < A.length || k < B.length);
  const list = (xs, sd, cls) => `<div class="branch ${cls}">` +
    `<p class="branch-head"><span class="ev-tag">${TAG[sd]}</span></p>` +
    `<ol class="steps" start="${k + 1}" style="counter-reset: step ${k}">${
      xs.slice(k).map((x) => x.html).join("")}</ol></div>`;
  const dual = (x, i) => {
    const y = B?.[i];
    if (!y || x.eval === y.eval) return x.html;
    const [a, b] = side === "before" ? [x, y] : [y, x];
    return x.html.replace(/<\/div><\/li>\s*$/, `<div class="evals">` +
      `<div><span class="ev-tag">A</span> ${a.eval}</div>` +
      `<div><span class="ev-tag">B</span> ${b.eval}</div></div>` +
      "</div></li>");
  };
  const same = B && !forked && A.every((x, i) => x.eval === B[i].eval);
  const whose = `<p class="howside">For the memory at <b>${TAG[side]}</b>.` +
    `${same ? " The same steps find the same bytes at A and B." : ""}` +
    `${forked ? ` From step ${k + 1}, A and B differ: there bugc keeps ` +
      `${code(n.path.split("[")[0])} in another word.` : ""}</p>`;
  box.innerHTML = head + whose + `<ol class="steps">${A.slice(0, k)
    .map(dual).join("")}</ol>` + (forked ? list(A, side, "mine") +
    list(B, other, "theirs") : "") +
    `<p class="muted small">The library's dereference() returned these
    regions for bugc's pointer and read them. The steps above replay the
    pointer with the library's evaluator; they agree.</p>`;
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

// A value and everything under it, with the regions read to find it
function forValue(m, path) {
  const n = find(m.tree, path);
  const ids = [...m.owners.keys()].filter((id) => {
    const r = m.owners.get(id).row;
    return r === path || r.startsWith(path + "[");
  });
  const bytes = ownerBytes(m, ids);
  for (const side of SIDES) {
    for (const r of n[side]?.parts ?? []) {
      for (const [w, i] of regionBytes(r)) bytes.add(key(side, w, i));
    }
  }
  const at = (side) => {
    const v = n[side];
    return v ? `${span(v.region)} = ${esc(v.text)}` : "not listed";
  };
  return { bytes, rows: new Set([path]), path,
    label: `${path} · A: ${n.before ? n.before.text : "not listed"} · B: ${
      n.after ? n.after.text : "not listed"}`,
    info: [["Value", `${code(path)} (${esc(typeName(n.type, {}))})`],
      ["A", at("before")], ["B", at("after")]] };
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

// A region step of "How this was found"
function forRegion(r, side) {
  const bytes = new Set();
  for (const [w, i] of regionBytes(r)) bytes.add(key(side, w, i));
  return { bytes, rows: new Set(), step: true,
    label: `region ${r.name} · ${span(r)} (${TAG[side]})` };
}

// ------------------------------------------------------------ page

let model;
let hover = null;
let chosen = null; // the selected value's path
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
  $("mviewing").textContent = chosen ? `viewing ${chosen} · Esc to clear`
    : "";
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
  if (chosen && !find(model.tree, chosen)) chosen = null;
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
  renderHow();
  show();
}

function target(el) {
  if (!model || !el?.closest) return null;
  if (el.closest("#mpanel .tray")) return hover;
  const cell = el.closest("#mpanel .b[data-g]");
  if (cell) return forBytes(model, cell);
  const addr = el.closest("#mpanel .wrow[data-slot] .addr");
  if (addr) return forWord(model, addr.parentElement.dataset.slot);
  const step = el.closest("#mhow li[data-region]");
  if (step) {
    return forRegion(JSON.parse(step.dataset.region), step.dataset.side);
  }
  const li = el.closest("#mtree li[data-path]");
  if (li && el.closest(".row")) return forValue(model, li.dataset.path);
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
  renderHow();
  show();
}

function clear() {
  chosen = null;
  renderHow();
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
    if (e.target.closest("a, button, summary, #msrc, #mdetails, #mhow, " +
      ".addr, .tray") || String(window.getSelection?.() ?? "")) return;
    if (chosen) clear();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !chosen) return;
    if (keySection() === "memory") clear();
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

let wired = false;
async function main() {
  try {
    data = await window.loading.load("fixtures/memory.json",
      { label: "the memory example" });
  } catch (e) {
    $("mtree").innerHTML = `<p class="error">${esc(e.message)}` +
      ` <button type="button" class="btn">Retry</button></p>`;
    $("mtree").querySelector("button").onclick = window.loading.retry;
    return window.loading.fail(e, () => {
      $("mtree").innerHTML = `<div class="skel" aria-hidden="true">${
        "<i></i>".repeat(8)}</div>`;
      main().catch(failed);
    });
  }
  for (const p of data.points) {
    trees[p.id] = await decodeLocals(p.variables, p.memory);
    const flat = {};
    walk(trees[p.id], (n) => {
      flat[n.path] = { text: n.value.text, region: n.value.region,
        parts: n.value.parts };
    });
    window.memResults.decoded[p.id] = flat;
  }
  for (const side of SIDES) {
    $(`mpick-${side}`).innerHTML = data.points.map((p) =>
      `<button role="radio" data-id="${esc(p.id)}" aria-checked="false"` +
      ` title="${esc(p.note)}">${esc(p.title)}</button>`).join("");
  }
  const o = data.compiler.optimize;
  $("mmeta").innerHTML = `Program <code>${esc(data.program.file)}</code>,` +
    ` compiled by bugc from ethdebug/format main (commit <code>${
      data.compiler.commit.slice(0, 9)}</code>)${o ? `, at -O${o}`
      : ", without optimization"}; the trace has ${data.trace.steps} steps.`;
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
  if (!wired) wire();
  wired = true;
  render();
  if (sel && find(model.tree, sel)) {
    chosen = sel;
    renderHow();
  }
  restored = true;
  show();
  window.memResults.done = true;
}

function failed(e) {
  console.error(e);
  window.memResults.errors.push(String(e?.message ?? e));
  window.memResults.done = true;
  $("mtree").innerHTML = `<p class="error">Could not decode: ${esc(
    e?.message ?? e)}</p>`;
}

main().catch(failed);
