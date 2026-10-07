// Storage inspection demo: one contract, Arcade, in scenes. Each scene
// shows one point (the state after a transaction) or two to compare
// (before and after one). Loads the scene's fixture, decodes the
// contract's storage (decode.js), and draws it.
import {
  storageState, mappingKeys, decodeStorage, typeName, commit, baseSlot,
} from "./decode.js";
import {
  buildPanel, renderPanel, forRow, baseOf, forBytes, forRegion, forSlot,
  paint,
  shortKeys, steady, initialHash, setHash, locked, keySection, forStep,
  PICKS,
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
  // a group (an array, a mapping, a struct, an entry): its summary at
  // the right end of its row (an array's length is its value), then its
  // chevron, a button of its own (a click on the row selects)
  const group = !!node.children?.length;
  const n = node.children?.length ?? 0;
  if (group && !v) {
    const words = type?.kind === "mapping" ? ["entry", "entries"]
      : type?.kind === "struct" ? ["field", "fields"] : ["item", "items"];
    val = `<span class="val sum">${n} ${words[n === 1 ? 0 : 1]}</span>`;
  }
  const shut = group && !!collapsed[current.id]?.has(node.path);
  // (tabindex: Safari leaves buttons out of the Tab order otherwise)
  const chev = group ? `<button type="button" class="chev" tabindex="0"` +
    ` aria-expanded="${!shut}" aria-label="${shut ? "Expand" : "Collapse"} ${
      esc(node.label)}">${CHEV}</button>` : "";
  const kids = node.children?.length
    ? `<ul>${node.children.map((c) => row(c)).join("")}</ul>`
    : node.children && !node.before && !node.after
      ? `<p class="muted empty">no keys hashed in this transaction</p>`
      : "";
  const cls = current.single ? "" : node.changed ? "chg" : "same";
  return `<li class="${cls}${top ? " top" : ""}${shut ? " collapsed" : ""}"`
    .replace('class=" ', 'class="') +
    ` data-path="${esc(node.path)}">` +
    `<div class="row" tabindex="0" role="button" aria-pressed="false">` +
    `<span class="name">${esc(node.label)}</span>` +
    `<span class="type">${esc(tname)}</span>${val}</div>${chev}${kids}</li>`;
}

// a chevron, pointing down (open); turned to point right when closed
const CHEV = '<svg viewBox="0 0 16 16" aria-hidden="true"><path ' +
  'd="M3.5 6 8 10.5 12.5 6" fill="none" stroke="currentColor" ' +
  'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
// The groups the reader has collapsed, by scene (all open by default;
// kept while on the page)
const collapsed = {};
// Open or close a group: a deliberate action, so the tree may change
// (a quick height animation; at once with reduced motion). The dump
// does not move.
function setOpen(li, open, animate = true) {
  const set = (collapsed[current.id] ??= new Set());
  if (open) set.delete(li.dataset.path);
  else set.add(li.dataset.path);
  const btn = li.querySelector(":scope > .chev");
  btn.setAttribute("aria-expanded", String(open));
  btn.setAttribute("aria-label", `${open ? "Collapse" : "Expand"} ${
    li.querySelector(":scope > .row .name").textContent}`);
  const ul = li.querySelector(":scope > ul");
  const done = () => {
    li.classList.toggle("collapsed", !open);
    show();
  };
  if (!ul || !animate || still()) return done();
  li.classList.remove("collapsed");
  const h = ul.scrollHeight;
  ul.style.overflow = "hidden";
  ul.animate([{ height: `${open ? 0 : h}px` },
    { height: `${open ? h : 0}px` }],
    { duration: 180, easing: open ? "ease-out" : "ease-in" }).finished
    .then(() => {
      ul.style.overflow = "";
      done();
    });
  if (open) show();
}
// Open the groups a path is inside (a selection or a replay step there)
function expandTo(path) {
  let li = path && $("tree").querySelector(
    `li[data-path="${CSS.escape(path)}"]`);
  for (li = li?.parentElement.closest("li"); li;
    li = li.parentElement.closest("li")) {
    if (li.classList.contains("collapsed")) setOpen(li, true, false);
  }
}
// A colour is a legend only where its rows show: a value whose row is
// hidden in a collapsed group takes the colour of the row that shows
// it, or the selection's yellow (0)
function legend(h) {
  if (!h?.colors || !$("tree").querySelector("li.collapsed")) return h;
  const shownAs = (p) => {
    const li = $("tree").querySelector(`li[data-path="${CSS.escape(p)}"]`);
    let v = li;
    for (let a = li?.parentElement.closest("li"); a;
      a = a.parentElement.closest("li")) {
      if (a.classList.contains("collapsed")) v = a;
    }
    return v?.dataset.path ?? p;
  };
  const colors = new Map();
  for (const [p, k] of h.colors) {
    const v = shownAs(p);
    colors.set(p, v === p || h.colors.get(v) === k ? k : 0);
  }
  return { ...h, colors };
}

function renderTree() {
  $("tree").innerHTML =
    `<ul>${current.tree.map((n) => row(n, true)).join("")}</ul>`;
  alignColumns();
}

// The two columns start at one height: the tree's first row at the
// height of the dump's first line (the dump has its byte ruler above)
function alignColumns() {
  const d = $("panel").querySelector(".view:not([hidden]) .rows > *");
  const t = $("tree").querySelector("li .row");
  if (!d || !t) return;
  const now = parseFloat(getComputedStyle($("tree")).paddingTop) || 0;
  // (each within its own column: the dump's column may be stuck to the
  // top of the window)
  const top = (e, c) => e.getBoundingClientRect().top -
    e.closest(c).getBoundingClientRect().top;
  const delta = top(d, ".words") - top(t, ".storage");
  $("tree").style.paddingTop = `${Math.max(0, now + delta)}px`;
  // as tall as the storage dump, scrolling inside itself
  const dump = $("dump").getBoundingClientRect();
  const tree = $("tree").getBoundingClientRect();
  if (innerWidth >= 1100) {
    $("tree").style.height = `${Math.max(100, dump.bottom - tree.top)}px`;
  } else $("tree").style.height = "";
}

// Scroll the tree, inside its box only, to show a row
function treeTo(path) {
  expandTo(path);
  const tree = $("tree");
  const li = path && tree.querySelector(`li[data-path="${CSS.escape(path)}"]` +
    " > .row");
  if (!li || tree.scrollHeight <= tree.clientHeight) return;
  const r = li.getBoundingClientRect();
  const b = tree.getBoundingClientRect();
  if (r.top < b.top || r.bottom > b.bottom) {
    tree.scrollTop += r.top - b.top - (b.height - r.height) / 2;
  }
}
addEventListener("resize", () => current && alignColumns());
document.addEventListener("scroll", (e) => {
  if (e.target.id === "tree") edges();
}, true);

