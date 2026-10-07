// Storage inspection demo: one contract, Arcade, in scenes. Each scene
// shows one point (the state after a transaction) or two to compare
// (before and after one). Loads the scene's fixture, decodes the
// contract's storage (decode.js), and draws it.
import {
  storageState, mappingKeys, decodeStorage, typeName, commit,
} from "./decode.js";
import {
  buildPanel, renderPanel, forRow, forBytes, forRegion, forSlot, paint,
  shortKeys, steady, initialHash, setHash, locked, keySection, forStep,
  short,
  details,
} from "./panel.js";
import { showCalldata } from "./calldata.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

window.results = { done: false, errors: [], decoded: {} };

// ------------------------------------------------------------- formats

// A long hex string, shortened; click to show it all
function hex(h, keep = 10) {
  if (h.length <= keep * 2 + 6) return `<span class="hex">${esc(h)}</span>`;
  const short = `${h.slice(0, keep)}…${h.slice(-keep + 2)}`;
  return `<span class="hex short" data-full="${esc(h)}"` +
    ` data-short="${esc(short)}" aria-label="${esc(h)}" tabindex="0">` +
    `${esc(short)}</span>`;
}

// A value from the library's evaluator: { int?, hex }. Small values in
// decimal; bytes also keep their hex.
const shown = (v) => {
  const n = num(v.hex);
  if (n >= 1n << 32n) return `<b>${hex(v.hex)}</b>`;
  if (v.int !== undefined) return `<b>${n}</b>`;
  return `<b>${n}</b> <span class="muted">(${hex(v.hex)})</span>`;
};

// Data.toHex() gives "0x" for zero
const num = (h) => BigInt(h === "0x" ? 0 : h);

const expr = (e) => `<code>${esc(JSON.stringify(e))}</code>`;

// --------------------------------------------------------------- merge

// Join the before and after trees by path
function merge(before = [], after = []) {
  const byPath = new Map();
  for (const n of before) byPath.set(n.path, { b: n });
  for (const n of after) {
    byPath.set(n.path, { ...byPath.get(n.path), a: n });
  }
  return [...byPath.values()].map(({ b, a }) => {
    const n = a ?? b;
    const node = {
      label: n.label, path: n.path, typeId: n.typeId, note: n.note,
      key: n.key, before: b?.value, after: a?.value,
      children: n.children || b?.children
        ? merge(b?.children, a?.children) : undefined,
    };
    node.changed = node.before?.text !== node.after?.text ||
      (node.children ?? []).some((c) => c.changed);
    return node;
  });
}

// -------------------------------------------------------------- render

let current; // the scene shown: { id, scene, f, tree, panel, single }

// Which state to show: "before" or "after" (one dump at a time)
let mode = "after";
// Whether to show the other state beside this one: the cards in the
// dump and the insets in the tree (a scene with one point has none)
let insets = true;
const showOther = () => insets && !current?.single;
const WHEN = () => current.panel.when;

function row(node, top) {
  const { types } = current.f.contract;
  const type = types[node.typeId];
  const tname = type ? typeName(type, types) : "";
  const valueChanged = node.before?.text !== node.after?.text;
  const v = node.after ?? node.before;
  let val = "";
  if (v) {
    const b = node.before ? esc(node.before.text) : "<i>none</i>";
    const a = node.after ? esc(node.after.text) : "<i>none</i>";
    // the shown state's value; the row says whether it changed (not at
    // one point)
    val = `<span>${mode === "before" ? b : a}</span>`;
    val = `<span class="val${current.single ? "" : valueChanged ? " chg"
      : " same"}">${val}</span>`;
  } else if (node.note) {
    val = `<span class="muted">${esc(node.note)}</span>`;
  }
  const kids = node.children?.length
    ? `<ul>${node.children.map((c) => row(c)).join("")}</ul>`
    : node.children && !node.before && !node.after
      ? `<p class="muted empty">no keys hashed in this transaction</p>`
      : "";
  const cls = current.single ? "" : node.changed ? "chg" : "same";
  return `<li class="${cls}${top ? " top" : ""}"`.replace('class=" ',
    'class="') +
    ` data-path="${esc(node.path)}">` +
    `<div class="row" tabindex="0" role="button" aria-pressed="false">` +
    `<span class="name">${esc(node.label)}</span>` +
    `<span class="type">${esc(tname)}</span>${val}</div>${kids}</li>`;
}

