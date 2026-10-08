// Storage inspection demo: one contract, Arcade, in scenes. Each scene
// shows one point (the state after a transaction) or two to compare
// (before and after one). Loads the scene's fixture, decodes the
// contract's storage (decode.js), and draws it.
import {
  storageState, mappingKeys, decodeStorage, typeName, commit, baseSlot,
  solcTilde,
} from "./decode.js";
import {
  buildPanel, renderPanel, forRow, baseOf, forBytes, forRegion, forSlot,
  paint, regionBytes,
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
// (and a lit row hidden in a collapsed group lights the row that shows
// it: its nearest visible ancestor)
function legend(h) {
  if (!h || !$("tree").querySelector("li.collapsed")) return h;
  const shownAs = (p) => {
    const li = $("tree").querySelector(`li[data-path="${CSS.escape(p)}"]`);
    let v = li;
    for (let a = li?.parentElement.closest("li"); a;
      a = a.parentElement.closest("li")) {
      if (a.classList.contains("collapsed")) v = a;
    }
    return v?.dataset.path ?? p;
  };
  const rows = new Set([...h.rows ?? []].flatMap((p) => [p, shownAs(p)]));
  if (!h.colors) return { ...h, rows };
  const colors = new Map();
  for (const [p, k] of h.colors) {
    const v = shownAs(p);
    colors.set(p, v === p || h.colors.get(v) === k ? k : 0);
  }
  return { ...h, rows, colors };
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
// Each dump's font: the largest at which its row fits the box (CSS,
// .views); a row's width in em, in this font, measured once for each
// layout (32 bytes a line, or 16 on a narrow box)
function fitDumps() {
  for (const d of document.querySelectorAll(".dump")) {
    const row = d.querySelector(".view:not([hidden]) .rows > .wrow");
    if (!row || !d.clientWidth) continue;
    const key = d.clientWidth < 560 ? "--k16" : "--k32";
    if (d.style.getPropertyValue(key)) continue;
    const fs = parseFloat(getComputedStyle(row).fontSize);
    const w = row.querySelector(".word").getBoundingClientRect().right -
      row.getBoundingClientRect().left;
    d.style.setProperty(key, (w / fs).toFixed(4));
  }
}
window.fitDumps = fitDumps;
addEventListener("resize", () => {
  fitDumps();
  if (current) {
    alignColumns();
    show();
  }
});
// (the popovers' labels are fitted in the page's fonts: again once they
// are in)
// (and the dumps' rows measured again, in them)
document.fonts?.ready.then(() => {
  for (const d of document.querySelectorAll(".dump")) {
    d.style.removeProperty("--k32");
    d.style.removeProperty("--k16");
  }
  fitDumps();
  if (current) {
    alignColumns();
    show();
  }
});
document.addEventListener("scroll", (e) => {
  if (e.target.id === "tree") edges();
  if (e.target.id === "ptr") ptrEdges();
}, true);

function render() {
  $("tree").style.paddingTop = "";
  $("tree").scrollTop = 0;
  const { f, scene } = current;
  $("summary").textContent = scene.summary;
  showScene(scene);
  showCalldata(scene.calldata ? f.tx.input : null, scene.calldata);
  fitDumps();
  renderTree();
  $("panel").innerHTML = renderPanel(current.panel);
  fitDumps();
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
// a mapping key, by what its entry holds: the `name` the record keeps
// on chain (as the tree shows it, a string in quotes), in the state
// shown; else the short address. (The fixture's own labels stay
// internal.) `clip`: shortened, within its quotes, for a narrow place.
const keyName = (h, clip) => {
  const k = word(num(h)).slice(-40);
  let text = null;
  const visit = (n) => {
    if (text) return;
    if (n.path.toLowerCase().endsWith(`[0x${k}]`)) {
      const nm = n.children?.find((c) => c.label === "name");
      text = (nm?.[mode] ?? nm?.after ?? nm?.before)?.text ?? null;
      return;
    }
    (n.children ?? []).forEach(visit);
  };
  (current.tree ?? []).forEach(visit);
  // (an empty or missing name: the short address)
  if (!text || text === '""') return short(h);
  return clip && text.length > clip
    ? `${text.slice(0, clip - 2)}…${text.endsWith('"') ? '"' : ""}` : text;
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

// A step's bytes within one slot, drawn as a dump row is: 32 cells in
// four groups of eight, each value a span over its cells, in its colour,
// named; the byte positions under it. `items`: [{ name, region, k }]
// (k: a colour, pk1 …, or 0 for the selection's yellow). One line.
const posOf = (r) => {
  const o = Number(num(r.offset ?? "0x0"));
  const n = r.length !== undefined ? Number(num(r.length)) : 32 - o;
  return [o, Math.min(31, o + n - 1)];
};
function byteStrip(items) {
  // (a name too long for its span stands over it, in a row kept for it,
  // with a tick down to its cells; never cut to a letter)
  const fits = (name, a, b) => name.length <= (b - a + 1) * 2.6;
  const row = (lo, hi) => {
    const col = (i) => i - lo + 1;
    const vs = [];
    const cs = [];
    for (const { name, region, k } of items) {
      let [a, b] = posOf(region);
      if (b < lo || a > hi) continue;
      const out = !fits(name, a, b);
      [a, b] = [Math.max(a, lo), Math.min(b, hi)];
      const at = `grid-column: ${col(a)} / ${col(b) + 1}`;
      vs.push(`<span class="bsv pk${k || 0}" style="${at}">${out ? ""
        : `<span class="bsn">${esc(name)}</span>`}</span>`);
      if (out) {
        const side = a - lo <= 2 ? " lft" : hi - b <= 2 ? " rgt" : "";
        cs.push(`<span class="bsc${side}" style="${at}"><span class=` +
          `"bsl pk${k || 0}">${esc(name)}</span></span>`);
      }
    }
    const idx = [];
    for (let i = lo; i <= hi; i++) {
      idx.push(`<span style="grid-column: ${col(i)}">${i}</span>`);
    }
    return `<span class="bsrow bscall">${cs.join("")}</span>` +
      `<span class="bsrow bsbar">${vs.join("")}</span>` +
      `<span class="bsrow bsidx" ` +
      `aria-hidden="true">${idx.join("")}</span>`;
  };
  const label = items.map(({ name, region }) => {
    const [a, b] = posOf(region);
    return `${name}: ${a === b ? `byte ${a}` : `bytes ${a} to ${b}`}`;
  }).join("; ");
  // (on a wide page one row of 32; on a phone two of 16, as the dump)
  return `<span class="bstrip" role="img" aria-label="${esc(label)}">` +
    `<span class="bs32">${row(0, 31)}</span><span class="bs16">${
      row(0, 15)}${row(16, 31)}</span></span>`;
}

// bytes a–b of a region, or the slots it spans
function bytesText(r) {
  const o = Number(num(r.offset ?? "0x0"));
  const n = r.length !== undefined ? Number(num(r.length)) : 32 - o;
  if (o + n > 32) return `${Math.ceil((o + n) / 32)} slots`;
  return o === 0 && n === 32 ? "the whole slot" : n === 1 ? `byte ${o}`
    : `bytes ${o}–${o + n - 1}`;
}

// The walkthrough of a selection: the rules its pointer follows, one
// step each, in the order of the YAML (the band only moves down), each
// for all of the selection's instances at once (a mapping's entries, an
// array's items). First, the inputs the page supplies (a mapping's
// keys). Every template entered is a step, and the define that leads
// into it; every region read and every branch taken is shown. Built from
// the raw steps decode.js replay() recorded, each with its place in the
// pointer (its block and path of keys), for every value under the
// selection.
function replaySteps(path, side, focus) {
  const node = find(current.tree, path);
  if (!node) return [];
  const { types, pointers } = current.f.contract;
  const variable = path.split(/[.[]/)[0];
  const varNode = find(current.tree, variable);
  const leaves = [];
  const visit = (n) => {
    if (n[side]) leaves.push(n);
    (n.children ?? []).forEach(visit);
  };
  visit(node);
  // (an array's items are counted by its length: an item takes the
  // length's steps too)
  if (types[varNode?.typeId]?.kind === "array" && varNode !== node &&
    varNode[side]) leaves.unshift(varNode);
  if (!leaves.length) return [];
  const w32 = (h) => "0x" + num(h).toString(16).padStart(64, "0");
  const wordAt = (h) => current.f.slots[w32(h)]?.[side];
  const tail = (h) => `…${w32(h).slice(-4)}`;
  const small = (h) => num(h) < 1n << 32n ? String(num(h)) : tail(h);
  const entryPath = (n) => n.path.match(/^[^.[]+\[[^\]]*\]/)?.[0];
  const instOf = (leaf) => entryPath(leaf) ?? leaf.path;
  const nWord = (n) => ["no", "one", "two", "three", "four", "five", "six",
    "seven", "eight"][n] ?? String(n);
  const tn = (id) => types[id] ? typeName(types[id], types) : id;
  // the pointer's object at a node's place
  const getAt = (block, at) => at.reduce((o, k) => o?.[k],
    block ? pointers[block] : null);
  const reads = (block, name) => JSON.stringify(pointers[block] ?? {})
    .includes(`"~read":"${name}"`);
  const hasRead = (e) => JSON.stringify(e ?? null).includes('"~read"');
  const opOf = (e) => e && typeof e === "object" ? Object.keys(e)[0] : null;
  // the keys: from the contract's own list of them (roster, decoded from
  // storage), or the trace
  const keyList = current.f.keysIn ? Object.values(current.f.keysIn)[0] : null;
  const keyItem = (key) => {
    const list = keyList && find(current.tree, keyList);
    const k = w32(key).slice(-40);
    return list?.children?.find((c) => c[side]?.text?.toLowerCase()
      .endsWith(k)) ?? null;
  };
  const addr = (h) => {
    const who = keyName(h);
    return `${esc(short(h))}${who !== short(h) ? ` <span class="gloss">${
      esc(who)}</span>` : ""}`;
  };
  const ec = forRow(current.panel, variable).colors ?? new Map();
  const kOf = (inst) => ec.get(inst) ?? 0;

  // the YAML's lines, for the document order of the nodes
  const { lines } = pointerYaml(variable);
  const lineOf = (block, at) => {
    const p = `${block}|${at.join(".")}`;
    const i = lines.findIndex((l) => l.pos === p || (at.length &&
      l.pos.startsWith(p + ".")));
    return i < 0 ? Infinity : i;
  };

  // the nodes: one per place in the pointer; each with its instances
  let declared = null;
  const nodes = new Map();
  let seen = 0;
  for (const leaf of leaves) {
    const v = leaf[side];
    const inst = instOf(leaf);
    for (const r of rawSteps(v)) {
      if (r.kind === "context") {
        declared ??= { context: r.c, region: v.region };
        continue;
      }
      if (r.kind === "start") {
        declared ??= { slot: r.o.slot, var: r.o.variable };
        continue;
      }
      if (!r.s.at) continue;
      const k = `${r.kind}|${r.s.block}|${r.s.at.join(".")}`;
      if (!nodes.has(k)) {
        nodes.set(k, { k, kind: r.kind, block: r.s.block, at: r.s.at,
          s: r.s, by: new Map(), line: lineOf(r.s.block, r.s.at),
          seen: seen++ });
      }
      const nd = nodes.get(k);
      if (!nd.by.has(inst)) {
        nd.by.set(inst, { inst, s: r.s, leaves: [], regions: [] });
      }
      const x = nd.by.get(inst);
      if (!x.leaves.includes(leaf)) x.leaves.push(leaf);
      if (r.region && !x.regions.some((g) => JSON.stringify(g) ===
        JSON.stringify(r.region))) x.regions.push(r.region);
    }
  }
  const order = [...nodes.values()].sort((a, b) => a.line - b.line ||
    a.seen - b.seen);
  const insts = [...new Set(leaves.map(instOf))].filter((i) =>
    i !== variable || types[varNode?.typeId]?.kind !== "array");
  // each instance's template inputs, by template kind
  const inputs = new Map();
  for (const nd of order.filter((n) => n.kind === "template")) {
    for (const [i, x] of nd.by) {
      inputs.set(`${i}|${types[nd.s.name]?.kind}`, x.s.inputs ?? {});
    }
  }
  const keyOf = (i) => inputs.get(`${i}|mapping`)?.key?.hex;
  const who = (i) => keyOf(i) ? keyName(keyOf(i)) : shortKeys(i);
  const whoShort = (i) => keyOf(i) ? keyName(keyOf(i), 16) : shortKeys(i);
  const isRec = insts.some((i) => keyOf(i));
  const recs = isRec && insts.length > 1
    ? insts.map((i) => ({ path: i, who: whoShort(i), full: who(i) }))
    : null;
  // the focus: one instance at full strength, the others echoing it;
  // or "*", all of them at full strength (by default for a composite
  // with several; one entry or a value in it: that entry)
  const own = insts.includes(entryPath(node) ?? "") ? entryPath(node)
    : insts.includes(node.path) ? node.path : null;
  const every = focus === "*" || (focus === undefined && !own &&
    insts.length > 1);
  const f = insts.includes(focus) ? focus : own ?? insts[0];

  const out = [];
  const step = (x) => {
    const st = { constructs: [], parts: [], rows: [], gutters: [], band: [],
      var: variable, recs, focus: every ? "*" : f, ...x };
    out.push(st);
    return st;
  };
  // a table, one row an instance
  const table = (rows) => `<span class="itab">${rows.map(([a, b, k]) =>
    `<span>${a}</span><span class="prose">→</span><span${k ? ` class="pk${
      k} isw"` : ""}>${b}</span>`).join("")}</span>`;
  const pos = (block, at) => `${block}|${at.join(".")}`;
  const exact = (block, at) => `=${pos(block, at)}`;

  // (1) the inputs: the mapping's keys, and where they come from
  const keyed = insts.filter((i) => keyOf(i));
  if (keyed.length) {
    const items = keyed.map((i) => [i, keyItem(keyOf(i))]);
    const one = keyed.length === 1;
    step({ phase: "input", id: "input",
      cap: one ? `key = the address of ${who(keyed[0])}, from \`${
        items[0][1]?.path ?? "the trace"}\`` : `The keys: the addresses in \`${
        keyList ?? "the trace"}\``,
      form: one ? addr(keyOf(keyed[0])) : table(items.map(([i, it]) =>
        [addr(keyOf(i)), esc(it?.label ?? "trace"), kOf(i)])),
      source: keyList ? `the page reads ${keyList} from storage`
        : "the page reads the keys from the trace", sourceTint: !!keyList,
      chip: one ? "key" : "keys", chipLabel: keyList ?? "trace",
      parts: [{ regions: items.filter(([, it]) => it).map(([, it]) =>
        it[side].region), rows: items.filter(([, it]) => it).map(([, it]) =>
        it.path), colors: new Map(items.map(([i, it]) => [it?.path, kOf(i)])) }],
      rows: items.map(([, it]) => it?.path).filter(Boolean) });
  }

  // (2) declared
  if (declared) {
    const kind = types[varNode?.typeId]?.kind ?? "value";
    if (declared.context) {
      const c = declared.context;
      step({ phase: "declared", id: `declared|${variable}`,
        cap: `\`${variable}\` is at slot ${small(c.slot)}, ${c.length} bytes ` +
          `from offset ${c.offset}`,
        form: byteStrip([{ name: variable, region: declared.region,
          k: 0 }]),
        constructs: ["pointer"], source: "ethdebug data from the compiler",
        chip: `slot ${small(c.slot)}`, chipLabel: "value",
        parts: [{ regions: [declared.region], rows: [variable] }],
        rows: [variable] });
    } else {
      const w = wordAt(declared.slot);
      step({ phase: "declared", id: `declared|${variable}`,
        cap: kind === "mapping" && w !== undefined && !num(w)
          ? `\`${variable}\` is declared at slot ${small(declared.slot)}; ` +
            "that slot holds nothing"
          : `\`${variable}\` is declared at slot ${small(declared.slot)}`,
        form: esc(`slot ${small(declared.slot)}`),
        constructs: ["pointer"], source: "ethdebug data from the compiler",
        chip: `slot ${small(declared.slot)}`, chipLabel: ["mapping", "string",
          "array", "struct"].includes(kind) ? kind === "struct" ? "record"
          : kind : "value",
        gutters: [w32(declared.slot)], parts: [{ rows: [variable] }],
        rows: [variable] });
    }
  }

  // (3) the pointer's nodes, in document order
  let openIf = null; // an `if` step and its branches' places
  let pending = []; // defines and lists folded into the next region
  const inBranch = (nd) => openIf && openIf.branches.some((b) =>
    nd.block === openIf.block && b.every((k, j) => nd.at[j] === k));
  const defineBand = (nd) => [exact(nd.block, nd.at.slice(0, -1)),
    pos(nd.block, nd.at)];
  const instRows = (nd) => [...nd.by.values()].flatMap((x) =>
    x.leaves.map((l) => l.path));
  const regionsOf = (nd) => [...nd.by.values()].flatMap((x) => x.regions);
  const fieldColours = () => {
    const used = new Set(ec.values());
    const free = [...Array(PICKS).keys()].slice(1).filter((k) => !used.has(k));
    const fc = forRow(current.panel, f).colors ?? new Map();
    return (leafPath) => {
      const name = leafPath.slice(instOf({ path: leafPath }).length);
      const k = fc.get(`${f}${name}`);
      return k ? free[(k - 1) % free.length] : 0;
    };
  };
  for (const nd of order) {
    if (openIf && !inBranch(nd)) openIf = null;
    const xs = [...nd.by.values()];
    if (nd.kind === "template") {
      const t = types[nd.s.name];
      const ks = nd.s.expect ?? [];
      const vals = (k) => [...new Set(xs.map((x) => x.s.inputs?.[k]?.hex))];
      const what = (k) => {
        const vs = vals(k);
        if (vs.length === 1 && vs[0] !== undefined) {
          return k === "key" ? `key = the address of ${who(xs[0].inst)}`
            : `${k} = ${small(vs[0])}`;
        }
        return k === "key" ? `key = each address in \`${keyList ?? "the trace"
          }\`` : `${k} = each ${t?.kind === "struct" ? "record's slot"
          : t?.kind === "string" ? "name slot" : k}`;
      };
      // (one row an instance, where their inputs differ)
      const many = new Set(xs.map((x) => JSON.stringify(x.s.inputs))).size >
        1;
      const rowsT = insts.filter((i) => i !== variable);
      step({ phase: "template", tkind: t?.kind, id: nd.k,
        cap: `The template \`${tn(nd.s.name)}\` takes ${ks.map(what)
          .join(", ")}`,
        form: many ? table(xs.map((x) => [esc(who(x.inst)), esc(ks.map((k) =>
          `${k} ${k === "key" ? short(x.s.inputs[k].hex) : small(
            x.s.inputs[k].hex)}`).join(", ")), kOf(x.inst)]))
          : esc(ks.map((k) => `${k} = ${k === "key" ? short(xs[0].s.inputs[k]
            .hex) : small(xs[0].s.inputs[k].hex)}`).join(", ")),
        constructs: ["template"], source: "ethdebug data from the compiler",
        chip: tn(nd.s.name), chipLabel: "template",
        gutters: [...new Set(xs.map((x) => x.s.inputs?.slot?.hex)
          .filter(Boolean).map(w32))],
        parts: [{ rows: rowsT.length ? rowsT : [variable], colors: ec }],
        rows: rowsT.length ? rowsT : [variable],
        band: [`=${nd.s.name}|`, exact(nd.s.name, ["expect"]),
          exact(nd.s.name, ["for"])] });
      continue;
    }
    if (nd.kind === "define") {
      const into = getAt(nd.block, [...nd.at.slice(0, -2), "in"]);
      if (into && typeof into === "object" && "template" in into) {
        // the hand-off into a nested template
        const t = types[into.template];
        const op = opOf(nd.s.expr);
        const formula = (x) => {
          const v = x.s.value.hex;
          if (op === "~keccak256" && x.s.args?.length === 2) {
            const [a, b] = x.s.args.map((y) => y.value.hex);
            return `keccak(${short(a)}, ${small(b)}) = ${tail(v)}`;
          }
          if (op === "~sum") {
            const base = inputs.get(`${x.inst}|${types[nd.block]?.kind}`)
              ?.slot?.hex;
            const d = base ? num(v) - num(base) : null;
            return base ? `${tail(base)} + ${d} = ${tail(v)}` : tail(v);
          }
          return `${nd.s.id} = ${small(v)}`;
        };
        const leafOf = (x) => x.leaves.find((l) => l.path !== x.inst) ??
          x.leaves[0];
        const fname = (x) => leafOf(x).path.slice(x.inst.length)
          .replace(/^\./, "") || leafOf(x).label;
        const many = xs.length > 1;
        const isRecord = t?.kind === "struct";
        step({ phase: "handoff", tkind: t?.kind, id: nd.k,
          cap: isRecord ? many ? `Each record is at keccak(key, ${small(
            xs[0].s.args?.[1]?.value.hex ?? "0x0")})` : `The record is at ${
            formula(xs[0])}`
            : `The ${isRecord ? "record" : "next"} slot holds \`${fname(xs[0])
            }\`, a ${tn(into.template)}${many ? "" : `: ${formula(xs[0])}`}`,
          form: many ? table(xs.map((x) => [esc(who(x.inst)), esc(formula(x)),
            kOf(x.inst)])) : esc(formula(xs[0])),
          constructs: ["define", ...(op ? [op] : [])],
          source: "ethdebug data from the compiler",
          chip: isRecord ? `keccak(key, ${small(xs[0].s.args?.[1]?.value.hex ??
            "0x0")})` : fname(xs[0]), chipLabel: isRecord ? "record"
            : tn(into.template),
          gutters: xs.map((x) => w32(x.s.value.hex)),
          parts: [{ rows: isRecord ? xs.map((x) => x.inst)
            : xs.map((x) => leafOf(x).path), colors: ec }],
          rows: isRecord ? xs.map((x) => x.inst) : xs.map((x) =>
            leafOf(x).path),
          band: [...defineBand(nd), pos(nd.block, [...nd.at.slice(0, -2),
            "in"])] });
        continue;
      }
      if (openIf && hasRead(nd.s.expr) && inBranch(nd)) {
        openIf.absorbed.push(nd);
        openIf.st.band.push(...defineBand(nd));
        continue;
      }
      pending.push(nd);
      continue;
    }
    if (nd.kind === "list") {
      pending.push(nd);
      continue;
    }
    if (nd.kind === "if") {
      const P = nd.at.slice(0, -1);
      const branches = [...new Set(xs.map((x) => x.s.branch))];
      openIf = { block: nd.block, branches: branches.map((b) => [...P, b]),
        absorbed: [], nd };
      openIf.st = step({ phase: "if", node: nd, xs, id: nd.k,
        constructs: ["if"], source: "read from storage",
        chip: branches.length > 1 ? "short | long" : branches[0] === "then"
          ? "short" : "long", chipLabel: "branch",
        band: [pos(nd.block, nd.at), ...branches.map((b) =>
          exact(nd.block, [...P, b]))] });
      continue;
    }
    // a region
    const name = nd.s.name;
    const read = reads(nd.block, name);
    if (read && openIf && inBranch(nd)) {
      openIf.absorbed.push(nd);
      openIf.st.band.push(pos(nd.block, nd.at));
      // (and the branch's group line)
      const g = nd.at.slice(0, -2);
      if (g.at(-1) !== undefined) openIf.st.band.push(exact(nd.block, g));
      continue;
    }
    if (read) {
      const vals = xs.map((x) => [x, x.regions[0]]);
      const byte = (g) => {
        const wv = wordAt(g.slot) ?? "0x0";
        if (name === "length-flag") return `0x${w32(wv).slice(-2)}`;
        return String(num(wv));
      };
      const many = xs.length > 1;
      const lbl = name === "length-flag" ? "The last byte is the length flag"
        : name === "length" ? `slot ${small(vals[0][1].slot)} holds the length`
          : `\`${name}\` is read`;
      step({ phase: "read", rname: name, id: nd.k,
        cap: many ? `${name === "length-flag" ? "The last byte of each name " +
          "slot is its length flag" : lbl}` : `${lbl}${name === "length-flag"
          ? ", " : ": "}${byte(vals[0][1])}`,
        form: many ? table(vals.map(([x, g]) => [esc(who(x.inst)), esc(byte(g)),
          kOf(x.inst)])) : byteStrip([{ name: `${name} = ${byte(
            vals[0][1])}`, region: vals[0][1], k: kOf(vals[0][0].inst) }]),
        constructs: ["region"], source: "read from storage",
        chip: name === "length-flag" ? "flag" : name, chipLabel: name ===
          "length" ? "array" : "string",
        parts: [{ regions: regionsOf(nd), rows: [...new Set(instRows(nd))],
          colors: ec }],
        rows: [...new Set(instRows(nd))], band: [pos(nd.block, nd.at)] });
      continue;
    }
    // a value's own region: a field, a string's data, a list's item
    const prev = out.at(-1);
    const parent = nd.at.slice(0, -1).join(".");
    const folded = pending;
    pending = [];
    const band = [pos(nd.block, nd.at), ...folded.flatMap((p) =>
      p.kind === "define" ? defineBand(p) : [pos(p.block, p.at)])];
    if (name === "item" || folded.some((p) => p.kind === "list")) {
      const data = folded.find((p) => p.kind === "define");
      const base = data ? [...data.by.values()][0].s.args?.[0]?.value.hex
        ?? declared?.slot : declared?.slot;
      const start = data ? [...data.by.values()][0].s.value.hex : null;
      const idx = order.find((n) => n.kind === "list");
      const is = idx ? [...idx.by.values()].map((x) => +x.s.index)
        .sort((a, b) => a - b) : [];
      const one = is.length === 1;
      step({ phase: "item", id: nd.k,
        cap: one ? `The items start at keccak(${small(base)})`
          : `The items start at keccak(${small(base)}), one slot each, for ` +
            "`length` items",
        form: esc(`keccak256(${small(base)}) = ${start ? tail(start) : "?"}${
          one ? `; item ${is[0]} at + ${is[0]}` : `; items ${is[0]}…${is.at(-1)
          } at + i`}`),
        constructs: ["~keccak256", "list"], source: "ethdebug data from the compiler",
        chip: `keccak(${small(base)})`, chipLabel: "items",
        parts: [{ regions: regionsOf(nd), rows: instRows(nd), colors: ec }],
        rows: instRows(nd), band });
      continue;
    }
    if (name === "data" || name?.endsWith("-data")) {
      const ifn = order.find((n) => n.kind === "if");
      const long = !!ifn && xs.every((x) => ifn.by.get(x.inst)?.s.branch ===
        "else");
      const lenOf = (x) => num(x.regions[0]?.length ?? "0x0");
      const many = xs.length > 1;
      const slots = (x) => Math.ceil(Number(lenOf(x)) / 32);
      const one = xs[0];
      step({ phase: "data", long, id: nd.k,
        cap: many ? long ? "Each long text starts at keccak(its slot)"
          : "Each short text is in its slot, from the left"
          : long ? `The text starts at keccak(${tail(folded.length
            ? [...folded[0].by.values()][0].s.args?.[0]?.value.hex ??
            one.regions[0].slot : one.regions[0].slot)}) = ${tail(
            one.regions[0].slot)}, ${lenOf(one)} bytes over ${slots(one)} ${
            slots(one) === 1 ? "slot" : "slots"}`
            : `The text is in the slot itself: ${lenOf(one)} bytes from ` +
              "the left",
        form: many ? table(xs.map((x) => [esc(who(x.inst)), esc(`${lenOf(x)
          } bytes at ${tail(x.regions[0].slot)}`), kOf(x.inst)]))
          : esc(xs[0].leaves.at(-1)[side].text),
        constructs: long ? ["~keccak256", "region"] : ["region"],
        source: "ethdebug data from the compiler", chip: long ? "keccak(slot)" : "inline",
        chipLabel: "text",
        parts: [{ regions: regionsOf(nd), rows: [...new Set(instRows(nd))],
          colors: ec }],
        rows: [...new Set(instRows(nd))], band });
      continue;
    }
    // fields: the siblings in one group, one step
    if (prev?.phase === "fields" && prev.parent === `${nd.block}|${parent}` &&
      !folded.length) {
      prev.nodes.push(nd);
      prev.band.push(...band);
      continue;
    }
    step({ phase: "fields", parent: `${nd.block}|${parent}`, nodes: [nd],
      id: `fields|${nd.block}|${parent}`,
      band, constructs: ["region"], source: "ethdebug data from the compiler",
      chipLabel: "fields" });
  }

  // the fields steps, now that their nodes are known
  for (const st of out.filter((x) => x.phase === "fields")) {
    const kc = fieldColours();
    const all = st.nodes.flatMap((nd) => [...nd.by.values()].map((x) =>
      ({ x, nd, leaf: x.leaves.find((l) => l[side]?.region?.name ===
        nd.s.name) ?? x.leaves[0], region: x.regions[0] })));
    const mine = all.filter((y) => y.x.inst === f);
    const items = [...mine].sort((a, b) => Number(num(a.region.offset ??
      "0x0") - num(b.region.offset ?? "0x0")));
    const n = st.nodes.length;
    const nm = (y) => y.leaf.path.slice(y.x.inst.length).replace(/^\./, "")
      || y.leaf.label;
    Object.assign(st, {
      cap: n > 1 ? `The first slot packs ${nWord(n)} fields, from ` +
        "the right"
        : `\`${nm(items[0])}\` is ${bytesText(items[0].region)} of the ` +
          "record's first slot",
      form: byteStrip(items.map((y) => ({ name: nm(y), region: y.region,
        k: kc(y.leaf.path) }))),
      chip: n > 1 ? `${n} fields` : nm(items[0]), chipLabel: n > 1 ? "fields"
        : "field",
      names: st.nodes.map((nd) => nd.s.name),
      ruler: items[0]?.region.slot,
      parts: all.map((y) => ({ regions: [y.region], rows: [y.leaf.path],
        colors: new Map([[y.leaf.path, kc(y.leaf.path)]]),
        dim: !every && y.x.inst !== f })),
      rows: (every ? all : mine).map((y) => y.leaf.path) });
  }

  // the `if` steps, now that what they took in is known
  for (const st of out.filter((x) => x.phase === "if")) ifStep(st);
  function ifStep(st) {
    const branchOf = new Map(st.xs.map((x) => [x.inst, x.s.branch]));
    const flag = (i) => {
      const r = order.find((n) => n.kind === "region" && n.s.name ===
        "length-flag")?.by.get(i)?.regions[0];
      return r ? w32(wordAt(r.slot) ?? "0x0") : null;
    };
    const lens = (i) => {
      const w = flag(i);
      if (!w) return null;
      return branchOf.get(i) === "then" ? num("0x" + w.slice(-2)) / 2n
        : (num(w) - 1n) / 2n;
    };
    const shorts = st.xs.filter((x) => x.s.branch === "then");
    const longs = st.xs.filter((x) => x.s.branch === "else");
    // what it lights: the regions it took in, else the flag it reads
    const regs = (i) => {
      const own = order.filter((n) => n.kind === "region" &&
        reads(n.block, n.s.name) && n.by.has(i) && n.line > st.node.line &&
        st.band.includes(pos(n.block, n.at)))
        .flatMap((n) => n.by.get(i).regions);
      if (own.length) return own;
      const fr = order.find((n) => n.kind === "region" && n.s.name ===
        "length-flag")?.by.get(i)?.regions ?? [];
      return fr;
    };
    const rowsOf = (i) => st.xs.find((x) => x.inst === i).leaves.map((l) =>
      l.path);
    const ex = (list) => list.find((x) => x.inst === f) ?? list[0];
    const many = st.xs.length > 1;
    const line = (x) => x.s.branch === "then"
      ? `even: 0x${flag(x.inst)?.slice(-2)} → ${lens(x.inst)} bytes inline`
      : `odd: 0x${flag(x.inst)?.slice(-2)} → ${lens(x.inst)} bytes at ` +
        `keccak(${tail(regs(x.inst)[0]?.slot ?? "0x0")})`;
    const names = (list) => list.map((x) => whoShort(x.inst)).join(", ");
    const fork = shorts.length && longs.length;
    Object.assign(st, {
      cap: fork ? `The last byte decides the form: even → short (${names(
        shorts)}), odd → long (${names(longs)})`
        : !flag(st.xs[0].inst) ? `The condition takes \`${st.xs[0].s.branch}\``
          : longs.length ? many ? "Odd → long: each slot holds 2 × length + 1"
            : "Odd → long: the slot holds 2 × length + 1, so length = " +
              `${lens(longs[0].inst)}`
            : many ? "Even → short: the last byte holds 2 × length"
              : "Even → short: the last byte holds 2 × length, so length = " +
                `${lens(shorts[0].inst)}`,
      form: fork ? [ex(shorts), ex(longs)].map((x) => `${esc(line(x))} ` +
        `<span class="prose">(${esc(who(x.inst))})</span>`).join("<br>")
        : many ? table(st.xs.map((x) => [esc(who(x.inst)), esc(line(x)),
          kOf(x.inst)])) : esc(line(st.xs[0])),
      parts: [{ regions: st.xs.flatMap((x) => regs(x.inst)),
        rows: st.xs.flatMap((x) => rowsOf(x.inst)), colors: ec }],
      rows: st.xs.flatMap((x) => rowsOf(x.inst)) });
    delete st.node;
    delete st.xs;
  }
  for (const st of out) {
    delete st.nodes;
    delete st.parent;
  }
  // step 0, the goal: when the selection takes more than one slot or
  // region, every slot the walkthrough touches (but its inputs'), whole,
  // in the selection's yellow, with no label: which bytes are what is
  // what the steps find
  const slots = new Set();
  const regions = new Set();
  for (const st of out.filter((x) => x.phase !== "input")) {
    for (const p of st.parts ?? []) {
      for (const r of p.regions ?? []) {
        regions.add(JSON.stringify(r));
        for (const [sl] of regionBytes(r)) slots.add(sl);
      }
      for (const sl of p.slots ?? []) slots.add(sl);
    }
    for (const sl of st.gutters ?? []) slots.add(sl);
  }
  // (the selection's own: its values' regions, and the slots they take)
  const ownR = new Set();
  const ownS = new Set();
  for (const l of leaves.filter((x) => x.path === path ||
    x.path.startsWith(path + ".") || x.path.startsWith(path + "["))) {
    const v = l[side];
    for (const r of [v.region, ...(v.parts ?? []).map((q) => q.region)]) {
      if (!r) continue;
      ownR.add(JSON.stringify(r));
      for (const [sl] of regionBytes(r)) ownS.add(sl);
    }
  }
  if (ownS.size > 1 || ownR.size > 1) {
    const all = [...slots].sort((a, b) => (num(a) < num(b) ? -1 : 1));
    const apart = all.some((sl, i) => i && num(sl) - num(all[i - 1]) > 1n);
    out.goal = { phase: "goal", id: "goal", constructs: [], band: [],
      cap: `${all.length === 1 ? "This slot holds" : `These ${all.length
        } slots hold`} \`${shortKeys(path)}\`${apart
        ? ", scattered across storage" : ""}.` +
        "", form: '<span class="prose rq">How do we find them, and what ' +
        "do they mean?</span>", source: "",
      chip: "", chipLabel: "", bare: true, rows: [path],
      parts: [{ regions: all.map((sl) => ({ location: "storage", slot: sl,
        offset: "0x0", length: "0x20" })), rows: [path] }] };
  }
  // the last step, "found": the selection as it rests, its colours and
  // labels (stepLight); the bookend to step 0 (FOUND: off removes it)
  if (FOUND && out.length) {
    const t = types[node.typeId];
    const n = node.children?.length ?? 0;
    const vt = t?.kind === "mapping" ? types[t.contains?.value?.type?.id]
      : null;
    const what = t?.kind === "mapping" ? `${n} ${vt?.kind === "struct"
      ? n === 1 ? "record" : "records" : n === 1 ? "entry" : "entries"}`
      : t?.kind === "struct" ? `${n} ${n === 1 ? "field" : "fields"}`
        : t?.kind === "array" ? `${n} ${n === 1 ? "item" : "items"}`
          : node[side]?.text ?? "";
    out.push({ phase: "found", id: "found", constructs: [], band: [],
      parts: null, rows: [path], gutters: [],
      cap: `That's \`${shortKeys(path)}\`${what ? `: ${what}` : ""}, found.`,
      form: "", source: "", chip: "found", chipLabel: shortKeys(path) });
  }
  return out;
}
// (the walkthrough's last step, "found": one switch, to try it)
const FOUND = true;

// The spec pages, one per pointer construct (ethdebug/format)
const SPEC = "https://ethdebug.github.io/format/spec/pointer/";
const FOOT = {
  pointer: ["A pointer is a region or a collection of pointers",
    `${SPEC}concepts/#a-pointer-is-a-region-or-a-collection-of-other-pointers`],
  "~keccak256": ["Expressions: keccak256",
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
// templates it uses, as YAML, as the compiler wrote them (the template names
// shortened to their types' names). One line each, nothing wraps: leaf
// regions and expressions in flow style. Each line keeps tags for what
// it is part of, so a step can light the lines it uses.
const isExpr = (v) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length === 1 && Object.keys(v)[0].startsWith("~");
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
  // (each line keeps where it is: its block, "" for the variable's own
  // pointer or a template's id, and its path of keys, as decode.js
  // replay() records a node's place)
  let blk = "";
  const put = (d, text, tags, pos = "") => lines.push({ text: "  ".repeat(d) +
    text, tags, pos: `${blk}|${pos}` });
  const sub = (pos, k) => pos === "" ? String(k) : `${pos}.${k}`;
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
  const block = (o, d, tags, pos = "") => {
    for (const [k, x] of ordered(o)) {
      const at = sub(pos, k);
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
        put(d, `${k}:`, [...tags, ...own], at);
        put(d + 1, `${op}:`, [...tags, ...own], at);
        for (const y of [].concat(x[op])) {
          put(d + 2, `- ${flowOf(y, short)}`, [...tags, ...own], at);
        }
        continue;
      }
      if (typeof x !== "object" || isExpr(x) ||
        ((isRegion(x) || allScalar(x)) && flowFits(k, x, d)) ||
        (Array.isArray(x) && x.every((y) => typeof y !== "object"))) {
        put(d, `${k}: ${flowOf(x, short, k === "template")}`,
          [...tags, ...own, ...(isRegion(x) ? [`region:${x.name}`] : [])], at);
      } else if (Array.isArray(x)) {
        put(d, `${k}:`, [...tags, ...own], at);
        x.forEach((y, n) => item(y, d + 1, [...tags, ...own], sub(at, n)));
      } else {
        const branch = k === "then" || k === "else" ? [k] : [];
        // (a template's `for:` line: part of its frame, with its name and
        // `expect`)
        put(d, `${k}:`, [...tags, ...own, ...branch,
          ...(k === "for" ? ["for"] : [])], at);
        block(x, d + 1, [...tags, ...own, ...branch], at);
      }
    }
  };
  // a list item
  const item = (y, d, tags, pos) => {
    if (isRegion(y) && `${"  ".repeat(d)}- ${flowOf(y, short)}`.length <=
      WIDE) {
      put(d, `- ${flowOf(y, short)}`, [...tags, `region:${y.name}`], pos);
      return;
    }
    const at = lines.length;
    block(isRegion(y) ? Object.fromEntries(entriesOf(y)) : y, d + 1,
      [...tags, "item", ...(isRegion(y) ? [`region:${y.name}`] : [])], pos);
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
    blk = n;
    put(0, "", [], "-");
    put(0, `${short(n)}:`, [`t:${kind}`, "head"]);
    block(pointers[n], 1, [`t:${kind}`]);
  }
  return { lines, names };
}

// The lines a step uses: the part of the pointer it evaluates
function activeLines(lines, st) {
  // (a step's band: places in the pointer; "=" for that line alone, else
  // the line and everything under it)
  if (st.band?.length) {
    const on = (l) => st.band.some((p) => p.startsWith("=")
      ? l.pos === p.slice(1) : l.pos === p || l.pos.startsWith(p + "."));
    return lines.map((l, i) => on(l) ? i : -1).filter((i) => i >= 0);
  }
  const has = (l, ...ts) => ts.every((t) => l.tags.includes(t));
  const pick = (f) => lines.map((l, i) => f(l) ? i : -1).filter((i) => i >= 0);
  switch (st.phase) {
    case "declared": return pick((l) => has(l, "var"));
    case "entries": return pick((l) => has(l, "t:mapping") &&
      l.tags.some((t) => t.startsWith("define:")) && !has(l, "item"));
    case "template": return pick((l) => has(l, `t:${st.tkind}`) &&
      (has(l, "head") || has(l, "expect") || has(l, "for")));
    case "length": return pick((l) => has(l, "t:array") &&
      has(l, "region:length"));
    case "item": return pick((l) => has(l, "t:array") && has(l, "item") &&
      !has(l, "region:length"));
    // (the record: the whole struct template, its group of members)
    case "record": return pick((l) => has(l, "t:struct") &&
      !has(l, "head") && !has(l, "expect") && !has(l, "for"));
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
  // (found: exactly the selection's resting view)
  if (st.phase === "found") {
    return forRow(current.panel, replay.path, { roots: true });
  }
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
  if (st.bare) h.bare = true;
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
    case "goal": return "what we're about to find";
    case "found": return "found";
    case "input": return st.chip === "key" ? "the key" : "the keys";
    case "handoff": return st.tkind === "struct" ? "the record's slot"
      : "into a template";
    case "read": return st.rname === "length" ? "the length" : "a flag";
    case "if": return "a branch";
    case "data": return "the text";
    case "template": return "a template's inputs";
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
    const st = curStep();
    const last = i === steps.length - 1;
    const lo = i === firstStep();
    // ⏮ ◀ ▶ ⏭, each disabled at its end (no wrap; none of them exits)
    const b = (r, label, glyph, off) => `<button type="button" class="btn"` +
      ` data-r="${r}" aria-label="${label}"${off ? " disabled" : ""}>${
        glyph}</button>`;
    ctl = b("first", "First step", "⏮", lo) + b("prev", "Previous step",
      "◀", lo) + b("next", "Next step", "▶", last) + b("last", "Last step",
      "⏭", last);
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
  bar.innerHTML = `<span class="rmode">${replay ? "Walkthrough" : ""}</span>` +
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
    ? [footOf(curStep())].filter(Boolean).map(fnote).join(" ")
    : `<span class="muted">Each step is one part of the ethdebug data ` +
      `from the compiler for ${esc(chosen.split(/[.[]/)[0])}.</span>`}</p>`;
  // the focus entry, in a mapping's replay: which one the layout steps
  // show at full strength (the others echo it, muted)
  const rec = replay && steps.find((x) => x.recs);
  const hadPick = document.activeElement?.closest?.("#dpick")
    ? document.activeElement.dataset.focus : null;
  $("dpick").innerHTML = rec ? `<span class="plab">Focus</span>${
    [{ path: "*", who: "all" }, ...rec.recs].map((r) => `<button ` +
      `type="button" class="btn" data-focus="${esc(r.path)}" aria-pressed="${
        r.path === replay.focus}" aria-label="Focus: ${esc(r.full ?? r.who)
      }">${esc(r.who)}</button>`).join("")}` : "";
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
  const lit = replay ? new Set(activeLines(lines, curStep())) : null;
  const fc = replay && footOf(curStep());
  const ids = Object.entries(names).map(([id, n]) => `${n} = ${id}`);
  void fc;
  $("ptr").classList.toggle("lit", !!lit?.size);
  $("ptr").classList.toggle("goal", !!replay && replay.i < 0);
  if (replay && replay.i < 0) $("ptr").scrollTop = 0;
  $("pgo").hidden = !(replay && replay.i < 0);
  bar.querySelector('button[data-r="next"]')?.classList.toggle("halo",
    !!replay && replay.i < 0);
  requestAnimationFrame(goGlyph);
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
  requestAnimationFrame(ptrEdges);
  if (box.classList.contains("goal")) return;
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
// the step shown (-1: the goal, step 0, where there is one), and the
// first index the walkthrough has
const curStep = () => replay.i < 0 ? replay.goal : replay.steps[replay.i];
const firstStep = () => replay.goal ? -1 : 0;
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
// Re-target the walkthrough to another selection, keeping the place:
// the steps are aligned by their identity (the pointer node and kind,
// whatever the instance), longest common subsequence; the step shown
// stays on its match, or the nearest earlier step that has one, or the
// first. A cue in the bar says when the place moved.
function retarget(path) {
  const steps = replaySteps(path, replay.side);
  if (!steps.length) return false;
  // (the goal, step 0, is a step with its own identity)
  const oa = replay.goal ? 1 : 0;
  const ob = steps.goal ? 1 : 0;
  const a = [...(oa ? ["goal"] : []), ...replay.steps.map((x) => x.id)];
  const b = [...(ob ? ["goal"] : []), ...steps.map((x) => x.id)];
  const L = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1
        : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const match = new Map();
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) match.set(i++, j++);
    else if (L[i + 1][j] >= L[i][j + 1]) i++;
    else j++;
  }
  const at = replay.i + oa;
  let k = ob;
  for (let i = at; i >= 0; i--) {
    if (match.has(i)) {
      k = match.get(i);
      break;
    }
  }
  // (the step number shown: its index + 1; the goal's is 0)
  const moved = k - ob !== replay.i;
  replay = { path, side: replay.side, steps, goal: steps.goal, i: k - ob,
    focus: steps.find((x) => x.recs)?.focus };
  renderBox();
  show();
  if (moved) cue(`→ step ${k - ob + 1}`);
  return true;
}
// a short note in the bar, over it (it takes no room), fading out
function cue(text) {
  const bar = $("details");
  bar.querySelector(".rcue")?.remove();
  const c = document.createElement("span");
  c.className = "rcue";
  c.setAttribute("aria-live", "polite");
  c.textContent = text;
  bar.append(c);
  setTimeout(() => c.classList.add("gone"), still() ? 1200 : 1400);
  setTimeout(() => c.remove(), 1800);
}
function stepTo(i) {
  if (!replay || unfolding) return;
  const k = Math.max(firstStep(), Math.min(replay.steps.length - 1, i));
  if (k === replay.i) return;
  replay.i = k;
  renderBox();
  show();
  treeTo(curStep().rows?.[0]);
}
function startReplay(at) {
  if (!chosen) return;
  const steps = replaySteps(chosen, mode);
  if (!steps.length) return;
  replay = { path: chosen, side: mode, steps, goal: steps.goal,
    i: at ?? (steps.goal ? -1 : 0),
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
  const sel = chosen ? forRow(current.panel, chosen, { roots: true })
    : null;
  // a replay shows its step, whatever the pointer is on
  const h = legend(replay ? stepLight(curStep())
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

// Lit tree rows out of the tree box's view (it scrolls inside itself):
// a yellow circle button, centred on the box's edge past which they
// are, with an arrow; no text (its label, for screen readers, gives the
// first row's path and how many more). A click scrolls the tree, inside itself, to the first of them.
// Hover alone never scrolls the tree.
const ARROW = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${
  d}" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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
    const btn = $(`edge-${way}`);
    const on = !!list.length;
    btn.classList.toggle("on", on);
    btn.setAttribute("aria-hidden", String(!on));
    // (in the Tab order for the selection's rows only)
    btn.tabIndex = on && chosen && !hover ? 0 : -1;
    if (!on) continue;
    const path = list[0].parentElement.dataset.path;
    btn.dataset.path = path;
    btn.innerHTML = ARROW(way === "up" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4");
    btn.setAttribute("aria-label", `Scroll the variables ${way} to ${
      path}${list.length > 1 ? `, and ${list.length - 1} more lit rows` : ""}`);
  }
}
// At step 0: the sentence over the blurred pointer ends with an arrow
// glyph pointing toward ▶ (up and right, or up and left)
function goGlyph() {
  const label = $("pgo");
  const g = label.querySelector(".pglyph");
  const next = $("details").querySelector('button[data-r="next"]');
  if (label.hidden || !g || !next) return;
  const gr = g.getBoundingClientRect();
  const n = next.getBoundingClientRect();
  g.textContent = n.left + n.width / 2 >= gr.left - 4 ? "⤴" : "↖";
}
addEventListener("resize", () => requestAnimationFrame(goGlyph));

// The pointer's box scrolls inside itself, with no scrollbar shown: a
// circle button on its top or bottom edge where there is more; it
// scrolls toward the step's band, when that is out of view that way,
// else by about a box's height
function ptrEdges() {
  const box = $("ptr");
  const on = box.querySelector(".line.on");
  const b = box.getBoundingClientRect();
  const r = on?.getBoundingClientRect();
  const more = { up: box.scrollTop > 1, down: box.scrollTop +
    box.clientHeight < box.scrollHeight - 1 };
  for (const way of ["up", "down"]) {
    const btn = $(`pedge-${way}`);
    const show = more[way] && !$("dpanel").hidden &&
      !box.classList.contains("goal");
    btn.parentElement.classList.toggle("on", show);
    btn.parentElement.setAttribute("aria-hidden", String(!show));
    btn.tabIndex = show ? 0 : -1;
    const band = r && (way === "up" ? r.bottom <= b.top + 1
      : r.top >= b.bottom - 1);
    btn.dataset.band = band ? "1" : "";
    const icon = ARROW(way === "up" ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4");
    const text = `${band ? "current step" : "more"} ${way === "up" ? "above"
      : "below"}`;
    btn.innerHTML = way === "up" ? `${icon}<span>${text}</span>`
      : `<span>${text}</span>${icon}`;
    btn.setAttribute("aria-label", band ? `Scroll the pointer ${way} to ` +
      "the step's lines" : `Scroll the pointer ${way}`);
    box.classList.toggle(`more-${way}`, show);
  }
}
function ptrGo(btn) {
  const box = $("ptr");
  const on = box.querySelector(".line.on");
  const up = btn.id === "pedge-up";
  const top = btn.dataset.band && on ? on.offsetTop - box.clientHeight / 3
    : box.scrollTop + (up ? -1 : 1) * box.clientHeight * 0.85;
  box.scrollTo({ top: Math.max(0, top), behavior: still() ? "auto"
    : "smooth" });
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
  // during a walkthrough, a new selection re-targets it (only Exit or
  // Escape leave it)
  const was = chosen;
  if (replay && path && path !== replay.path && (chosen = path,
    retarget(path))) {
    markSource(find(current.tree, path));
    treeTo(path);
    keep();
    return;
  }
  chosen = was;
  if (replay && path === null) return;
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
  const h = locked(target(el), chosen && forRow(current.panel, chosen,
    { roots: true }));
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
  // (a group's chevron is part of its row, for pointing)
  if (li && el.closest(".row, #tree li > .chev")) {
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
    chosen && forRow(current.panel, chosen, { roots: true }));
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
  const pe = t.closest(".pedge button");
  if (pe) return ptrGo(pe);
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
    else if (k === "first") stepTo(-Infinity);
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
      Home: -Infinity, End: Infinity }[e.key]);
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
    // (solc's pointers, in the format's vocabulary: decode.js solcTilde)
    f = { ...f, contract: solcTilde(f.contract) };
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
  // (a scene, or a view asked for, leaves a walkthrough)
  replay = null;
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