function render() {
  $("tree").style.paddingTop = "";
  $("tree").scrollTop = 0;
  const { f, scene } = current;
  $("summary").textContent = scene.summary;
  showScene(scene);
  showCalldata(scene.calldata ? f.tx.input : null, scene.calldata);
  renderTree();
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

const word = (n) => "0x" + n.toString(16).padStart(64, "0");
const shortVal = (h) => {
  const n = num(h);
  return n < 1n << 32n ? String(n) : short(word(n));
};
// "…7527": the end of a slot's address, as the gutter shows it
const tailOf = (h) => `…${word(num(h)).slice(-4)}`;
// a mapping key, by the player's name when it is one
const keyName = (h) => {
  const k = word(num(h)).slice(-40);
  return Object.entries(current.f.players ?? {}).find(([a]) =>
    a.toLowerCase().endsWith(k))?.[1] ?? short(h);
};

// The raw steps of a value's evaluation, as decode.js replay() recorded
// them (with the start), in order: { kind, s?, region? }
function rawSteps(v) {
  if (v.how.context) return [{ kind: "context", c: v.how.context }];
  const out = [{ kind: "start", o: v.how.origin }];
  const all = stepsOf(v);
  let i = 0;
  while (all[i]?.s.kind === "define") i++; // the page's own inputs
  for (const { s, region } of all.slice(i)) {
    out.push({ kind: s.kind, s, region });
  }
  return out;
}

// bytes a–b of a region, or the slots it spans
function bytesText(r) {
  const o = Number(num(r.offset ?? "0x0"));
  const n = r.length !== undefined ? Number(num(r.length)) : 32 - o;
  if (o + n > 32) return `${Math.ceil((o + n) / 32)} slots`;
  return o === 0 && n === 32 ? "the whole slot" : n === 1 ? `byte ${o}`
    : `bytes ${o}–${o + n - 1}`;
}

// The replay of a selection: the rules its pointers follow, each shown
// once, by example, then for the rest. The values under the selection
// (in the state shown) are walked together; their raw steps are sorted
// into one idea each, in order:
//   declared  the variable's own slot (`define slot`, a literal; or the
//             program context's region, for a value type)
//   entry     a mapping's key, its template and `define slot :=
//             keccak(key, slot)`: the first key, then the others
//   item      an array's template and `define data := keccak(slot)`, the
//             list item and its region
//   record    a struct's template: the slots its members take
//   fields    the members' regions in one packed slot
//   short     a string's `define slot + n`, template and length flag,
//             the branch, and the data region in the slot (short)
//   long      … or the branch, `define length`, `define start :=
//             keccak(slot)` and the data region there (long)
// Nothing here computes a slot: every number comes from the library's
// evaluation (decode.js), or from the state (a flag byte).
function replaySteps(path, side, focus) {
  const node = find(current.tree, path);
  const { types } = current.f.contract;
  const leaves = [];
  // every value under the selection (an array's length too); in a
  // mapping, every value under the mapping: its rules are shown for all
  // of its entries at once (`picked`: the selection's own values)
  const visit = (n) => {
    if (n[side]) leaves.push(n);
    (n.children ?? []).forEach(visit);
  };
  const varNode = find(current.tree, path.split(/[.[]/)[0]);
  const isMap = types[varNode?.typeId]?.kind === "mapping";
  visit(isMap ? varNode : node);
  // (an array's items are counted by its length: an item takes the
  // length's step too)
  if (types[varNode?.typeId]?.kind === "array" && varNode !== node &&
    varNode[side]) leaves.unshift(varNode);
  const picked = new Set();
  const visitPicked = (n) => {
    picked.add(n.path);
    (n.children ?? []).forEach(visitPicked);
  };
  visitPicked(node);
  if (!leaves.some((l) => picked.has(l.path))) return [];
  const word = (h) => "0x" + num(h).toString(16).padStart(64, "0");
  const wordAt = (h) => current.f.slots[word(h)]?.[side];
  const tail = (h) => `…${word(h).slice(-4)}`;
  const small = (h) => num(h) < 1n << 32n ? String(num(h)) : tail(h);
  const keyName = (h) => {
    const k = word(h).slice(-40);
    return Object.entries(current.f.players ?? {}).find(([a]) =>
      a.toLowerCase().endsWith(k))?.[1] ?? short(h);
  };
  const top = (n) => n.path.split(/[.[]/)[0];
  const entryPath = (n) => n.path.match(/^[^.[]+\[[^\]]*\]/)?.[0];
  const ph = new Map(); // idea -> { order, ... }
  const add = (k, f) => {
    if (!ph.has(k)) ph.set(k, { k, order: ph.size, slots: new Set(),
      regions: [], items: [] });
    f(ph.get(k));
  };
  // what each entry of a mapping holds: its key and slot, its fields,
  // its string (by entry path, in the tree's order)
  const recs = new Map();
  const recOf = (leaf) => {
    const e = entryPath(leaf);
    if (!e) return null;
    if (!recs.has(e)) recs.set(e, { path: e, fields: [], name: null });
    return recs.get(e);
  };
  for (const leaf of leaves) {
    const v = leaf[side];
    let branch = null;
    let mode = null; // the string's layout, from its branch
    for (const r of rawSteps(v)) {
      if (r.kind === "context") {
        add("declared", (p) => {
          p.var = r.c.variable;
          p.slot = r.c.slot;
          p.regions.push(v.region);
          p.context = r.c;
        });
      } else if (r.kind === "start") {
        add("declared", (p) => {
          p.var = r.o.variable;
          p.slot = r.o.slot;
          if (wordAt(r.o.slot) !== undefined) p.slots.add(word(r.o.slot));
          p.typeKind = types[find(current.tree, r.o.variable)?.typeId]?.kind;
        });
      } else if (r.kind === "define") {
        const op = r.s.expr && typeof r.s.expr === "object"
          ? Object.keys(r.s.expr)[0] : null;
        const a = (r.s.args ?? []).map((x) => x.value.hex);
        if (op === "$keccak256" && a.length === 2) {
          Object.assign(recOf(leaf) ?? {}, { key: a[0], base: a[1],
            slot: r.s.value.hex });
          add("entry", (p) => {
            const key = a[0];
            if (!p.items.some((x) => x.key === key)) {
              p.items.push({ key, base: a[1], slot: r.s.value.hex,
                path: entryPath(leaf) });
            }
            p.var = top(leaf);
          });
        } else if (op === "$keccak256" && r.s.id === "data") {
          add("item", (p) => {
            p.base = a[0];
            p.data = r.s.value.hex;
            p.var = top(leaf);
          });
        } else if (op === "$keccak256" && recOf(leaf)) {
          recOf(leaf).to = r.s.value.hex;
        } else if (op === "$keccak256") {
          add("long", (p) => p.items.push({ leaf, from: a[0],
            to: r.s.value.hex }));
        }
      } else if (r.kind === "template") {
        const t = types[r.s.name];
        if (t?.kind === "struct" && recOf(leaf)) recOf(leaf).struct = t;
        else if (t?.kind === "struct") {
          add("record", (p) => {
            p.struct = t;
            p.entry ??= entryPath(leaf);
          });
        }
      } else if (r.kind === "if") {
        branch = r.s.branch;
        mode = branch === "then" ? "short" : "long";
      } else if (r.kind === "list") {
        add("item", (p) => (p.indexes ??= []).push(r.s.index));
      } else if (r.kind === "region" && r.region) {
        const n = r.s.name;
        const g = r.region;
        if (n === "length-flag") {
          // the string's layout is known from the next branch: later
          leaf._flag = g;
        } else if (n === "long-length") {
          leaf._long = g;
        } else if (n === "data" && recOf(leaf)) {
          recOf(leaf).name = { leaf, flag: leaf._flag, long: leaf._long, data: g,
            mode: mode ?? "short" };
        } else if (n === "data") {
          add(mode ?? "short", (p) => p.items.push({ leaf, flag: leaf._flag,
            long: leaf._long, data: g }));
        } else if (n === "item") {
          add("item", (p) => p.regions.push(g));
        } else if (n === "length" && !entryPath(leaf)) {
          add("length", (p) => {
            p.region = g;
            p.var = top(leaf);
          });
        } else if (recOf(leaf)) {
          recOf(leaf).fields.push({ leaf, name: n, region: g });
        } else {
          add("fields", (p) => p.items.push({ leaf, name: n, region: g }));
        }
      }
    }
  }
  // where the keys come from: the contract's own list of them (roster,
  // decoded from storage), or the trace
  const keyList = current.f.keysIn ? Object.values(current.f.keysIn)[0] : null;
  const keySource = keyList ? `key from ${keyList}` : "key from the trace";
  // the tree path of the list item a key comes from (roster[i])
  const keyItem = (key) => {
    const list = keyList && find(current.tree, keyList);
    const k = word(key).slice(-40);
    return list?.children?.find((c) => c[side]?.text?.toLowerCase()
      .endsWith(k)) ?? null;
  };
  const out = [];
  const step = (x) => out.push({ constructs: [], slots: [], regions: [],
    rows: [], ...x });
  const name = (n) => n.path.slice((entryPath(n) ?? top(n)).length)
    .replace(/^\./, "") || n.label;
  // an address with its player's name as a small gloss
  const addr = (h) => {
    const who = keyName(h);
    return `${esc(short(h))}${who !== short(h) ? ` <span class="gloss">${
      esc(who)}</span>` : ""}`;
  };
  // A mapping's rules, one step each, for all of its entries at once:
  // where each entry is, its slots, its packed fields, its string. The
  // focus entry (the selection's, or the one picked) is at full
  // strength where the steps show one entry's layout; the others echo
  // it, muted.
  const mapSteps = (variable) => {
    const rs = [...recs.values()].filter((r) => r.slot);
    if (!rs.length) return [];
    const f = recs.get(focus) ?? recs.get(entryPath({ path })) ?? rs[0];
    const who = (r) => keyName(r.key);
    const ec = forRow(current.panel, variable).colors ?? new Map();
    const kOf = (r) => ec.get(r.path) ?? 1;
    const base = rs[0].base;
    const steps = [];
    const all = (x) => ({ recs: rs.map((r) => ({ path: r.path, who: who(r) })),
      focus: f.path, var: variable, constructs: [], slots: [], regions: [],
      rows: [], ...x });
    // (2) each entry's slot, from its key; the keys' list items, in their
    // entries' colours
    const items = rs.map((r) => ({ r, item: keyItem(r.key) }));
    steps.push(all({ phase: "entries",
      cap: `Each record is at keccak(key, ${small(base)}); ${keyList
        ? `the keys are the addresses in \`${keyList}\`` : "the keys come " +
        "from the trace"}`,
      form: `<span class="itab">${rs.map((r) => `<span>${addr(r.key)}</span>` +
        `<span class="prose">→</span><span class="pk${kOf(r)} isw">${esc(
          tail(r.slot))}</span>`).join("")}</span>`,
      constructs: ["$keccak256", "define", "template"], source: keySource,
      chip: `keccak(key, ${small(base)})`, chipLabel: "records",
      parts: [{ slots: rs.map((r) => word(r.slot)),
        regions: items.filter((x) => x.item).map((x) => x.item[side].region),
        rows: [...rs.map((r) => r.path), ...items.filter((x) => x.item)
          .map((x) => x.item.path)],
        colors: new Map([...ec, ...items.filter((x) => x.item).map((x) =>
          [x.item.path, kOf(x.r)])]) }],
      rows: rs.map((r) => r.path) }));
    // (3) a record's slots: those its fields and its string's flag are in
    const slotsOf = (r) => [...new Set([...r.fields.map((x) => x.region.slot),
      ...(r.name ? [r.name.flag.slot] : [])].map(word))]
      .sort((a, b) => (num(a) < num(b) ? -1 : 1));
    const fs = slotsOf(f);
    const nWord = (n) => ["no", "one", "two", "three", "four"][n] ?? n;
    const strName = f.name ? name(f.name.leaf) : null;
    steps.push(all({ phase: "record",
      cap: `A record is ${nWord(fs.length)} ${fs.length === 1 ? "slot"
        : "slots"}${fs.length === 2 && strName ? `: stats, then \`${
        strName}\`` : ""}`,
      form: `${esc(who(f))}: ${esc(fs.map((sl, k) => k ? `${tail(fs[0])} + ${
        k} = ${tail(sl)}` : tail(sl)).join(", "))}`,
      constructs: ["group", "$sum"], source: "from solc's pointer",
      chip: `${fs.length} slots`, chipLabel: "record",
      parts: rs.map((r) => ({ slots: slotsOf(r), rows: [r.path],
        colors: ec, dim: r !== f })),
      rows: [f.path] }));
    // (4) the stats, packed in one slot; in colours of their own (never
    // an entry's), the same field in the same colour in every entry
    const want = new Set(rs.flatMap((r) => r.fields).filter((x) =>
      picked.has(x.leaf.path)).map((x) => x.name));
    if (want.size) {
      const used = new Set(ec.values());
      const free = [...Array(PICKS).keys()].slice(1).filter((k) =>
        !used.has(k));
      const fc = forRow(current.panel, f.path).colors ?? new Map();
      const kField = (n) => {
        const k = fc.get(`${f.path}.${n}`);
        return k ? free[(k - 1) % free.length] : 0;
      };
      const colors = new Map(rs.flatMap((r) => r.fields.map((x) =>
        [x.leaf.path, kField(x.name)])));
      const items = [...f.fields].sort((a, b) =>
        Number(num(a.region.offset ?? "0x0") - num(b.region.offset ?? "0x0")));
      steps.push(all({ phase: "fields",
        cap: items.length > 1
          ? "The stats share one slot, packed from the right"
          : `\`${items[0]?.name}\` is in its record's first slot`,
        form: items.map((x) => `<span class="fname" data-path="${esc(
          x.leaf.path)}">${esc(x.name)}</span> ${esc(bytesText(x.region)
          .replace(/^bytes? /, ""))}`).join(" · "),
        constructs: ["region"], source: "from solc's pointer",
        chip: `${items.length} fields`, chipLabel: "fields",
        names: [...want],
        parts: rs.flatMap((r) => r.fields.map((x) => ({ regions: [x.region],
          rows: [x.leaf.path], colors,
          dim: r !== f || !want.has(x.name) }))),
        rows: f.fields.map((x) => x.leaf.path),
        ruler: items[0]?.region.slot }));
    }
    // (5) the string: its slot's last byte says short (even) or long
    // (odd), both at once
    if (rs.some((r) => r.name && picked.has(r.name.leaf.path))) {
      const withName = rs.filter((r) => r.name);
      const fl = (r) => wordAt(r.name.flag.slot).slice(-2);
      const shorts = withName.filter((r) => r.name.mode !== "long");
      const longs = withName.filter((r) => r.name.mode === "long");
      const ex = (list) => list.includes(f) ? f : list[0];
      const lines = [];
      if (shorts.length) {
        const r = ex(shorts);
        lines.push(`even: 0x${fl(r)} → ${num("0x" + fl(r)) / 2n} bytes ` +
          `inline <span class="prose">(${esc(who(r))})</span>`);
      }
      if (longs.length) {
        const r = ex(longs);
        const len = (num(wordAt(r.name.flag.slot)) - 1n) / 2n;
        lines.push(`odd: 0x${fl(r)} → ${len} bytes at keccak(${esc(tail(
          r.name.flag.slot))}) <span class="prose">(${esc(who(r))})</span>`);
      }
      const nm = name(withName[0].name.leaf);
      steps.push(all({ phase: "name",
        cap: `The last byte decides \`${nm}\`'s form`,
        form: lines.join("<br>"),
        constructs: ["if", "$read", "$keccak256"],
        source: "read from storage",
        chip: `${nm}: short | long`, chipLabel: "string",
        parts: [{ regions: withName.flatMap((r) => [r.name.mode === "long"
          ? r.name.long ?? r.name.flag : r.name.flag, r.name.data]),
        rows: withName.map((r) => r.name.leaf.path),
        colors: ec }],
        rows: withName.map((r) => r.name.leaf.path) }));
    }
    return steps;
  };
  for (const p of [...ph.values()].sort((a, b) => a.order - b.order)) {
    if (p.k === "declared") {
      const w = wordAt(p.slot);
      const kind = p.typeKind ?? "value";
      // (a mapping's, an array's or a string's own slot: named here, read
      // by a later rule; its gutter only)
      const dyn = !p.context && ["mapping", "array", "string"].includes(kind);
      step({ phase: "declared", var: p.var,
        cap: p.context ? `\`${p.var}\` is at slot ${small(p.slot)}, ${
          p.context.length} bytes from offset ${p.context.offset}`
          : kind === "mapping" && w !== undefined && !num(w)
            ? `\`${p.var}\` is declared at slot ${small(p.slot)}; that slot ` +
              "holds nothing"
            : dyn ? `\`${p.var}\` is declared at slot ${small(p.slot)}`
              : `\`${p.var}\` gets slot ${small(p.slot)}`,
        form: esc(p.context ? `slot ${small(p.slot)}, bytes ${
          p.context.offset}–${p.context.offset + p.context.length - 1}`
          : `slot ${small(p.slot)}${w === undefined || (dyn &&
            kind !== "mapping") ? "" : ` = ${small(w)}`}`),
        constructs: ["pointer"], source: "from solc's pointer",
        chip: `slot ${small(p.slot)}`, chipLabel: kind === "struct" ? "record"
          : ["mapping", "string"].includes(kind) ? kind : kind === "array"
            ? "array" : "value",
        slots: dyn ? [] : [...p.slots], regions: dyn ? [] : p.regions,
        gutters: dyn ? [word(p.slot)] : [], rows: [p.var] });
    } else if (p.k === "length") {
      const n = num(wordAt(p.region.slot) ?? "0x0");
      step({ phase: "length", var: p.var,
        cap: `slot ${small(p.region.slot)} holds the length: ${n}`,
        form: esc(`length = ${n}`), constructs: ["region"],
        source: "read from storage", chip: `length ${n}`, chipLabel: "array",
        regions: [p.region], rows: [p.var] });
    } else if (p.k === "entry") {
      out.push(...mapSteps(p.var));
    } else if (p.k === "item") {
      const ix = [...new Set(p.indexes ?? [])].sort((a, b) => a - b);
      const one = ix.length > 1 && p.regions.every((r) =>
        num(r.offset ?? "0x0") === num(p.regions[0].offset ?? "0x0"));
      step({ phase: "item", var: p.var,
        cap: ix.length > 1 ? `The items start at keccak(${small(p.base)}), ${
          one ? "one slot each, " : ""}for \`length\` items`
          : `The items start at keccak(${small(p.base)})`,
        form: esc(`keccak256(${small(p.base)}) = ${tail(p.data)}${ix.length > 1
          ? `; items ${ix[0]}…${ix.at(-1)} at + i` : ix.length
            ? `; item ${ix[0]} at + ${ix[0]}` : ""}`),
        constructs: ["$keccak256", "list"], source: "from solc's pointer",
        chip: `keccak(${small(p.base)})`, chipLabel: "items",
        slots: p.regions.length ? [] : [word(p.data)], regions: p.regions,
        rows: leaves.filter((l) => l.path.startsWith(`${p.var}[`))
          .map((l) => l.path), colorsOf: p.var });
    } else if (p.k === "record") {
      // the record's own slots: those its members' regions are in
      const entry = find(current.tree, p.entry);
      const base = num(ph.get("entry")?.items.find((x) =>
        x.path === p.entry)?.slot ?? "0x0");
      const own = new Set();
      const visit2 = (n) => {
        const v = n[side];
        for (const r of [v?.region, ...(v?.parts ?? []).map((q) => q.region)]) {
          const d = r ? num(r.slot) - base : -1n;
          if (d >= 0n && d < 64n) own.add(word(r.slot));
        }
        (n.children ?? []).forEach(visit2);
      };
      if (entry) visit2(entry);
      const slots = [...own].sort((a, b) => (num(a) < num(b) ? -1 : 1));
      const per = slots.map((sl) => p.struct.contains.filter((m) => {
        const c = entry.children.find((x) => x.label === m.name);
        const r = c?.[side]?.parts?.[0]?.region ?? c?.[side]?.region;
        return r && word(r.slot) === sl;
      }).map((m) => m.name));
      step({ phase: "record", var: top(entry), struct: p.struct,
        cap: `A ${p.struct.definition?.name ?? "record"} is ${slots.length} ${
          slots.length === 1 ? "slot" : "slots"}${per.length === 2
          ? `: ${per[0].length} fields, then the ${per[1].map((x) =>
            `\`${x}\``).join(", ")}` : ""}`,
        form: esc(slots.map((sl, k) => k ? `${tail(slots[0])} + ${k} = ${
          tail(sl)}` : tail(sl)).join(", ")),
        constructs: ["group", "$sum"], source: "from solc's pointer",
        chip: `${slots.length} slots`, chipLabel: "record", slots,
        rows: [p.entry], oneColor: p.entry });
    } else if (p.k === "fields") {
      // the fields in the dump's order, left to right; their colours
      // are their own (never an entry's)
      const items = [...p.items].sort((a, b) =>
        Number(num(a.region.offset ?? "0x0") - num(b.region.offset ?? "0x0")));
      const many = items.length > 1;
      const right = [...items].sort((a, b) =>
        Number(num(b.region.offset ?? "0x0") - num(a.region.offset ?? "0x0")))
        [0];
      const n32 = (r) => Number(num(r.length ?? "0x20"));
      step({ phase: "fields", var: top(items[0].leaf),
        cap: many ? `The fields share one slot, packed from the right: \`${
          name(right.leaf)}\` takes the last ${n32(right.region)} bytes`
          : `\`${name(items[0].leaf)}\` is in its record's slot`,
        form:
          items.map((x) => `<span class="fname" data-path="${esc(
            x.leaf.path)}">${esc(name(x.leaf))}</span> ${esc(
            bytesText(x.region).replace(/^bytes? /, ""))}`).join(" · "),
        constructs: ["region"], source: "from solc's pointer",
        chip: many ? `${items.length} fields` : bytesText(items[0].region),
        chipLabel: many ? "fields" : "field",
        regions: items.map((x) => x.region),
        rows: items.map((x) => x.leaf.path),
        fieldsOf: entryPath(items[0].leaf), ruler: items[0].region.slot });
    } else if (p.k === "short") {
      const x = p.items[0];
      const fl = wordAt(x.flag.slot).slice(-2);
      const len = num("0x" + fl) / 2n;
      step({ phase: "short", var: top(x.leaf),
        cap: "A short string sits at the left of its slot; the last " +
          "byte holds 2 × length",
        form: esc(`0x${fl} = 2 × ${len}, so ${len} bytes: ${x.leaf[side].text}`),
        constructs: ["if", "$read"], source: "read from storage",
        chip: `0x${fl}`, chipLabel: entryPath(x.leaf) ? "name" : "value",
        regions: [x.flag, x.data], rows: [x.leaf.path] });
    } else if (p.k === "long") {
      const ds = p.items.filter((y) => y.data).slice(0, 1);
      const x = ds[0] ?? p.items[0];
      const fl = wordAt(x.flag.slot).slice(-2);
      const len = (num(wordAt(x.flag.slot)) - 1n) / 2n;
      const to = p.items.find((y) => y.to && y.leaf === x.leaf)?.to;
      const slotsOf = Math.ceil(Number(len) / 32);
      const who = entryPath(x.leaf) && keyName(find(current.tree,
        entryPath(x.leaf))?.key ?? "0x0");
      const what = entryPath(x.leaf) ? `${who}'s \`${name(x.leaf)}\``
        : `\`${x.leaf.label}\``;
      const whatSlot = entryPath(x.leaf) ? `${who}'s ${name(x.leaf)} slot`
        : `${x.leaf.label}'s slot`;
      step({ phase: "long", var: top(x.leaf),
        cap: `${what}, ${len} bytes, is too long for its slot`,
        form: esc(`${whatSlot} ${tail(x.flag.slot)} holds 2 × ${len} + 1 = ` +
          `0x${fl} (odd: long); the bytes are at keccak256(${tail(
            x.flag.slot)}) = ${to ? tail(to) : "?"}${slotsOf > 1
            ? `, ${slotsOf} slots` : ""}`),
        constructs: ["if", "$read", "$keccak256"], source: "read from storage",
        chip: `keccak(${tail(x.flag.slot)})`,
        chipLabel: entryPath(x.leaf) ? "name" : "value",
        regions: ds.flatMap((y) => [y.long ?? y.flag, y.data]),
        rows: [x.leaf.path] });
    }
  }
  return out;
}

// The spec pages, one per pointer construct (ethdebug/format)
const SPEC = "https://ethdebug.github.io/format/spec/pointer/";
const FOOT = {
  pointer: ["A pointer is a region or a collection of pointers",
    `${SPEC}concepts/#a-pointer-is-a-region-or-a-collection-of-other-pointers`],
  $keccak256: ["Expressions: keccak256",
    `${SPEC}expression/#keccak256-hashes`],
  template: ["Pointer templates", `${SPEC}template/`],
  group: ["Group (a collection of pointers)", `${SPEC}collection/group/`],
  region: ["Storage regions: slot, offset, length",
    `${SPEC}region/location/storage/`],
  if: ["Conditional (if, then, else)", `${SPEC}collection/conditional/`],
  list: ["List (a collection of pointers)", `${SPEC}collection/list/`],
};
// the one construct of a step that gets a footnote
const footOf = (st) => st.constructs.find((c) => FOOT[c]);

// The pointer panel: the selection's variable's pointer, and the
// templates it uses, as YAML, as solc wrote them (the template names
// shortened to their types' names). One line each, nothing wraps: leaf
// regions and expressions in flow style. Each line keeps tags for what
// it is part of, so a step can light the lines it uses.
const isExpr = (v) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length === 1 && Object.keys(v)[0].startsWith("$");
const isRegion = (v) => v && typeof v === "object" && "location" in v;
const allScalar = (v) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.values(v).every((x) => typeof x !== "object");
// (a region's keys in the spec's order: name, location, slot, offset,
// length)
const ORDER = ["name", "location", "slot", "offset", "length"];
const entriesOf = (v) => isRegion(v) ? Object.entries(v).sort(([a], [b]) =>
  (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
  : Object.entries(v);
// (`rename` gives a template's short name: for the value of every
// `template` key, at any depth)
function flowOf(v, rename, isTemplate = false) {
  if (typeof v === "string") return isTemplate ? rename?.(v) ?? v : v;
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) return `[${v.map((x) => flowOf(x, rename))
    .join(", ")}]`;
  return `{ ${entriesOf(v).map(([k, x]) => `${k}: ${flowOf(x, rename,
    k === "template")}`).join(", ")} }`;
}
function pointerYaml(variable) {
  const { pointers, types } = current.f.contract;
  const v = current.f.contract.variables.find((x) => x.identifier ===
    variable);
  if (!v) return { lines: [], names: {} };
  const names = {};
  const short = (n) => {
    if (!pointers[n]) return n;
    return names[n] ??= types[n] ? typeName(types[n], types) : n;
  };
  const lines = [];
  const put = (d, text, tags) => lines.push({ text: "  ".repeat(d) + text,
    tags });
  const todo = [];
  // a mapping: `key: value`, in block style unless it is a leaf
  // (keys in the spec's order: a conditional's if, then, else)
  const COND = ["if", "then", "else"];
  // (and a region's: name, location, slot, offset, length)
  const ordered = (o) => "if" in o ? Object.entries(o).sort(([a], [b]) =>
    (COND.indexOf(a) + 1 || 9) - (COND.indexOf(b) + 1 || 9))
    : entriesOf(o);
  // a value in flow style, if it is short enough for one line
  const WIDE = 80;
  const flowFits = (k, x, d) => `${"  ".repeat(d)}${k}: ${flowOf(x,
    short, k === "template")}`.length <= WIDE;
  const block = (o, d, tags) => {
    for (const [k, x] of ordered(o)) {
      const own = k === "define" ? [`define:${Object.keys(x)[0]}`]
        : k === "if" ? ["if"] : k === "expect" ? ["expect"] : [];
      if (k === "template") todo.push(x);
      // (and a template named inside a value written in flow style)
      const inner = (v) => v && typeof v === "object" && Object.entries(v)
        .forEach(([kk, vv]) => kk === "template" ? todo.push(vv) : inner(vv));
      if (k !== "template") inner(x);
      // (an expression too long for one line: its operator, then its
      // operands, one a line)
      if (isExpr(x) && !flowFits(k, x, d)) {
        const [op] = Object.keys(x);
        put(d, `${k}:`, [...tags, ...own]);
        put(d + 1, `${op}:`, [...tags, ...own]);
        for (const y of [].concat(x[op])) {
          put(d + 2, `- ${flowOf(y, short)}`, [...tags, ...own]);
        }
        continue;
      }
      if (typeof x !== "object" || isExpr(x) ||
        ((isRegion(x) || allScalar(x)) && flowFits(k, x, d)) ||
        (Array.isArray(x) && x.every((y) => typeof y !== "object"))) {
        put(d, `${k}: ${flowOf(x, short, k === "template")}`,
          [...tags, ...own, ...(isRegion(x) ? [`region:${x.name}`] : [])]);
      } else if (Array.isArray(x)) {
        put(d, `${k}:`, [...tags, ...own]);
        for (const y of x) item(y, d + 1, [...tags, ...own]);
      } else {
        const branch = k === "then" || k === "else" ? [k] : [];
        put(d, `${k}:`, [...tags, ...own, ...branch]);
        block(x, d + 1, [...tags, ...own, ...branch]);
      }
    }
  };
  // a list item
  const item = (y, d, tags) => {
    if (isRegion(y) && `${"  ".repeat(d)}- ${flowOf(y, short)}`.length <=
      WIDE) {
      put(d, `- ${flowOf(y, short)}`, [...tags, `region:${y.name}`]);
      return;
    }
    const at = lines.length;
    block(isRegion(y) ? Object.fromEntries(entriesOf(y)) : y, d + 1,
      [...tags, "item", ...(isRegion(y) ? [`region:${y.name}`] : [])]);
    lines[at].text = `${"  ".repeat(d)}- ${lines[at].text.trimStart()}`;
  };
  put(0, `${variable}:`, ["var"]);
  block(v.pointer, 1, ["var"]);
  // a mapping, array or string variable: its type's template, which
  // decode.js applies to its pointer
  if (!v.pointer.in && pointers[v.type.id]) todo.unshift(v.type.id);
  const done = new Set();
  while (todo.length) {
    const n = todo.shift();
    if (done.has(n) || !pointers[n]) continue;
    done.add(n);
    const kind = types[n]?.kind ?? "template";
    put(0, "", []);
    put(0, `${short(n)}:`, [`t:${kind}`, "head"]);
    block(pointers[n], 1, [`t:${kind}`]);
  }
  return { lines, names };
}

// The lines a step uses: the part of the pointer it evaluates
function activeLines(lines, st) {
  const has = (l, ...ts) => ts.every((t) => l.tags.includes(t));
  const pick = (f) => lines.map((l, i) => f(l) ? i : -1).filter((i) => i >= 0);
  switch (st.phase) {
    case "declared": return pick((l) => has(l, "var"));
    case "entries": return pick((l) => has(l, "t:mapping") &&
      l.tags.some((t) => t.startsWith("define:")) && !has(l, "item"));
    case "length": return pick((l) => has(l, "t:array") &&
      has(l, "region:length"));
    case "item": return pick((l) => has(l, "t:array") && has(l, "item") &&
      !has(l, "region:length"));
    // (the record: the whole struct template, its group of members)
    case "record": return pick((l) => has(l, "t:struct"));
    case "fields": {
      const names = new Set((st.names ?? st.rows.map((p) => p.split(".")
        .pop())).map((n) => `region:${n}`));
      return pick((l) => has(l, "t:struct") && l.tags.some((t) =>
        names.has(t)));
    }
    case "short": return pick((l) => has(l, "t:string") && (has(l,
      "region:length-flag") || has(l, "if") || has(l, "then")));
    case "long": return pick((l) => has(l, "t:string") && (has(l,
      "region:length-flag") || has(l, "if") || has(l, "else")));
    case "name": return pick((l) => has(l, "t:string") && (has(l,
      "region:length-flag") || has(l, "if") || has(l, "then") ||
      has(l, "else")));
    default: return [];
  }
}

// The highlighted YAML of a variable's pointer, once the colouring has
// loaded (index.html window.loading.shiki), by variable
const yamlHtml = {};
function colourYaml(variable, text) {
  if (yamlHtml[variable] !== undefined) return yamlHtml[variable];
  yamlHtml[variable] = null;
  window.loading.shiki?.().then((hl) => {
    if (!hl) return;
    const t = document.createElement("template");
    t.innerHTML = hl.codeToHtml(text, { lang: "yaml",
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false });
    yamlHtml[variable] = [...t.content.querySelectorAll(".line")]
      .map((l) => l.innerHTML);
    if (chosen && chosen.split(/[.[]/)[0] === variable) renderBox();
  });
  return null;
}

// The highlight of a step: its slots' rows and its regions' bytes, its
// tree rows, in the colours of what it is about
function stepLight(st) {
  const h = st.parts ? partsLight(st) : forStep(current.panel, replay.side,
    st);
  if (!st.parts) h.rows = new Set(st.rows);
  if (st.gutters?.length) h.gutters = new Set(st.gutters);
  if (st.colorsOf) h.colors = forRow(current.panel, st.colorsOf).colors;
  // a record's slots in its entry's one colour (fields come later)
  if (st.oneColor) {
    const c = forRow(current.panel, st.oneColor);
    const at = replay.steps.find((x) => x.colorsOf)?.colorsOf;
    const k = at ? forRow(current.panel, at).colors?.get(st.oneColor) : 1;
    h.colors = new Map([...c.rows].map((r) => [r, k ?? 1]));
  }
  // fields in colours of their own: after every entry colour
  if (st.fieldsOf) {
    const entries = forRow(current.panel, st.var).colors;
    const used = new Set(entries ? [...entries.values()] : []);
    const f = forRow(current.panel, st.fieldsOf).colors;
    const free = [...Array(PICKS).keys()].slice(1).filter((k) => !used.has(k));
    h.colors = new Map([...(f ?? [])].map(([p, k]) => [p, k
      ? free[(k - 1) % free.length] : 0]));
    h.ruler = st.ruler;
  }
  if (st.parts) {
    h.colors = st.parts.reduce((m, p) => new Map([...m, ...(p.colors ?? [])]),
      new Map());
    h.ruler = st.ruler;
  }
  // the list item a key comes from, in the key's tint
  if (st.keyItem) {
    h.colors = new Map([...(h.colors ?? []), [st.keyItem, "src"]]);
  }
  // the slots the steps so far have derived keep their labels
  h.known = new Set();
  for (const x of replay.steps.slice(0, replay.i + 1)) {
    for (const g of x.gutters ?? []) h.known.add(g);
    for (const k of (x.parts ? partsLight(x)
      : forStep(current.panel, replay.side, x)).bytes) {
      h.known.add(k.split("|")[1]);
    }
  }
  return h;
}

// A step in parts: each part's slots and regions lit, some of them
// muted (an echo of the focus entry's layout in the others)
function partsLight(st) {
  const h = { bytes: new Set(), rows: new Set(), dim: new Set(),
    dimRows: new Set(), step: true, label: "" };
  for (const p of st.parts) {
    for (const k of forStep(current.panel, replay.side, p).bytes) {
      h.bytes.add(k);
      if (p.dim) h.dim.add(k);
    }
    for (const r of p.rows ?? []) {
      h.rows.add(r);
      if (p.dim) h.dimRows.add(r);
    }
  }
  return h;
}

// A caption's names from the code (in `backticks`), in monospace
const capHtml = (t) => esc(t).replace(/`([^`]+)`/g, '<code class="id">$1</code>');
const capText = (t) => t.replace(/`/g, "");

// The short caption of a step, for the bar over the dump
function shortCap(st) {
  switch (st.phase) {
    case "declared": return `\`${st.var}\`${st.var.endsWith("s") ? "'"
      : "'s"} own slot`;
    case "entries": return "every record, from its key";
    case "length": return "the length";
    case "item": return "the items, from a hash";
    case "record": return "a record's slots";
    case "fields": return st.rows.length > 1 ? "packed fields" : "its field";
    case "name": return "short or long";
    case "short": return "a short string";
    case "long": return "a long string";
    default: return st.cap;
  }
}

// The bar over the dump (one line: the selection, the controls, the
// step's short caption) and the panel stuck to the bottom of the dump's
// column (the step in full, the colours, the chips, the pointer, the
// footnotes). Both keep their size at all times: nothing moves when a
// value is selected, pointed at or replayed.
// what a composite's parts are called: a mapping's entries, a struct's
// fields, an array's items
const partsWord = (t, n) => ({ mapping: ["entry", "entries"],
  struct: ["field", "fields"], array: ["item", "items"] }[t?.kind] ??
  ["part", "parts"])[n === 1 ? 0 : 1];

function renderBox() {
  const bar = $("details");
  const text = $("dtext");
  const node = chosen && find(current.tree, chosen);
  if (!node) {
    // (the same room, idle)
    // (the same slots, empty: nothing moves when a value is selected)
    bar.classList.remove("replaying");
    $("dpanel").hidden = true;
    bar.innerHTML = `<span class="rmode"></span><span class="rsel muted">` +
      "Select a value to see how it was found.</span>" +
      `<span class="rctl"></span><span class="rcount"></span>` +
      `<span class="rshort"></span><span class="rexit"></span>`;
    $("chips").innerHTML = "";
    text.innerHTML = `<p class="rcap muted">Select a value, then "How was ` +
      "this found? ▸\" to step through the pointer that finds it.</p>";
    $("ptr").innerHTML = `<p class="muted small">Select a value to see ` +
      "the part of solc's ethdebug pointer that finds it.</p>";
    return;
  }
  const { types } = current.f.contract;
  const t = types[node.typeId];
  const v = node[mode];
  const side = current.single ? "" : ` <span class="muted">(${mode})</span>`;
  const parts = node.children?.length ?? 0;
  const sel = `<span class="rsel"><code>${esc(shortKeys(chosen))}</code>` +
    `${t ? ` <span class="type">${esc(typeName(t, types))}</span>` : ""}${
      v ? ` = <b>${esc(v.text)}</b>` : node.children
        ? ` <span class="muted">${parts} ${partsWord(t, parts)}</span>`
        : ""}${side}</span>`;
  const steps = replay ? replay.steps : replaySteps(chosen, mode);
  // footnote numbers: by first use in this replay
  const notes = [];
  for (const st of steps) {
    const c = footOf(st);
    if (c && !notes.includes(c)) notes.push(c);
  }
  const sup = (c) => `<sup class="fn">${notes.indexOf(c) + 1}</sup>`;
  const h = forRow(current.panel, chosen);
  let ctl;
  let short = "";
  let full;
  let count = "";
  if (replay) {
    const { i } = replay;
    const st = steps[i];
    const last = i === steps.length - 1;
    // ⏮ ◀ ▶ ⏭, each disabled at its end (no wrap; none of them exits)
    const b = (r, label, glyph, off) => `<button type="button" class="btn"` +
      ` data-r="${r}" aria-label="${label}"${off ? " disabled" : ""}>${
        glyph}</button>`;
    ctl = b("first", "First step", "⏮", !i) + b("prev", "Previous step", "◀",
      !i) + b("next", "Next step", "▶", last) + b("last", "Last step", "⏭",
      last);
    count = `${i + 1} / ${steps.length}`;
    short = capHtml(shortCap(st));
    const fc = footOf(st);
    full = `<p class="rcap">${capHtml(st.cap)}</p>` +
      `<p class="rform">${st.form}</p>` +
      `<p class="rsrc">${st.constructs.map((c) => `<code class="badge">${
        esc(c)}${c === fc ? sup(c) : ""}</code>`).join(" ")} <span class=` +
      `"source${st.sourceTint ? " pksrc" : ""}">${esc(st.source)}</span></p>`;
  } else {
    const where = h.info.find(([k]) => k === "Where" || k ===
      "Where after")?.[1] ?? "";
    const other = !current.single && v && node[mode === "before" ? "after"
      : "before"];
    // (one entry, one name, in every state)
    ctl = `<button type="button" class="btn rstart" data-r="start">` +
      "▸ Show how it was found</button>";
    full = v ? `<p class="rcap rwhere">${where}${other &&
      other.text !== v.text ? ` <span class="muted">(${mode === "after"
        ? "before" : "after"}: ${esc(other.text)})</span>` : ""}</p>`
      : `<p class="rcap rwhere">${node[mode] === undefined &&
        !node.children ? esc(missing(node, mode))
        : `${parts} ${partsWord(t, parts)}`}</p>`;
  }
  // every part in its own fixed slot, used or empty: the mode's label,
  // the selection, the controls, the count, the short caption, Exit.
  // A replay tints the bar; nothing moves. The button that had the
  // focus keeps it.
  const had = bar.contains(document.activeElement)
    ? document.activeElement.dataset?.r : null;
  bar.classList.toggle("replaying", !!replay);
  $("dpanel").hidden = !replay;
  bar.innerHTML = `<span class="rmode">${replay ? "Replay" : ""}</span>` +
    sel + `<span class="rctl">${ctl}</span>` +
    `<span class="rcount">${count}</span>` +
    `<span class="rshort">${short}</span>` +
    `<span class="rexit">${replay ? `<button type="button" class="btn" ` +
      'data-r="exit">✕ Exit</button>' : ""}</span>`;
  if (had) {
    const f = bar.querySelector(`button[data-r="${had}"]:not([disabled])`) ??
      bar.querySelector("button:not([disabled])");
    f?.focus({ preventScroll: true });
  }
  // the footnote of this step; at rest, all of them, and what the steps
  // are
  const fnote = (c) => `<span class="fnote"><sup>${notes.indexOf(c) + 1
    }</sup> <a href="${esc(FOOT[c][1])}" target="_blank" rel="noopener">${
    esc(FOOT[c][0])}</a></span>`;
  // (at rest: what the steps are, in one line)
  text.innerHTML = full + `<p class="fnotes">${replay
    ? [footOf(steps[replay.i])].filter(Boolean).map(fnote).join(" ")
    : `<span class="muted">Each step is one part of the pointer solc ` +
      `wrote for ${esc(chosen.split(/[.[]/)[0])}.</span>`}</p>`;
  // the focus entry, in a mapping's replay: which one the layout steps
  // show at full strength (the others echo it, muted)
  const rec = replay && steps.find((x) => x.recs);
  const hadPick = document.activeElement?.closest?.("#dpick")
    ? document.activeElement.dataset.focus : null;
  $("dpick").innerHTML = rec ? `<span class="plab">Focus</span>${
    rec.recs.map((r) => `<button type="button" class="btn" data-focus="${
      esc(r.path)}" aria-pressed="${r.path === replay.focus}">${esc(r.who)
    }</button>`).join("")}` : "";
  if (hadPick) {
    $("dpick").querySelector(`[data-focus="${CSS.escape(hadPick)}"]`)
      ?.focus({ preventScroll: true });
  }
  // the chips: one per step, done, current or later; all done at rest
  const at = replay ? replay.i : steps.length;
  $("chips").innerHTML = steps.map((st, k) => `<button type="button"` +
    ` class="chip ${k < at ? "done" : k === at ? "cur" : "later"}"` +
    ` data-k="${k}" aria-label="${esc(`Step ${k + 1}: ${capText(st.cap)}`)
    }">` +
    `<span class="ctext">${esc(st.chip)}</span>` +
    `<span class="clabel">${esc(st.chipLabel)}</span></button>`)
    .join('<span class="carrow" aria-hidden="true">→</span>');
  // the current chip, scrolled into the chips' row (one row; it scrolls
  // sideways inside itself)
  const cur = $("chips").querySelector(".chip.cur");
  const right = cur ? cur.offsetLeft - $("chips").offsetLeft +
    cur.offsetWidth : 0;
  $("chips").scrollLeft = Math.max(0, right - $("chips").clientWidth + 8);
  // the pointer: the variable's pointer and its templates, as YAML;
  // during a replay, the lines the step uses are lit and the rest muted
  const variable = chosen.split(/[.[]/)[0];
  const { lines, names } = pointerYaml(variable);
  const yamlText = lines.map((l) => l.text).join("\n");
  const html = colourYaml(variable, yamlText);
  const lit = replay ? new Set(activeLines(lines, steps[replay.i])) : null;
  const fc = replay && footOf(steps[replay.i]);
  const ids = Object.entries(names).map(([id, n]) => `${n} = ${id}`);
  void fc;
  $("ptr").classList.toggle("lit", !!lit?.size);
  // (in the Vyper scene: Vyper's own words for the player, first)
  $("ptr").innerHTML = vyperRule(node, mode) +
    // (one line each, as blocks; a run of lit lines is one block: rounded
    // at its first and last line only)
    `<pre class="ptrlines"><code>${lines.map((l, k) => {
      const on = lit?.has(k);
      const cls = on ? ` on${lit.has(k - 1) ? "" : " on-top"}${lit.has(k + 1)
        ? "" : " on-end"}` : "";
      return `<span class="line${cls}">${html?.[k] ?? esc(l.text)}</span>`;
    }).join("")}</code></pre>` +
    (ids.length ? `<p class="muted small pids">${PIDS}</p>` : "");
  markAliases($("ptr"), names);
  // the lines a step uses: the top of their block a third of the way
  // down the box (it scrolls inside itself; nothing else moves), as far as the
  // content allows
  const on = $("ptr").querySelector(".line.on");
  const box = $("ptr");
  const top = on ? Math.min(Math.max(0, on.offsetTop - box.clientHeight / 3),
    box.scrollHeight - box.clientHeight) : 0;
  box.scrollTo({ top, behavior: on && matchMedia(
    "(prefers-reduced-motion: reduce)").matches ? "auto" : on ? "smooth"
    : "auto" });
}

// The template names the page shortened (its own aliases for solc's
// ids): marked as such, each one, in the YAML lines; a click (or Enter)
// on one says, in the line under the YAML, which id it stands for
const PIDS = "Template names shortened for reading; solc writes ids like " +
  "<code>t_array$_t_address_$dyn_storage</code>.";
function markAliases(root, names) {
  const byName = Object.fromEntries(Object.entries(names).map(([id, n]) =>
    [n, id]));
  const list = Object.keys(byName).sort((a, b) => b.length - a.length);
  for (const line of root.querySelectorAll(".line")) {
    const plain = line.textContent;
    if (!/^\s*(- )?[^:]*:\s*$|template: /.test(plain)) continue;
    for (const n of list) {
      // the name as a key (a template's definition) or as a value of
      // `template`
      const at = [`template: ${n}`, `${n}:`].map((x) => [x, plain.indexOf(x)])
        .find(([x, i]) => i >= 0 && (x.startsWith("template") ||
          plain.trim().replace(/^- /, "") === x));
      if (!at || line.querySelector(".alias")) continue;
      const from = at[0].startsWith("template") ? at[1] + 10 : at[1];
      wrapRange(line, from, from + n.length, byName[n]);
    }
  }
}
function wrapRange(el, a, b, id) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let node;
  while ((node = walker.nextNode())) {
    const len = node.data.length;
    if (pos <= a && a <= pos + len) range.setStart(node, a - pos);
    if (pos <= b && b <= pos + len) {
      range.setEnd(node, b - pos);
      break;
    }
    pos += len;
  }
  const span = document.createElement("span");
  span.className = "alias";
  span.tabIndex = 0;
  span.setAttribute("role", "button");
  span.dataset.id = id;
  span.append(range.extractContents());
  range.insertNode(span);
}
document.addEventListener("click", (e) => {
  const a = e.target.closest?.("#ptr .alias");
  if (!a) return;
  const line = $("ptr").querySelector(".pids");
  if (line) {
    line.innerHTML = `<code class="alias">${esc(a.textContent)}</code> = ` +
      `solc's <code>${esc(a.dataset.id)}</code>`;
  }
});
document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") &&
    e.target.closest?.("#ptr .alias")) {
    e.preventDefault();
    e.target.click();
  }
});