function renderTree() {
  $("tree").innerHTML =
    `<ul>${current.tree.map((n) => row(n, true)).join("")}</ul>`;
}

function render() {
  const { f, scene } = current;
  $("summary").textContent = scene.summary;
  showScene(scene);
  showCalldata(scene.calldata ? f.tx.input : null, scene.calldata);
  renderTree();
  $("src").textContent = f.contract.source;
  $("srcnote").textContent = "Click a value to mark where it is declared.";
  $("panel").innerHTML = renderPanel(current.panel);
  hover = null;
  chosen = null;
  applyMode();
}

const find = (nodes, path) => {
  for (const n of nodes) {
    if (n.path === path) return n;
    const c = n.children && find(n.children, path);
    if (c) return c;
  }
};
const parentOf = (path) => path.replace(/(\.[^.[\]]+|\[[^\]]*\])$/, "");

// ------------------------------------------------------------ the mode

// Before or After: that state's dump only, and derivations for it
function applyMode() {
  for (const b of $("mode").querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(b.dataset.mode === mode));
  }
  for (const v of $("panel").querySelectorAll(".view")) {
    v.hidden = v.dataset.side !== mode;
  }
  $("panel").dataset.mode = mode;
  replay = null;
  renderTree();
  renderBox();
  show();
}

// ------------------------------------------------- how this was found

// A value's steps, with the steps for its parts (a string's length
// regions) put in where the template reaches them. Each region step
// carries the region the library returned for it.
function stepsOf(v) {
  const main = v.how.steps;
  const key = (s) => JSON.stringify(s);
  const at = new Map(); // data step index -> part steps to put before it
  for (const p of v.parts ?? []) {
    const ps = p.how.steps;
    let k = 0;
    while (k < ps.length - 1 && k < main.length &&
      key(ps[k]) === key(main[k])) k++;
    const extra = ps.slice(k).map((s, i, a) =>
      ({ s, region: i === a.length - 1 ? p.region : null }));
    at.set(k, [...(at.get(k) ?? []), ...extra]);
  }
  const out = [];
  main.forEach((s, i) => {
    out.push(...(at.get(i) ?? []));
    out.push({ s, region: i === main.length - 1 ? v.region : null });
  });
  return out;
}

const isDyn = (node) => {
  const t = current.f.contract.types[node.typeId];
  return t?.kind === "string" || (t?.kind === "bytes" && t.size === undefined);
};

// The branch an If step took, in plain words. solc's string and bytes
// template tests the low bit of the slot's last byte: set means long.
function branchWords(node, s) {
  if (isDyn(node) && JSON.stringify(s.cond.expr).includes("length-flag")) {
    const what = current.f.contract.types[node.typeId].kind;
    return `${s.branch === "then" ? "short" : "long"}-${what} layout`;
  }
  return `the "${s.branch}" branch`;
}


// Why there is no value on one side, e.g. "xs has 0 items"
function missing(node, side) {
  const parent = find(current.tree, parentOf(node.path));
  const len = parent?.[side]?.text?.match(/^length (\d+)$/)?.[1];
  return `no such value${len !== undefined
    ? ` (${parent.label} has ${len} item${len === "1" ? "" : "s"})` : ""}`;
}


// ---------------------------------------------- the box under the dump

// With a value selected, the box under the dump shows it, resolved: its
// path, type, value and place (in two states, both), and a button to
// replay how it was found. The replay steps through the pointer's
// evaluation as the library did it (decode.js replay()): the start, the
// template, each define, list item, branch and region, then the result.
// At each step the dump lights only what that step knows (a computed
// slot's row, a region's bytes) and mutes the rest.
let replay = null; // { path, side, steps, i }

const shortVal = (h) => {
  const n = num(h);
  return n < 1n << 32n ? String(n) : short(word(n));
};
const word = (n) => "0x" + n.toString(16).padStart(64, "0");

