// Storage inspection demo: one contract, Arcade, in scenes. Each scene
// shows one point (the state after a transaction) or two to compare
// (before and after one). Loads the scene's fixture, decodes the
// contract's storage (decode.js), and draws it.
import {
  storageState, mappingKeys, decodeStorage, typeName, commit, baseSlot,
} from "./decode.js";
import {
  buildPanel, renderPanel, forRow, forBytes, forRegion, forSlot, paint,
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
}
addEventListener("resize", () => current && alignColumns());

function render() {
  $("tree").style.paddingTop = "";
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
function replaySteps(path, side) {
  const node = find(current.tree, path);
  const { types } = current.f.contract;
  const leaves = [];
  // every value under the selection (an array's length too)
  const visit = (n) => {
    if (n[side]) leaves.push(n);
    (n.children ?? []).forEach(visit);
  };
  visit(node);
  if (!leaves.length) return [];
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
  // the rules for what is inside an entry are shown by example: the
  // first entry's (and for a long string, the first long one)
  let example;
  const mine = (leaf) => {
    const e = entryPath(leaf);
    example ??= e;
    return !e || e === example;
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
        } else if (op === "$keccak256") {
          add("long", (p) => p.items.push({ leaf, from: a[0],
            to: r.s.value.hex }));
        }
      } else if (r.kind === "template") {
        const t = types[r.s.name];
        if (t?.kind === "struct" && mine(leaf)) {
          add("record", (p) => {
            p.struct = t;
            p.entry ??= entryPath(leaf);
          });
        }
      } else if (r.kind === "if") {
        branch = r.s.branch;
        mode = branch === "then" ? "short" : "long";
      } else if (r.kind === "list") {
        add("item", (p) => p.index = r.s.index);
      } else if (r.kind === "region" && r.region) {
        const n = r.s.name;
        const g = r.region;
        if (n === "length-flag") {
          // the string's layout is known from the next branch: later
          leaf._flag = g;
        } else if (n === "long-length") {
          leaf._long = g;
        } else if (n === "data") {
          if (mode !== "long" && !mine(leaf)) continue;
          add(mode ?? "short", (p) => p.items.push({ leaf, flag: leaf._flag,
            long: leaf._long, data: g }));
        } else if (n === "item") {
          add("item", (p) => p.regions.push(g));
        } else if (n === "length" && !entryPath(leaf)) {
          add("declared", (p) => p.regions.push(g));
        } else if (mine(leaf)) {
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
  for (const p of [...ph.values()].sort((a, b) => a.order - b.order)) {
    if (p.k === "declared") {
      const w = wordAt(p.slot);
      const kind = p.typeKind ?? "value";
      step({ phase: "declared", var: p.var,
        cap: p.context ? `${p.var} is at slot ${small(p.slot)}, ${
          p.context.length} bytes from offset ${p.context.offset}`
          : kind === "mapping" && w !== undefined && !num(w)
            ? `${p.var} gets slot ${small(p.slot)} but stores nothing ` +
              `there; ${small(p.slot)} only feeds each hash`
            : kind === "array" ? `${p.var} gets slot ${small(p.slot)}; ` +
              "that slot holds its length"
              : `${p.var} gets slot ${small(p.slot)}`,
        form: esc(p.context ? `slot ${small(p.slot)}, bytes ${
          p.context.offset}–${p.context.offset + p.context.length - 1}`
          : `slot ${small(p.slot)}${w === undefined ? "" : ` = ${small(w)}`}`),
        constructs: ["pointer"], source: "from solc's pointer",
        chip: `slot ${small(p.slot)}`, chipLabel: kind === "struct" ? "record"
          : ["mapping", "string"].includes(kind) ? kind : kind === "array"
            ? "array" : "value",
        slots: [...p.slots], regions: p.regions, rows: [p.var] });
    } else if (p.k === "entry") {
      const [first, ...rest] = p.items;
      const item = keyItem(first.key);
      step({ phase: "entry", var: p.var,
        cap: `The template needs a key: ${keyName(first.key)}'s address, ${
          keyList ? `from ${keyList}` : "from the trace"}`,
        form: `keccak256(${addr(first.key)}, ${small(first.base)}) = ${
          esc(tail(first.slot))} <span class="prose">· keccak256 is a ` +
          "hash; each input is padded to 32 bytes</span>",
        constructs: ["define", "$keccak256"], source: keySource,
        sourceTint: !!item,
        chip: `keccak(${short(first.key)}, ${small(first.base)})`,
        chipLabel: "record", slots: [word(first.slot)],
        regions: item ? [item[side].region] : [],
        rows: [first.path, ...(item ? [item.path] : [])],
        colorsOf: p.var, keyItem: item?.path });
      if (rest.length) {
        step({ phase: "others", var: p.var,
          cap: "The same template for every key: the pointer takes the " +
            "key as input",
          form: rest.map((x) => `${addr(x.key)} → ${esc(tail(x.slot))}`)
            .join(" · ") + ` <span class="prose">· expect: the template's ` +
            "inputs; for: what it expands to</span>",
          constructs: ["template"], source: keyList
            ? `keys from ${keyList}` : "keys from the trace",
          chip: rest.map((x) => keyName(x.key)).join(", "),
          chipLabel: "records", slots: rest.map((x) => word(x.slot)),
          rows: rest.map((x) => x.path), colorsOf: p.var });
      }
    } else if (p.k === "item") {
      step({ phase: "item", var: p.var,
        cap: `The items start at the hash of slot ${small(p.base)}`,
        form: esc(`keccak256(${small(p.base)}) = ${tail(p.data)}${p.index
          !== undefined ? `; item ${p.index} at + ${p.index}` : ""}`),
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
          ? `: ${per[0].length} fields, then the ${per[1].join(", ")}` : ""}`,
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
        cap: many ? `The fields share one slot, packed from the right: ${
          name(right.leaf)} takes the last ${n32(right.region)} bytes`
          : `${name(items[0].leaf)} is in its record's slot`,
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
      const what = entryPath(x.leaf) ? `${who}'s ${name(x.leaf)}`
        : x.leaf.label;
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
        regions: ds.flatMap((y) => [y.flag, y.data]), rows: [x.leaf.path] });
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
function flowOf(v, rename) {
  if (typeof v === "string") return rename?.(v) ?? v;
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) return `[${v.map((x) => flowOf(x, rename))
    .join(", ")}]`;
  return `{ ${entriesOf(v).map(([k, x]) => `${k}: ${flowOf(x,
    k === "template" ? rename : null)}`).join(", ")} }`;
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
  const flowFits = (k, x, d) => `${"  ".repeat(d)}${k}: ${flowOf(x)}`
    .length <= WIDE;
  const block = (o, d, tags) => {
    for (const [k, x] of ordered(o)) {
      const own = k === "define" ? [`define:${Object.keys(x)[0]}`]
        : k === "if" ? ["if"] : k === "expect" ? ["expect"] : [];
      if (k === "template") todo.push(x);
      // (an expression too long for one line: its operator, then its
      // operands, one a line)
      if (isExpr(x) && !flowFits(k, x, d)) {
        const [op] = Object.keys(x);
        put(d, `${k}:`, [...tags, ...own]);
        put(d + 1, `${op}:`, [...tags, ...own]);
        for (const y of [].concat(x[op])) {
          put(d + 2, `- ${flowOf(y)}`, [...tags, ...own]);
        }
        continue;
      }
      if (typeof x !== "object" || isExpr(x) ||
        ((isRegion(x) || allScalar(x)) && flowFits(k, x, d)) ||
        (Array.isArray(x) && x.every((y) => typeof y !== "object"))) {
        put(d, `${k}: ${flowOf(x, k === "template" ? short : null)}`,
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
    if (isRegion(y) && `${"  ".repeat(d)}- ${flowOf(y)}`.length <= WIDE) {
      put(d, `- ${flowOf(y)}`, [...tags, `region:${y.name}`]);
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
    case "entry": return pick((l) => has(l, "t:mapping") &&
      l.tags.some((t) => t.startsWith("define:")) && !has(l, "item"));
    case "others": return pick((l) => has(l, "t:mapping") && (has(l, "head") ||
      has(l, "expect")));
    case "item": return pick((l) => has(l, "t:array") && !l.tags.some((t) =>
      t === "region:length"));
    // (the record: the whole struct template, its group of members)
    case "record": return pick((l) => has(l, "t:struct"));
    case "fields": {
      const names = new Set(st.rows.map((p) => `region:${p.split(".").pop()}`));
      return pick((l) => has(l, "t:struct") && l.tags.some((t) =>
        names.has(t)));
    }
    case "short": return pick((l) => has(l, "t:string") && (has(l,
      "region:length-flag") || has(l, "if") || has(l, "then")));
    case "long": return pick((l) => has(l, "t:string") && (has(l, "if") ||
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
  const h = forStep(current.panel, replay.side, st);
  h.rows = new Set(st.rows);
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
  // the list item a key comes from, in the key's tint
  if (st.keyItem) {
    h.colors = new Map([...(h.colors ?? []), [st.keyItem, "src"]]);
  }
  // the slots the steps so far have derived keep their labels
  h.known = new Set();
  for (const x of replay.steps.slice(0, replay.i + 1)) {
    for (const k of forStep(current.panel, replay.side, x).bytes) {
      h.known.add(k.split("|")[1]);
    }
  }
  return h;
}

// The short caption of a step, for the bar over the dump
function shortCap(st) {
  switch (st.phase) {
    case "declared": return `${st.var}${st.var.endsWith("s") ? "'" : "'s"
      } own slot`;
    case "entry": return "the hash of the first key";
    case "others": return "the same for every key";
    case "item": return "the items, from a hash";
    case "record": return "a record's slots";
    case "fields": return st.rows.length > 1 ? "packed fields" : "its field";
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
function renderBox() {
  const bar = $("details");
  const text = $("dtext");
  const node = chosen && find(current.tree, chosen);
  if (!node) {
    // (the same room, idle)
    bar.innerHTML = `<span class="rsel muted">Select a value to see how ` +
      "it was found.</span>";
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
        ? ` <span class="muted">${parts} ${t?.kind === "mapping"
          ? parts === 1 ? "entry" : "entries" : parts === 1 ? "part"
            : "parts"}</span>` : ""}${side}</span>`;
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
  if (replay) {
    const { i } = replay;
    const st = steps[i];
    ctl = `<button type="button" class="btn" data-r="prev" aria-label=` +
      `"Previous step"${i ? "" : " disabled"}>◀</button>` +
      `<button type="button" class="btn" data-r="next" aria-label=` +
      `"Next step">▶</button>` +
      `<button type="button" class="btn" data-r="end" aria-label=` +
      `"Jump to the resolved value">⏭</button>` +
      `<span class="rcount">${i + 1} / ${steps.length}</span>`;
    short = esc(shortCap(st));
    const fc = footOf(st);
    full = `<p class="rcap">${esc(st.cap)}</p>` +
      `<p class="rform">${st.form}</p>` +
      `<p class="rsrc">${st.constructs.map((c) => `<code class="badge">${
        esc(c)}${c === fc ? sup(c) : ""}</code>`).join(" ")} <span class=` +
      `"source${st.sourceTint ? " pksrc" : ""}">${esc(st.source)}</span></p>`;
  } else {
    const where = h.info.find(([k]) => k === "Where" || k ===
      "Where after")?.[1] ?? "";
    const other = !current.single && v && node[mode === "before" ? "after"
      : "before"];
    ctl = `<button type="button" class="btn" data-r="start">${
      replay === false ? "Replay ▸" : "How was this found? ▸"}</button>`;
    full = v ? `<p class="rcap rwhere">${where}${other &&
      other.text !== v.text ? ` <span class="muted">(${mode === "after"
        ? "before" : "after"}: ${esc(other.text)})</span>` : ""}</p>`
      : `<p class="rcap rwhere">${node[mode] === undefined &&
        !node.children ? esc(missing(node, mode))
        : `${parts} ${t?.kind === "mapping" ? parts === 1 ? "entry"
          : "entries" : parts === 1 ? "part" : "parts"}`}</p>`;
  }
  bar.innerHTML = sel + `<span class="rctl">${ctl}</span>` +
    `<span class="rshort">${short}</span>`;
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
  // the chips: one per step, done, current or later; all done at rest
  const at = replay ? replay.i : steps.length;
  $("chips").innerHTML = steps.map((st, k) => `<button type="button"` +
    ` class="chip ${k < at ? "done" : k === at ? "cur" : "later"}"` +
    ` data-k="${k}" aria-label="${esc(`Step ${k + 1}: ${st.cap}`)}">` +
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
  $("ptr").innerHTML = (replay ? "" : vyperRule(node, mode)) +
    `<pre class="ptrlines"><code>${lines.map((l, k) => `<span class="line${
      lit?.has(k) ? " on" : ""}">${html?.[k] ?? esc(l.text)}</span>`)
      .join("\n")}</code></pre>` +
    (ids.length ? `<p class="muted small pids">Template names shortened; ` +
      `solc's ids: ${ids.map((x) => `<code>${esc(x)}</code>`).join(", ")}</p>`
      : "");
  // the lines a step uses, scrolled into the box's view (it scrolls
  // inside itself; nothing else moves): the whole band, or, if it does
  // not fit, its last lines
  const on = [...$("ptr").querySelectorAll(".line.on")];
  const box = $("ptr");
  if (!on.length) box.scrollTop = 0;
  else {
    const top = on[0].offsetTop;
    const bottom = on.at(-1).offsetTop + on.at(-1).offsetHeight;
    box.scrollTop = bottom - top <= box.clientHeight - 16
      ? Math.max(0, top - (box.clientHeight - (bottom - top)) / 2)
      : bottom - box.clientHeight + 8;
  }
}

// Start, step or leave the replay. Past the last step: the resolved view.
function stepTo(i) {
  if (!replay) return;
  if (i >= replay.steps.length) return endReplay();
  replay.i = Math.max(0, i);
  renderBox();
  show();
}
function startReplay(at = 0) {
  if (!chosen) return;
  const steps = replaySteps(chosen, mode);
  if (!steps.length) return;
  replay = { path: chosen, side: mode, steps, i: at };
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
  // (no scrolling: nothing moves when a value is selected)
  keep();
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
  const step = el.closest("#ptr li[data-region]");
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
  const chip = t.closest("#chips .chip");
  if (chip) {
    const k = +chip.dataset.k;
    return replay ? stepTo(k) : startReplay(k);
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
  if (t.closest("#picker, #details, #chips, #src, .addr, .tray, a, " +
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