// Start, step or leave the replay. Past the last step: the resolved view.
// Start, step or leave the replay. Stepping stops at the ends; only
// Exit (or Escape, or a new selection or scene) leaves it.
let started = 0; // when the replay started (a second click is ignored)
// the details unfold under the bar at entry and fold into it at exit
// (the one movement); meanwhile, the replay takes no input
let unfolding = false;
const still = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function fold(open) {
  const wrap = $("dwrap");
  const dp = $("dpanel");
  const h = dp.offsetHeight;
  if (still() || !h) return Promise.resolve();
  unfolding = true;
  wrap.classList.add("folding");
  const o = { duration: 280, easing: open ? "ease-out" : "ease-in" };
  const hs = [{ height: "0px" }, { height: `${h}px` }];
  const ts = [{ transform: `translateY(${-h}px)` }, { transform: "none" }];
  if (!open) {
    hs.reverse();
    ts.reverse();
  }
  wrap.animate(hs, { ...o, fill: "forwards" });
  return dp.animate(ts, { ...o, fill: "forwards" }).finished.then(() => {
    wrap.getAnimations().forEach((a) => a.cancel());
    dp.getAnimations().forEach((a) => a.cancel());
    wrap.classList.remove("folding");
    unfolding = false;
  });
}
function setFocus(path) {
  if (!replay || unfolding || path === replay.focus) return;
  replay.focus = path;
  replay.steps = replaySteps(replay.path, replay.side, path);
  renderBox();
  show();
}
function stepTo(i) {
  if (!replay || unfolding) return;
  const k = Math.max(0, Math.min(replay.steps.length - 1, i));
  if (k === replay.i) return;
  replay.i = k;
  renderBox();
  show();
  treeTo(replay.steps[k].rows?.[0]);
}
function startReplay(at = 0) {
  if (!chosen) return;
  const steps = replaySteps(chosen, mode);
  if (!steps.length) return;
  replay = { path: chosen, side: mode, steps, i: at,
    focus: steps.find((x) => x.recs)?.focus };
  started = performance.now();
  renderBox();
  show();
  fold(true);
  // the bar to the top of the window (its place in the page: under the
  // line before it), once, at entry
  const before = $("details").previousElementSibling;
  const y = before.getBoundingClientRect().bottom + scrollY +
    parseFloat(getComputedStyle(before).marginBottom || 0);
  scrollTo({ top: Math.max(0, y), behavior: still() ? "auto" : "smooth" });
  // (the focus on ▶, or the next control there is)
  ($("details").querySelector('button[data-r="next"]:not([disabled])') ??
    $("details").querySelector("button:not([disabled])"))
    ?.focus({ preventScroll: true });
}
async function endReplay() {
  if (!replay || unfolding) return;
  await fold(false);
  if (!replay) return;
  replay = false;
  renderBox();
  show();
  $("details").querySelector('button[data-r="start"]')
    ?.focus({ preventScroll: true });
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

// The selected value's declaration, marked in the contract's source at
// the top of the page (its lines, plain or coloured), and scrolled into
// that block's view (it scrolls inside itself)
let declLines = null;
function markSource(node) {
  const d = node && declaration(node);
  declLines = null;
  if (d) {
    // ranges count bytes
    const bytes = new TextEncoder().encode(current.f.contract.source);
    const before = new TextDecoder().decode(bytes.slice(0, d.range.offset));
    const inside = new TextDecoder().decode(bytes.slice(d.range.offset,
      d.range.offset + d.range.length));
    const first = before.split("\n").length - 1;
    declLines = [first, first + inside.split("\n").length - 1];
  }
  window.markDecl();
}
window.markDecl = () => {
  const pre = $("contract-src");
  if (!pre) return;
  // one span a line (Shiki's colouring gives them; plain text gets them)
  if (!pre.querySelector(".line")) {
    pre.innerHTML = pre.textContent.split("\n").map((l) =>
      `<span class="line">${esc(l)}</span>`).join("\n");
  }
  const lines = [...pre.querySelectorAll(".line")];
  lines.forEach((l, k) => l.classList.toggle("decl", !!declLines &&
    k >= declLines[0] && k <= declLines[1]));
  const m = declLines && lines[declLines[0]];
  if (m && pre.closest("details")?.open) {
    pre.scrollTop = Math.max(0, m.offsetTop - pre.offsetTop - 40);
  }
};


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
  const h = legend(replay ? stepLight(replay.steps[replay.i])
    : hover ?? sel);
  // (the selected row first: paint's merged blocks depend on it)
  for (const r of $("tree").querySelectorAll("li[data-path] > .row")) {
    const on = r.parentElement.dataset.path === chosen;
    r.classList.toggle("sel", on);
    r.setAttribute("aria-pressed", String(on));
  }
  paint($("panel"), $("tree"), h, { cards: !replay && showOther(),
    single: !!current?.single, chosen: !!replay || !!chosen });
  treeCard(h);
  edges();
  // with a value selected, the box is its own (renderBox)
  if (!chosen) $("dtext").innerHTML = details(h, PROBE);
  // a step's field names, in their fields' colours
  for (const f of $("dtext").querySelectorAll(".fname")) {
    const k = h?.colors?.get(f.dataset.path);
    f.className = `fname${k ? ` pk${k}` : ""}`;
  }
  // the locked state: what the view is on, and the way out
  // (it keeps its room: nothing moves when a value is selected)
  $("viewing").style.visibility = chosen ? "visible" : "hidden";
  $("viewing").textContent = chosen
    ? `viewing ${shortKeys(chosen)} · Esc to clear` : "\u00a0";
}