// An expression, in short, with its inputs' values
function exprText(s) {
  const op = s.expr && typeof s.expr === "object" ? Object.keys(s.expr)[0]
    : null;
  const a = (s.args ?? []).map((x) => shortVal(x.value.hex));
  switch (op) {
    case "$keccak256": return `keccak(${a.join(", ")})`;
    case "$sum": return a.join(" + ");
    case "$difference": return a.join(" − ");
    case "$product": return a.join(" × ");
    case "$quotient": return a.join(" ÷ ");
    case "$remainder": return a.join(" mod ");
    case "$read": return `read ${s.expr.$read}`;
    default: return a.join(", ");
  }
}

// The steps of a value's replay: { cap, regions, slots }
function valueSteps(node, v, side) {
  const { types } = current.f.contract;
  const out = [];
  const known = (h) => {
    const w = word(num(h));
    return current.f.slots[w] ? [w] : [];
  };
  if (v.how.context) {
    const { variable, slot, offset, length } = v.how.context;
    out.push({ cap: `${variable} is at slot ${shortVal(slot)}, ${length} ` +
      `bytes at offset ${offset}, from the program context (no template ` +
      "for a value type)", slots: [], regions: [v.region] });
  } else {
    const { origin } = v.how;
    out.push({ cap: `${origin.variable} lives at slot ${shortVal(
      origin.slot)} (program context)${origin.key ? `; key ${short(
      origin.key)} (from the trace)` : ""}`, slots: known(origin.slot) });
    const all = stepsOf(v);
    let i = 0;
    while (all[i]?.s.kind === "define") i++; // the page's own inputs
    for (const { s, region } of all.slice(i)) {
      if (s.kind === "template") {
        const t = types[s.name];
        out.push({ cap: `solc's rule for ${t ? typeName(t, types)
          : s.name}`, rule: s.name });
      } else if (s.kind === "define") {
        const e = exprText(s);
        out.push({ cap: `${s.id} = ${e ? `${e} = ` : ""}${shortVal(
          s.value.hex)}`, slots: known(s.value.hex) });
      } else if (s.kind === "list") {
        out.push({ cap: `item ${s.each} = ${s.index} of ${shortVal(
          s.count.value.hex)}` });
      } else if (s.kind === "if") {
        out.push({ cap: `${s.cond.args ? `${exprText(s.cond)} = ` : ""}${
          shortVal(s.cond.value.hex)}, so ${branchWords(node, s)}` });
      } else if (s.kind === "region") {
        const f = Object.fromEntries(s.fields.map((x) =>
          [x.field, shortVal(x.value.hex)]));
        out.push({ cap: `${s.name}: slot ${f.slot ?? "?"}${f.offset
          !== undefined ? `, offset ${f.offset}` : ""}${f.length
          !== undefined ? `, length ${f.length}` : ""}`,
        regions: region ? [region] : [] });
      }
    }
  }
  const r = v.region;
  const o = Number(num(r.offset ?? "0x0"));
  const n = r.length !== undefined ? Number(num(r.length)) : 32 - o;
  out.push({ cap: `${o === 0 && n === 32 ? "all 32 bytes" : `bytes ${o}–${
    o + n - 1}`} → ${v.hex === "0x" ? "no bytes" : v.hex.length > 22
    ? `${v.hex.slice(0, 12)}…` : v.hex} = ${v.text}`, final: true });
  return out;
}

// The steps for any selection. A value: its own. A composite with no
// value of its own (a mapping, a struct): its first value's steps, up to
// where that value's own regions start, then the whole composite. An
// array: its length's steps, then the whole array.
function replaySteps(path, side) {
  const node = find(current.tree, path);
  const own = node[side];
  let steps;
  if (own) {
    steps = valueSteps(node, own, side);
  } else {
    let leaf = null;
    const visit = (n) => {
      if (leaf) return;
      if (n[side]) leaf = n;
      else (n.children ?? []).forEach(visit);
    };
    visit(node);
    if (!leaf) return [];
    steps = valueSteps(leaf, leaf[side], side);
    const k = steps.findIndex((x) => x.regions?.length || x.final);
    steps = steps.slice(0, k < 0 ? steps.length : k);
  }
  if (!own || node.children?.length) {
    steps.push({ cap: `${shortKeys(path)}: ${node.children?.length ?? 0} ` +
      `${node.children?.length === 1 ? "part" : "parts"}, lit in their ` +
      "colours", final: true });
  }
  return steps;
}

// The highlight of a step: its slots' rows and its regions' bytes (the
// final step: the selection, resolved)
function stepLight(st) {
  if (st.final) return forRow(current.panel, replay.path);
  return forStep(current.panel, replay.side, st);
}

const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";

function renderBox() {
  const box = $("details");
  const node = chosen && find(current.tree, chosen);
  if (!node) return;
  if (replay) {
    const { steps, i } = replay;
    const st = steps[i];
    const rule = st.rule && current.f.contract.pointers[st.rule];
    box.innerHTML = `<p class="rstep"><span class="rnum">${CIRCLED[i] ??
      i + 1}</span> ${esc(st.cap)}</p>` +
      (rule ? `<details class="rrule"><summary>The rule as solc wrote it` +
        `</summary><pre>${esc(JSON.stringify(rule, null, 1))}</pre>` +
        "</details>" : "") +
      `<div class="rbar"><span class="rdots" aria-hidden="true">${
        steps.map((_, k) => `<i class="${k === i ? "on" : k < i ? "past"
          : ""}"></i>`).join("")}</span>` +
      `<span class="rctl"><button type="button" class="btn" data-r="prev"` +
      ` aria-label="Previous step"${i ? "" : " disabled"}>◀</button>` +
      `<button type="button" class="btn" data-r="next" aria-label=` +
      `"Next step">▶</button>` +
      `<button type="button" class="btn" data-r="end" aria-label=` +
      `"Jump to the resolved value">⏭</button></span>` +
      `<span class="muted small">step ${i + 1} of ${steps.length}; ← →, ` +
      "Esc</span></div>";
    return;
  }
  const h = forRow(current.panel, chosen);
  const done = replay === false; // just finished a replay
  box.innerHTML = details(h, PROBE) +
    (node[mode] ? "" : `<p class="small">${esc(missing(node, mode))}</p>`) +
    `<p class="rbar"><button type="button" class="btn" data-r="start">${
      done ? "Replay ▸" : "How was this found? ▸"}</button></p>` +
    vyperRule(node, mode);
}

// Start, step or leave the replay
function stepTo(i) {
  if (!replay) return;
  // the last step is the resolved view: the box as at rest, "Replay ▸"
  if (i >= replay.steps.length - 1) return endReplay();
  replay.i = Math.max(0, i);
  renderBox();
  show();
}
function startReplay() {
  if (!chosen) return;
  const steps = replaySteps(chosen, mode);
  if (!steps.length) return;
  replay = { path: chosen, side: mode, steps, i: 0 };
  renderBox();
  show();
  $("details").focus({ preventScroll: true });
}
function endReplay() {
  replay = false;
  renderBox();
  show();
}
// The Vyper scene: the same entry by Vyper's own rule, which no ethdebug
// gives (Vyper emits none). Its words are the ones Vyper uses for the
// selected player (the fixture script read them from the node and
// checked them against the getter); each step lights its word.
function vyperRule(node, side) {
  const vy = current.f.vyper;
  if (!vy || !node.path.startsWith("players[")) return "";
  const entry = find(current.tree, node.path.match(/^players\[[^\]]*\]/)[0]);
  const e = vy.entries.find((x) => entry.key.toLowerCase()
    .endsWith(x.key.slice(2).toLowerCase()));
  if (!e) return "";
  const item = (m, k) => `<li data-region="${esc(JSON.stringify({
    name: `vyper-${m.name}`, location: "storage", slot: m.slot,
    offset: "0x0", length: "0x20" }))}" data-side="${side}" tabindex="0">` +
    `<span class="k">Slot ${k ? `+ ${k}` : ""}</span><div class="c">${k ? ""
      : `${hex(e.slot, 14)}: `}<code>${esc(m.name)}</code> = <b>${
      esc(m.text)}</b></div></li>`;
  return `<p class="howside">Vyper's rule, for contrast: not from
    ethdebug (Vyper emits none). Vyper's <code>players</code> is slot
    ${esc(vy.base)}; it hashes the slot first,
    <code>keccak256(slot ${esc(vy.base)} . key)</code>, and puts each member
    in its own slot, the name's length and bytes after them.</p>
    <ol class="steps vyper">${e.members.map(item).join("")}</ol>`;
}