// A lit tree row out of the tree box's view (it scrolls inside itself):
// a pill on the box's edge, pointing down or up, with the row's path
// (and how many more lit rows are past that edge); a click scrolls the
// tree, inside itself, to it. Hover alone never scrolls the tree.
function edges() {
  const tree = $("tree");
  const b = tree.getBoundingClientRect();
  const rows = [...tree.querySelectorAll("li[data-path] > .row.hl")]
    .filter((r) => r.offsetParent);
  const past = { up: rows.filter((r) => r.getBoundingClientRect().bottom <=
    b.top + 1), down: rows.filter((r) => r.getBoundingClientRect().top >=
    b.bottom - 1) };
  // (the nearest row past each edge first)
  past.up.reverse();
  for (const [way, list] of Object.entries(past)) {
    const pill = $(`edge-${way}`);
    pill.hidden = !list.length;
    if (!list.length) continue;
    const r = list[0];
    const path = r.parentElement.dataset.path;
    const k = [...r.classList].find((c) => /^pk\d$/.test(c));
    pill.className = `tedge ${way}${k ? ` ${k}` : ""}`;
    pill.dataset.path = path;
    pill.innerHTML = `<span aria-hidden="true">${way === "up" ? "↑" : "↓"
      }</span> <code>${esc(shortKeys(path))}</code>${list.length > 1
      ? ` <span class="more">· ${list.length - 1} more</span>` : ""}`;
    pill.setAttribute("aria-label", `Scroll the variables to ${path}`);
  }
}
function edgeGo(pill) {
  const tree = $("tree");
  const r = tree.querySelector(`li[data-path="${CSS.escape(
    pill.dataset.path)}"] > .row`)?.getBoundingClientRect();
  if (!r) return;
  const b = tree.getBoundingClientRect();
  tree.scrollTo({ top: tree.scrollTop + r.top - b.top - (b.height -
    r.height) / 2, behavior: still() ? "auto" : "smooth" });
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
  // (no scrolling of the page; the tree scrolls inside its box)
  treeTo(path);
  keep();
  // what is under the pointer now gets its hover at once (no wait for
  // the mouse to move): after a click that clears, the row or byte
  // clicked
  rehover();
}
let lastPt = null; // the pointer's last position in the window
addEventListener("pointermove", (e) => {
  lastPt = e.pointerType === "touch" ? null : [e.clientX, e.clientY];
}, { passive: true });
addEventListener("pointerdown", (e) => {
  lastPt = e.pointerType === "touch" ? null : [e.clientX, e.clientY];
}, { passive: true });
function rehover() {
  const el = lastPt && document.elementFromPoint(...lastPt);
  if (!el?.closest?.("#panel, #tree")) return;
  const h = locked(target(el), chosen && forRow(current.panel, chosen));
  if (!same(h, hover)) {
    hover = h;
    show();
  }
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
  // (a variable's own slot that holds none of its data: that variable)
  const base = baseRow(el);
  if (base) return forRow(m, base);
  const cell = el.closest("#panel .b[data-g]");
  if (cell) {
    const p = ownerRow(cell);
    const b = blockOfPointer(p);
    return b !== p ? forRow(m, b) : forBytes(m, cell);
  }
  const addr = el.closest("#panel .wrow[data-slot] .addr");
  if (addr) return forSlot(m, addr.parentElement.dataset.slot);
  const step = el.closest("#ptr li[data-region]");
  if (step) {
    const r = JSON.parse(step.dataset.region);
    return forRegion(m, r, step.dataset.side, r.name);
  }
  const li = el.closest("#tree li[data-path]");
  if (li && el.closest(".row")) {
    return forRow(m, blockOfPointer(li.dataset.path));
  }
  return null;
}