// The declaration to mark in the source
function declaration(node) {
  const { f } = current;
  const top = node.path.split(/[.[]/)[0];
  const parentPath = parentOf(node.path);
  const parent = parentPath !== node.path && find(current.tree, parentPath);
  const ptype = parent && f.contract.types[parent.typeId];
  if (ptype?.kind === "struct" && ptype.definition?.location) {
    return {
      range: ptype.definition.location.range,
      note: `Marked: struct ${ptype.definition.name}, from the ethdebug ` +
        "type's definition.location.",
    };
  }
  const d = f.contract.declarations[top];
  return d && {
    range: d,
    note: `Marked: the declaration of ${top}, from solc's AST.`,
  };
}

function markSource(node) {
  const { f } = current;
  const d = node && declaration(node);
  const src = $("src");
  if (!d) {
    src.textContent = f.contract.source;
    $("srcnote").textContent = "Click a value to mark where it is declared.";
    return;
  }
  // ranges count bytes
  const bytes = new TextEncoder().encode(f.contract.source);
  const dec = (a, b) => new TextDecoder().decode(bytes.slice(a, b));
  const { offset, length } = d.range;
  src.innerHTML = esc(dec(0, offset)) +
    `<mark>${esc(dec(offset, offset + length))}</mark>` +
    esc(dec(offset + length));
  $("srcnote").textContent = d.note;
  const m = src.querySelector("mark");
  src.scrollTop = Math.max(0, m.offsetTop - src.offsetTop - 40);
}


// ------------------------------------------------------------- linking

// The tree and the storage panel light up the same bytes. Hover (or
// focus) is a preview; a click selects a variable (a tree row), and the
// panel under the tree shows how it was found. While one is selected,
// the view stays on it (panel.js locked()).
let hover = null;
let chosen = null; // the selected variable's path

const PROBE = "Point at a value or a byte for its details.";

function show() {
  const sel = chosen ? forRow(current.panel, chosen) : null;
  // a replay shows its step, whatever the pointer is on
  const h = replay ? stepLight(replay.steps[replay.i]) : hover ?? sel;
  paint($("panel"), $("tree"), h, { cards: !replay && showOther(),
    single: !!current?.single });
  treeCard(h);
  for (const r of $("tree").querySelectorAll("li[data-path] > .row")) {
    const on = r.parentElement.dataset.path === chosen;
    r.classList.toggle("sel", on);
    r.setAttribute("aria-pressed", String(on));
  }
  // with a value selected, the box is its own (renderBox)
  if (!chosen) $("details").innerHTML = details(h, PROBE);
  // the locked state: what the view is on, and the way out
  $("viewing").hidden = !chosen;
  $("viewing").textContent = chosen
    ? `viewing ${shortKeys(chosen)} · Esc to clear` : "";
}

// While a value is lit, a card by its tree row gives its value in the
// other state, like the cards in the dump: under the row (under its
// members, for a parent) in Before, over it in After. Only when the
// value differs; for a parent, its changed members, in one card.
function treeCard(h) {
  $("tree").querySelectorAll(".tcard").forEach((c) => c.remove());
  const path = h?.path ?? (h?.rows?.size ? [...h.rows][0] : null);
  const node = showOther() && path && find(current.tree, path);
  if (!node) return;
  const other = mode === "before" ? "after" : "before";
  const txt = (n) => n[other] ? esc(n[other].text) : "<i>none</i>";
  const changed = [];
  const visit = (n) => {
    if ((n.before || n.after) && n.before?.text !== n.after?.text) {
      changed.push(n);
    }
    (n.children ?? []).forEach(visit);
  };
  visit(node);
  if (!changed.length) return;
  const own = changed[0] === node;
  const shown = changed.slice(0, 4);
  const li = $("tree").querySelector(`li[data-path="${CSS.escape(path)}"]`);
  const card = document.createElement("div");
  card.className = `tcard ${mode}`;
  card.setAttribute("aria-hidden", "true");
  card.innerHTML = `<span class="cmp-tag">${other}</span>` + (own
    ? `<span class="tval">${txt(node)}</span>`
    : shown.map((n) => `<span class="tval"><b>${esc(n.path.slice(
      path.length).replace(/^\./, ""))}</b> ${txt(n)}</span>`).join("") +
      (changed.length > 4 ? `<span class="tval muted">+${
        changed.length - 4} more</span>` : ""));
  // Before: under the row and its members; After: over the row
  (mode === "before" ? li : li.querySelector(":scope > .row"))
    .append(card);
}

// Select a variable by its tree path, or clear the selection (null).
// `anchor`: the byte clicked, kept in place on screen when the panel
// above the words (on a narrow page) grows or shrinks. `quiet`: do not
// scroll to it (when restoring from the URL).
function choose(path, anchor, quiet) {
  chosen = path;
  const node = path && find(current.tree, path);
  replay = null;
  steady(anchor, () => {
    markSource(node);
    renderBox();
    show();
  });
  keep();
  if (!path || quiet) return;
  $("tree").querySelector(`li[data-path="${CSS.escape(path)}"] > .row`)
    ?.scrollIntoView({ block: "nearest" });
}

// The tree row that owns a byte, if any
function ownerRow(cell) {
  const id = (cell.dataset.owners ?? "").split("|").filter(Boolean)[0];
  return id ? current.panel.owners.get(id).row : null;
}

// The link for whatever is under the pointer or has focus
function target(el) {
  if (!current || !el?.closest) return null;
  // the tray under the dumps belongs to what is lit now
  if (el.closest("#panel .tray")) return hover;
  const m = current.panel;
  const cell = el.closest("#panel .b[data-g]");
  if (cell) return forBytes(m, cell);
  const addr = el.closest("#panel .wrow[data-slot] .addr");
  if (addr) return forSlot(m, addr.parentElement.dataset.slot);
  const step = el.closest("#details li[data-region]");
  if (step) {
    const r = JSON.parse(step.dataset.region);
    return forRegion(m, r, step.dataset.side, r.name);
  }
  const li = el.closest("#tree li[data-path]");
  if (li && el.closest(".row")) return forRow(m, li.dataset.path);
  return null;
}

const same = (a, b) => a?.label === b?.label &&
  JSON.stringify(a?.at) === JSON.stringify(b?.at);

function onOver(e) {
  if (e.target.closest?.("#memory, #calldata")) {
    if (hover) {
      hover = null;
      show();
    }
    return;
  }
  const h = locked(target(e.target),
    chosen && forRow(current.panel, chosen));
  if (!same(h, hover)) {
    hover = h;
    show();
  }
}
document.addEventListener("pointerover", onOver);
document.addEventListener("focusin", onOver);
document.addEventListener("focusout", (e) => {
  if (!e.relatedTarget) {
    hover = null;
    show();
  }
});

// What a click (or Enter) on an element does in the storage demo
function act(el) {
  // a row selects its variable, or, when it is the selected one, clears
  const row = el.closest("#tree li[data-path] > .row");
  if (row) {
    const p = row.parentElement.dataset.path;
    hover = null;
    return choose(p === chosen ? null : p), true;
  }
  const cell = el.closest("#panel .b[data-g]");
  if (cell) {
    hover = null;
    return choose(ownerRow(cell), cell), true;
  }
  return false;
}

document.addEventListener("click", (e) => {
  const t = e.target;
  const h = t.closest(".hex.short");
  if (h) return flip(h);
  if (!current || t.closest("#memory, #calldata")) return;
  const ins = t.closest("#insets");
  if (ins) {
    insets = ins.checked;
    applyMode();
    return keep();
  }
  const m = t.closest("#mode button");
  if (m) {
    mode = m.dataset.mode;
    applyMode();
    return keep();
  }
  const r = t.closest("#details button[data-r]");
  if (r) {
    const k = r.dataset.r;
    if (k === "start") startReplay();
    else if (k === "end") endReplay();
    else stepTo(replay.i + (k === "next" ? 1 : -1));
    return;
  }
  if (act(t)) return;
  // Empty space clears the selection; controls, text and the panels
  // that explain do not
  if (t.closest("#picker, #details, #src, .addr, .tray, a, " +
    "button, " +
    "summary, details, input, label")) return;
  if (String(window.getSelection?.() ?? "")) return;
  if (chosen) choose(null);
});
const flip = (h) => {
  const full = h.classList.toggle("full");
  h.textContent = full ? h.dataset.full : h.dataset.short;
};
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (replay && keySection() === "storage") return endReplay();
    if (chosen && keySection() === "storage") choose(null);
    return;
  }
  // ← → step a replay while its box has the focus
  if (replay && e.target.closest?.("#details") &&
    ["ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    return stepTo(replay.i + (e.key === "ArrowRight" ? 1 : -1));
  }
  if (e.key !== "Enter" && e.key !== " ") return;
  const h = e.target.closest?.(".hex.short");
  if (h) {
    e.preventDefault();
    return flip(h);
  }
  if (e.target.closest?.("#tree .row, #panel .b[tabindex]")) {
    e.preventDefault();
    act(e.target);
  }
});

// ---------------------------------------------------------------- load

async function decode(f) {
  // mapping keys: from the fixture (gathered from another trace), or
  // from this transaction's KECCAK256 inputs
  const keys = f.keys ? new Map(f.keys) : mappingKeys(f.trace.kept);
  const side = (when) => storageState(async (slot) => {
    const e = f.slots[slot];
    if (!e) throw new Error(`slot ${slot} is not in the fixture`);
    return e[when];
  });
  const [before, after] = await Promise.all([
    decodeStorage(f.contract, side("before"), keys),
    decodeStorage(f.contract, side("after"), keys),
  ]);
  return merge(before, after);
}

// A scene with one point shows one state: the fixture's state on that
// side, as both sides (nothing changed, nothing to compare)
function atPoint(f, side) {
  const slots = {};
  for (const [s, w] of Object.entries(f.slots)) {
    slots[s] = { before: w[side], after: w[side] };
  }
  return { ...f, slots };
}

// The Vyper scene names the words Vyper's own rule found
function vyperNames(f) {
  const vy = f.vyper;
  if (!vy) return undefined;
  return Object.fromEntries(vy.entries.flatMap(({ key, members }) =>
    members.map(({ slot }, k) => [slot, `Vyper's keccak(slot ${vy.base}, 0x${
      key.slice(2, 6)}…${key.slice(-4)})${k ? ` + ${k}` : ""}`])));
}