const same = (a, b) => a?.label === b?.label &&
  JSON.stringify(a?.at) === JSON.stringify(b?.at);

function onOver(e) {
  // (over an edge pill, what is lit stays lit: the pill is for it)
  if (e.target.closest?.(".tedge")) return;
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

// What a pointer at `path` targets: with a composite selected, the
// selection's immediate child whose block holds it (its children are
// the blocks); else `path` itself
function blockOfPointer(path) {
  if (!chosen || !path || path === chosen ||
    !(path.startsWith(chosen + ".") || path.startsWith(chosen + "["))) {
    return path;
  }
  const child = /^(\.[^.[]+|\[[^\]]*\])/;
  return chosen + path.slice(chosen.length).match(child)[0];
}

// The variable whose own slot (holding none of its data) a byte or an
// address of the dump is in, if any
function baseRow(el) {
  const at = el.closest?.("#panel .wrow[data-slot] > .addr, " +
    "#panel .wrow[data-slot] .b[data-g]");
  return at ? baseOf(current.panel, at.closest(".wrow").dataset.slot) : null;
}

// What a click (or Enter) on an element does in the storage demo
function act(el, keys = false) {
  // (by keyboard: the row or byte itself, as before)
  const blockOf = keys ? (p) => p : blockOfPointer;
  // a variable's own slot selects the variable, or clears it
  const base = baseRow(el);
  if (base) {
    hover = null;
    return choose(base === chosen ? null : base), true;
  }
  // a row selects its variable, or, when it is the selected one, clears
  const row = el.closest("#tree li[data-path] > .row");
  if (row) {
    const p = blockOf(row.parentElement.dataset.path);
    hover = null;
    return choose(p === chosen ? null : p), true;
  }
  // a slot's address, inside a selected composite: the child whose
  // block holds all of the slot's values
  const addr = !keys && el.closest("#panel .wrow[data-slot] > .addr");
  if (addr && chosen) {
    const ts = new Set([...addr.parentElement.querySelectorAll(
      ".b[data-owners]")].map((c) => blockOf(ownerRow(c))));
    const [t] = ts;
    if (ts.size === 1 && t && t !== chosen) {
      hover = null;
      return choose(t), true;
    }
  }
  // a byte selects its value, or, when it is the selected one's, clears
  const cell = el.closest("#panel .b[data-g]");
  if (cell) {
    hover = null;
    const p = blockOf(ownerRow(cell));
    return choose(p && p === chosen ? null : p, cell), true;
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
  const ed = t.closest(".tedge");
  if (ed) return edgeGo(ed);
  const cv = t.closest("#tree .chev");
  if (cv) return setOpen(cv.parentElement, cv.getAttribute(
    "aria-expanded") !== "true");
  const fb = t.closest("#dpick button[data-focus]");
  if (fb) return setFocus(fb.dataset.focus);
  const chip = t.closest("#chips .chip");
  if (chip) {
    const k = +chip.dataset.k;
    return replay ? stepTo(k) : startReplay(k);
  }
  const r = t.closest("#details button[data-r]");
  if (r) {
    const k = r.dataset.r;
    // (a double click on the entry: its second click lands on a step
    // button; it is ignored)
    if (k !== "start" && e.detail > 1 && performance.now() - started < 600) {
      return;
    }
    if (unfolding) return;
    if (k === "start") startReplay();
    else if (k === "exit") endReplay();
    else if (k === "first") stepTo(0);
    else if (k === "last") stepTo(Infinity);
    else stepTo(replay.i + (k === "next" ? 1 : -1));
    return;
  }
  if (act(t)) return;
  // Empty space clears the selection; controls, text and the panels
  // that explain do not
  // (the bar and the details are one unit: nothing in them clears)
  if (t.closest("#picker, #details, #dwrap, #src, .addr, .tray, a, " +
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
    // (Escape exits a replay; a second one clears the selection)
    if (replay) return endReplay();
    if (chosen && keySection() === "storage") choose(null);
    return;
  }
  // while replaying: ← → Home End step, from anywhere but a text field
  if (replay && !e.target.closest?.("input, textarea, select") &&
    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    e.preventDefault();
    return stepTo({ ArrowLeft: replay.i - 1, ArrowRight: replay.i + 1,
      Home: 0, End: Infinity }[e.key]);
  }
  if (e.key !== "Enter" && e.key !== " ") return;
  const h = e.target.closest?.(".hex.short");
  if (h) {
    e.preventDefault();
    return flip(h);
  }
  if (e.target.closest?.(".chev")) return;
  if (e.target.closest?.("#tree .row, #panel .b[tabindex]") ||
    baseRow(e.target)) {
    e.preventDefault();
    act(e.target, true);
  }
});

// ---------------------------------------------------------------- load

async function decode(f) {
  // mapping keys: from the fixture (gathered from another trace), or
  // from this transaction's KECCAK256 inputs
  const traced = f.keys ? new Map(f.keys) : mappingKeys(f.trace.kept);
  const side = (when) => storageState(async (slot) => {
    const e = f.slots[slot];
    if (!e) throw new Error(`slot ${slot} is not in the fixture`);
    return e[when];
  });
  // or, where the contract lists a mapping's keys (`keysIn`: players'
  // keys are the addresses in roster), from that list, decoded from the
  // same state through its own pointer
  const keysFor = async (when) => {
    if (!f.keysIn) return traced;
    const first = await decodeStorage(f.contract, side(when), new Map());
    const keys = new Map(traced);
    for (const [m, list] of Object.entries(f.keysIn)) {
      const v = f.contract.variables.find((x) => x.identifier === m);
      const items = first.find((n) => n.path === list)?.children ?? [];
      keys.set(baseSlot(v), items.map((n) => ({ key: "0x" +
        n.value.text.slice(2).toLowerCase().padStart(64, "0"), from: list })));
    }
    // (the traced keys must be the same set)
    const same = [...keys].every(([b, ks]) => {
      const t = (traced.get(b) ?? []).map((k) => k.key).sort().join();
      return t === ks.map((k) => k.key).sort().join();
    });
    window.results.keysMatch = [...(window.results.keysMatch ?? []), same];
    return keys;
  };
  const [before, after] = await Promise.all(["before", "after"].map(
    async (w) => decodeStorage(f.contract, side(w), await keysFor(w))));
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