// The view in the URL hash: scene, mode, selected variable
let restored = false; // until the hash is read back, do not write it
function keep() {
  if (!restored || !current) return;
  const { scene, single } = current;
  // a cleared default selection is kept as "sel="
  setHash({ ex: current.id, mode: single ? null : mode,
    sel: chosen ?? (scene.select ? "" : null),
    insets: insets || single ? null : "0" });
}

const loaded = {};
let index = []; // the scenes, from fixtures/index.json
let wanted; // the scene asked for last
// gray lines in the tree while a scene's data loads
const SKELETON = `<div class="skel" aria-hidden="true">${
  "<i></i>".repeat(8)}</div>`;
let firstShown;
const ready = new Promise((r) => {
  firstShown = r;
});

// Each value's text before and after, by path (for bin/run.mjs)
function record(id, tree) {
  const flat = {};
  const visit = (n) => {
    flat[n.path] = { before: n.before?.text, after: n.after?.text };
    (n.children ?? []).forEach(visit);
  };
  tree.forEach(visit);
  window.results.decoded[id] = flat;
}

// The scene's intro, and the controls a scene with one point does not
// have (Before | After, "show other state", the change legends)
function showScene(scene) {
  for (const p of $("intros").querySelectorAll("[data-scene]")) {
    p.hidden = p.dataset.scene !== scene.id;
  }
  document.querySelector("main").toggleAttribute("data-single",
    scene.points.length === 1);
}

// Show a scene, with its defaults (its mode and its selection), or, with
// `view`, the mode and selection given. Its data is fetched the first
// time (with progress in the bar at the top); until then the picker
// shows the choice and the tree waits. Returns false when the data did
// not load.
window.select = async (id, view) => {
  wanted = id;
  for (const b of $("picker").querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(b.dataset.id === id));
  }
  const scene = index.find((x) => x.id === id);
  showScene(scene);
  if (!loaded[id]) {
    $("tree").innerHTML = SKELETON;
    $("summary").textContent = scene.summary;
    let f;
    try {
      f = await window.loading.load(`fixtures/${scene.fixture}.json`,
        { label: `“${scene.title}”` });
    } catch (e) {
      if (wanted === id) {
        window.loading.fail(e, () => window.select(id, view));
        $("tree").innerHTML = `<p class="error">${esc(e.message)}` +
          ` <button type="button" class="btn">Retry</button></p>`;
        $("tree").querySelector("button").onclick = window.loading.retry;
      }
      return false;
    }
    const single = scene.points.length === 1;
    if (single) f = atPoint(f, scene.points[0]);
    const tree = await decode(f);
    const when = single
      ? { before: scene.when, after: scene.when }
      : { before: "before the transaction", after: "after the transaction",
        ...scene.when };
    loaded[id] = { id, scene, f, tree, single,
      panel: buildPanel(f, tree, { single, when, names: vyperNames(f) }) };
    record(id, tree);
  }
  if (wanted !== id) return true; // another scene was asked for since
  current = loaded[id];
  mode = current.single ? "after" : view?.mode ?? scene.mode ?? "after";
  render();
  const sel = view ? view.sel : scene.select;
  choose(sel && find(current.tree, sel) ? sel : null, null, true);
  firstShown();
  return true;
};

// After the page is usable, fetch the other scenes' data one at a time
// while the browser is idle and nothing else is loading
function prefetch(files) {
  const idle = window.requestIdleCallback ??
    ((f) => setTimeout(f, 200));
  const next = () => idle(() => {
    if (!files.length) return;
    if (window.loading.busy()) return setTimeout(next, 500);
    window.loading.load(`fixtures/${files.shift()}.json`, { quiet: true })
      .catch(() => {}).then(next);
  });
  next();
}

async function main() {
  index = await window.loading.load("fixtures/index.json");
  $("picker").innerHTML = index.map((x) =>
    `<button role="radio" data-id="${esc(x.id)}"` +
    ` data-fixture="${esc(x.fixture)}"${x.points.length === 1
      ? " data-single" : ""}>${esc(x.title)}</button>`).join("");
  $("picker").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) window.select(b.dataset.id).catch(fail);
  });
  // Back to what the URL hash says, if it still makes sense: the scene,
  // and its mode and selection (a stale hash gives the first scene, with
  // its defaults)
  const h = initialHash;
  const ex = index.find((x) => x.id === h.get("ex"));
  const view = ex && {
    mode: ["before", "after"].includes(h.get("mode")) ? h.get("mode")
      : undefined,
    sel: h.has("sel") ? h.get("sel") || null : ex.select,
  };
  insets = h.get("insets") !== "0";
  $("insets").checked = insets;
  // the first scene (after a failure, once Retry or a pick shows one)
  window.select((ex ?? index[0]).id, view);
  await ready;
  $("meta").innerHTML =
    `@ethdebug/pointers from main (commit <code>${commit.slice(0, 9)}` +
    "</code>), pending release." + ` Compiled with solc ${esc(
    current.f.contract.compiler.split("+")[0])} (Walnut's fork, ` +
    "walnuthq/solidity PR #10), optimizer off.";
  restored = true;
  keep();
  window.results.usable = performance.now();
  window.results.done = true;
  prefetch([...new Set(index.map((x) => x.fixture))]
    .filter((x) => !index.some((s) => s.fixture === x && loaded[s.id])));
}

function fail(e) {
  console.error(e);
  window.results.errors.push(String(e?.message ?? e));
  $("tree").innerHTML = `<p class="error">Could not decode: ${esc(
    e?.message ?? e)}</p>`;
  window.results.done = true;
}

main().catch(fail);
