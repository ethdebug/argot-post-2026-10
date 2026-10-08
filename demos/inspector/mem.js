// The lower section, "Inside one play": alice's combo-3 play() of
// Arcade's BUG port, compiled by bugc at -O 0 and at -O 2, paused at
// three points, with memory at each, linked to the local variables bugc
// lists there. Each local's bytes are the regions that the reference
// library (@ethdebug/pointers) returned for bugc's pointer, against that
// point's memory (decode.js decodeLocals); this file only lays those
// regions over words. A local listed with no pointer has no location at
// that point. Alice's record slot (at the last point) is the page's own:
// bugc's pointer for `players` gives only its base slot.
import { decodeLocals, typeName } from "./decode.js";
import {
  paint, initialHash, setHash, locked, details, keySection, short,
  regionBytes, renderLocation,
} from "./panel.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = (h) => Number(BigInt(h === undefined || h === "0x" ? 0 : h));
const hex = (n, w = 4) => "0x" + n.toString(16).padStart(w, "0");
const code = (x) => `<code>${esc(x)}</code>`;
const TINTS = 5;
const GROUP = "multiplied";
const RECORD = "players[msg.sender]";
// the selection each point opens with
const DEFAULT = { roll: "hit", mult: GROUP, writes: "gained" };
const MEMBERS = [["score", 8], ["combo", 4], ["bestCombo", 4],
  ["plays", 4], ["hitCount", 4], ["lastBlock", 8]];

window.memResults = { done: false, errors: [], decoded: {} };

let data; // fixtures/memory.json
const decoded = {}; // `${opt}/${point}/${k}` -> nodes (decodeLocals)
let opt = 0; // the optimization level shown
let pt = "roll"; // the point shown
let mode = "after"; // at a two-step point: "before" or "after" the step
let chosen = null; // the selected tree path
let model;
let hover = null;

const level = () => data.levels.find((l) => l.optimize === opt);
const point = () => level().points.find((p) => p.id === pt);
// A one-step point has one side, "after" (its memory as it is then); a
// two-step point has "before" and "after" the step between them
const sides = () => point().steps.length === 2 ? ["before", "after"]
  : ["after"];
const two = () => sides().length === 2;
const stepOf = (side) => point().steps[two() && side === "before" ? 0
  : point().steps.length - 1];
const pairs = (m) => (m.slice(2).match(/../g) ?? []);

// ------------------------------------------------------------- model

// "0x00b8–0x00bf"
const span = (r) => {
  if (r.location === "storage") {
    return `bytes ${r.offset}–${r.offset + r.length - 1} of the slot`;
  }
  const o = num(r.offset);
  const n = num(r.length ?? "0x20");
  return `${hex(o)}–${hex(o + n - 1)}`;
};

// The locals at one step: those with a pointer, decoded, and those
// listed with no pointer (no location at this point)
function localsAt(k) {
  const s = point().steps[k];
  const nodes = decoded[`${opt}/${pt}/${k}`].map((n) => ({ ...n }));
  for (const v of s.variables) {
    if (!v.pointer) {
      nodes.push({ label: v.identifier, path: v.identifier, type: v.type,
        none: true });
    }
  }
  return nodes;
}

// alice's record slot, with its members, as the page reads it
function recordNode() {
  const r = point().record;
  if (!r) return null;
  const w = BigInt(r.word);
  let low = 0;
  const children = MEMBERS.map(([name, n]) => {
    const value = (w >> BigInt(8 * low)) & ((1n << BigInt(8 * n)) - 1n);
    const region = { location: "storage", slot: r.slot,
      offset: 32 - low - n, length: n };
    low += n;
    return { label: name, path: `${RECORD}.${name}`, kind: "member",
      typeText: `uint${8 * n}`, value: { text: String(value), region,
        parts: [] } };
  });
  return { label: RECORD, path: RECORD, kind: "record",
    typeText: "Player", value: { text: `slot ${short(r.slot)}`,
      parts: [] }, children };
}

// One side's nodes: the locals, inside multiplied wrapped in one node
// for the function; and alice's record
function sideTree(k) {
  const locals = localsAt(k);
  const out = pt === "mult" ? [{ label: GROUP, path: GROUP, kind: "group",
    typeText: "function", children: locals }] : locals;
  const rec = recordNode();
  return rec ? [...out, rec] : out;
}

// Join the sides' trees by path: each node gets `before` and `after`
// (its value, or `none`: listed with no location)
function merge(lists) {
  const byPath = new Map();
  lists.forEach(({ side, nodes }) => {
    for (const n of nodes) {
      const x = byPath.get(n.path) ?? { n, at: {} };
      x.at[side] = n;
      byPath.set(n.path, x);
    }
  });
  return [...byPath.values()].map(({ n, at }) => {
    const node = { label: n.label, path: n.path, type: n.type,
      typeText: n.typeText, kind: n.kind ?? "local" };
    for (const { side } of lists) {
      const x = at[side];
      node[side] = x ? (x.none ? { none: true } : x.value ?? {}) : undefined;
    }
    if (n.children) {
      node.children = merge(lists.map(({ side }) => ({ side,
        nodes: at[side]?.children ?? [] })));
    }
    const t = (v) => v?.none ? "none" : v?.text;
    node.changed = two() && (t(node.before) !== t(node.after) ||
      (node.children ?? []).some((c) => c.changed));
    return node;
  });
}

const walk = (nodes, f, parent) => nodes.forEach((n) => {
  f(n, parent);
  walk(n.children ?? [], f, n);
});
const find = (nodes, path) => {
  let out;
  walk(nodes, (n) => {
    if (n.path === path) out = n;
  });
  return out;
};

function build() {
  const ss = sides();
  const tree = merge(ss.map((side) => ({ side,
    nodes: sideTree(point().steps.indexOf(stepOf(side))) })));
  const owners = new Map(); // id -> { id, row, label, regions, text }
  const cover = Object.fromEntries(ss.map((s) => [s, new Map()]));
  const own = (id, row, label, side, region, text) => {
    if (!owners.has(id)) {
      owners.set(id, { id, row, label, text: {},
        regions: Object.fromEntries(ss.map((s) => [s, []])) });
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
  // Each region once a side. multiplied's frame pointer (at -O 0, the
  // word each of its locals' pointers reads first) belongs to the
  // function's node
  for (const side of ss) {
    const seen = new Set();
    walk(tree, (n, parent) => {
      const v = n[side];
      if (!v?.region) return;
      for (const r of v.parts ?? []) {
        const k = `${r.name} ${r.offset} ${r.length}`;
        if (seen.has(k)) continue;
        seen.add(k);
        const g = r.name === "-frame" && parent?.kind === "group";
        own(g ? `${GROUP}#frame` : `${n.path}#${r.name}`,
          g ? GROUP : n.path, g ? `${GROUP}'s frame pointer`
            : `${n.label} (${r.name})`, side, r);
      }
      own(n.path, n.path, n.label, side, v.region, v.text);
    });
  }
  const bytes = {};
  for (const side of ss) bytes[side] = pairs(stepOf(side).memory);
  const rec = point().record;
  // Words to show: those a value lives in, and (two steps) those that
  // changed
  const words = new Set(ss.flatMap((s) => [...cover[s].keys()]));
  if (rec) words.delete(rec.slot);
  if (two()) {
    const [a, b] = [bytes.before, bytes.after];
    for (let w = 0; w < Math.max(a.length, b.length); w += 32) {
      if (a.slice(w, w + 32).join("") !== b.slice(w, w + 32).join("")) {
        words.add(hex(w));
      }
    }
  }
  const order = [...words].sort((x, y) => num(x) - num(y));
  // a group's own value: its frame's address, or no frame
  for (const side of ss) {
    const g = tree.find((n) => n.kind === "group");
    if (!g) continue;
    const f = owners.get(`${GROUP}#frame`)?.regions[side]?.[0];
    const at = f ? num("0x" + bytes[side].slice(num(f.offset),
      num(f.offset) + 32).join("")) : null;
    g[side] = { text: f ? `frame at ${hex(at)}` : "inlined: no frame",
      frame: at };
  }
  return { tree, owners, cover, bytes, order, rec, sides: ss };
}

// The 32 bytes of a word at one side, as hex pairs (undefined: past the
// end of memory)
function wordAt(m, w, side) {
  if (m.rec && w === m.rec.slot) {
    return m.rec.word.slice(2).match(/../g);
  }
  const at = num(w);
  return Array.from({ length: 32 }, (_, i) => m.bytes[side][at + i]);
}

// ----------------------------------------------- the location panels

// Memory and storage, each its own panel, drawn by the one location
// panel (panel.js renderLocation): memory by its words' offsets, and
// alice's record slot (at the last point), by its slot
function panels(m) {
  const facts = (w) => !two() ? "" : wordAt(m, w, "before").join("") ===
    wordAt(m, w, "after").join("") ? "unchanged" : "changed";
  // (the panel's own header names the location: a view's name only
  // tells Before from After)
  const title = () => (side) => two() ? (side === "before"
    ? "Before" : "After") : "";
  const mem = renderLocation(m, { id: "memory", sides: m.sides,
    top: m.order[0] !== undefined && num(m.order[0]) === 0,
    title: title("Memory"), aria: (side) => two()
      ? `Memory ${side} the step` : "Memory at this point",
    word: (w, side) => wordAt(m, w, side),
    rows: m.order.map((w, k) => ({ w, name: `word ${w}`, gutter: w,
      what: `word ${w}${facts(w) ? `, ${facts(w)}` : ""}`, facts: facts(w),
      same: facts(w) === "unchanged",
      next: k > 0 && num(w) === num(m.order[k - 1]) + 32 })) });
  const r = m.rec;
  const store = r && renderLocation(m, { id: "storage", sides: m.sides,
    title: title("Storage"), aria: (side) => two()
      ? `Storage ${side} the step` : "Storage at this point",
    word: (w, side) => wordAt(m, w, side),
    rows: [{ w: r.slot, name: `keccak(msg.sender, slot ${r.base})`,
      gutter: `…${r.slot.slice(-4)}`, facts: facts(r.slot),
      same: facts(r.slot) === "unchanged",
      what: `storage slot ${r.slot}, keccak(msg.sender, slot ${r.base})${
        facts(r.slot) ? `, ${facts(r.slot)}` : ""}` }] });
  return { mem, store };
}

// ------------------------------------------------------- the values

const NOLOC = `<i class="noloc">no location at this point</i>`;
const typeOf = (n) => n.typeText ?? (n.type ? typeName(n.type, {}) : "");

function row(n, top) {
  const v = n[mode] ?? n.after;
  const val = !v ? "" : v.none ? NOLOC : esc(v.text ?? "");
  const kids = n.children?.length
    ? `<ul>${n.children.map((c) => row(c)).join("")}</ul>` : "";
  const cls = two() ? (n.changed ? "chg" : "same") : "";
  return `<li data-path="${esc(n.path)}" class="${cls}${top ? " top" : ""}${
    v?.none ? " none" : ""}">` +
    `<div class="row" tabindex="0" role="button" aria-pressed="false">` +
    `<span class="name">${esc(n.label)}</span>` +
    `<span class="type">${esc(typeOf(n))}</span>` +
    `<span class="val${cls ? ` ${cls}` : ""}"><span>${val}</span></span>` +
    `</div>${kids}</li>`;
}

const renderValues = (m) =>
  `<ul>${m.tree.map((n) => row(n, true)).join("")}</ul>`;

// ------------------------------------------------- how this was found

const expr = (e) => code(JSON.stringify(e));
// A value from the library's evaluator, { hex }: small numbers in
// decimal, addresses in hex
const shown = (v) => {
  const n = BigInt(v.hex === "0x" ? 0 : v.hex);
  return n < 256n ? `<b>${n}</b>` : `<b>${hex(Number(n))}</b>`;
};
const args = (s) => s.args ? `<div class="args">where ${s.args.map((a) =>
  `${expr(a.expr)} = ${shown(a.value)}`).join(", ")}</div>` : "";
const TAG = { before: "before", after: "after" };

// What a region's bytes are, as read at that point
function readText(s) {
  const n = BigInt(s.read === "0x" ? 0 : s.read);
  if (s.at.name === "-frame") {
    return `the frame's address, <b>${hex(Number(n))}</b>`;
  }
  return `the value, ${code(s.read)}`;
}

// The steps of one side's derivation, each with a key for its structure
// (what it does, not the values it finds), its evaluation in short, and
// its list item
function items(n, v, side) {
  const linked = (r) => ` data-region="${esc(JSON.stringify(r))}"` +
    ` data-side="${side}" tabindex="0"`;
  const out = [{ key: "start", eval: "",
    html: `<li><span class="k">Start</span>
      ${code(n.path)} is a local in memory here
      <span class="tag">from bugc</span><br>Its pointer is in the
      variables context of the paused instruction.</li>` }];
  for (const s of v.how.steps) {
    if (s.kind !== "region") continue;
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
  const r = v.region;
  out.push({ key: "result", eval: `${span(r)} = ${esc(v.text)}`,
    html: `<li class="final"${linked(r)}><span class="k">Result</span>
    memory ${span(r)}, ${num(r.length)} bytes.
    <div>Read${two() ? ` ${TAG[side]} the step` : ""}:
    <b>${esc(v.text)}</b></div></li>` });
  // each item as two columns: its kind, and the rest
  return out.map((x) => ({ ...x, html: x.html.trim().replace(
    /^(<li[^>]*>)\s*(<span class="k">[^<]*<\/span>)([\s\S]*)<\/li>$/,
    '$1$2<div class="c">$3</div></li>') }));
}

const steps = (xs) => `<ol class="steps">${xs.map((x) =>
  `<li><span class="k">${x[0]}</span><div class="c">${x[1]}</div></li>`)
  .join("")}</ol>`;

function howGroup(n) {
  const v = n[mode] ?? n.after;
  if (v.frame === null) {
    return steps([["Inlined", `At -O${opt}, bugc inlines
      ${code(GROUP)}: no call, no frame.`],
    ["Locals", `Each of its locals' pointers is a fixed memory offset
      (pick one to see it).`]]);
  }
  return steps([["Call", `At -O${opt}, ${code(GROUP)} runs as a call,
    with a frame in memory.`],
  ["Frame", `The word at ${code("0x0080")} holds the frame's address,
    <b>${hex(v.frame)}</b>.`],
  ["Locals", `Each local's pointer reads that word (region
    ${code("-frame")}) and adds its own offset (pick one to see it).`]]);
}

function howRecord(n) {
  const r = point().record;
  const member = n.kind === "member";
  const reg = n.after.region;
  return steps([
    ["Start", `${code("players")} is in storage at slot <b>${r.base}</b>
      <span class="tag">from bugc</span><br>bugc's pointer for it gives
      its base slot only.`],
    ["Key", `${code("msg.sender")} = ${code(r.key)}, alice.`],
    ["Slot", `keccak256(key . ${r.base}) = ${code(r.slot)}
      <span class="tag">BUG's rule</span>`],
    ...(member ? [["Bytes", `${code(n.label)}: ${span(reg)} (byte 0 is
      the most significant), packed from the low end as Solidity does
      <span class="tag">BUG's rule</span>`]] : []),
    ["Value", member ? `<b>${esc(n.after.text)}</b>, from the slot as the
      trace has it at this step` : `the slot as the trace has it at this
      step: before the transaction, then each SSTORE to it so far`],
  ]);
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
    esc(typeOf(n))}</span></p>`;
  if (n.kind === "group") return void (box.innerHTML = head + howGroup(n));
  if (n.kind !== "local") return void (box.innerHTML = head + howRecord(n));
  const side = two() ? mode : "after";
  const other = side === "before" ? "after" : "before";
  const v = n[side];
  if (!v || v.none) {
    box.innerHTML = head + `<p class="small">bugc lists ${code(n.path)}
      here with its type and no pointer: no location at this point.</p>`;
    return;
  }
  // At a two-step point, the other side's derivation beside this one:
  // shared steps once, a step that evaluates differently with both
  // evaluations; where the two part (the local in another word), the
  // rest as two lists
  const A = items(n, v, side);
  const ov = two() && n[other] && !n[other].none ? n[other] : null;
  const B = ov ? items(n, ov, other) : null;
  let k = B ? 0 : A.length;
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
      `<div><span class="ev-tag">before</span> ${a.eval}</div>` +
      `<div><span class="ev-tag">after</span> ${b.eval}</div></div>` +
      "</div></li>");
  };
  const same = B && !forked && A.every((x, i) => x.eval === B[i].eval);
  const whose = !two() ? "" : `<p class="howside">For the memory <b>${
    TAG[side]}</b> the step.${same ? " The same steps find the same " +
    "bytes before and after." : ""}${forked ? ` From step ${k + 1}, the ` +
    `two differ: bugc points ${code(n.path)} at another word.` : ""}` +
    `${B ? "" : ` The other side lists it with no location.`}</p>`;
  box.innerHTML = head + whose + `<ol class="steps">${A.slice(0, k)
    .map(dual).join("")}</ol>` + (forked ? list(A, side, "mine") +
    list(B, other, "theirs") : "") +
    `<p class="muted small">The library's dereference() returned these
    regions for bugc's pointer and read them. The steps above walk through
    the pointer with the library's evaluator; they agree.</p>`;
}

// ------------------------------------------------------- highlight

const key = (side, w, i) => `${side}|${w}|${i}`;

function ownerBytes(m, ids) {
  const out = new Set();
  for (const id of ids) {
    const o = m.owners.get(id);
    for (const side of m.sides) {
      for (const r of o?.regions[side] ?? []) {
        for (const [w, i] of regionBytes(r)) out.add(key(side, w, i));
      }
    }
  }
  return out;
}

// Where a value is, in words
const whereText = (v) => !v ? "not listed" : v.none
  ? "no location at this point" : v.region ? span(v.region) : v.text;

// A value and everything under it. A composite's immediate children
// each get a child colour (pk1 …); the selection colour is its own (its
// row, and its own bytes: multiplied's frame pointer).
function forValue(m, path) {
  const n = find(m.tree, path);
  const under = new Map([[path, 0]]); // tree path -> colour
  (n.children ?? []).forEach((c, k) => walk([c], (x) =>
    under.set(x.path, 1 + (k % 8))));
  const ids = [...m.owners.keys()].filter((id) =>
    under.has(m.owners.get(id).row));
  const colors = n.children?.length ? new Map([...under,
    ...ids.filter((id) => m.owners.get(id).row !== path)
      .map((id) => [id, under.get(m.owners.get(id).row)])]) : null;
  const info = [["Value", `${code(path)} (${esc(typeOf(n))})`]];
  if (two()) {
    const at = (v) => esc(`${whereText(v)}${v?.region && v.text
      ? ` = ${v.text}` : ""}`);
    info.push(["Before", at(n.before)], ["After", at(n.after)]);
  } else {
    info.push(["Where", esc(whereText(n.after))]);
    if (n.after?.region && n.after.text) {
      info.push(["Holds", esc(n.after.text)]);
    }
  }
  // and the regions read to find it (a local's frame pointer)
  const bytes = ownerBytes(m, ids);
  for (const side of m.sides) {
    for (const r of n[side]?.parts ?? []) {
      for (const [w, i] of regionBytes(r)) bytes.add(key(side, w, i));
    }
  }
  return { bytes, rows: new Set(under.keys()), path,
    colors, label: `${path} · ${info.slice(1).map((x) =>
      x[1].replace(/<[^>]+>/g, "")).join(" · ")}`, info };
}

function forBytes(m, cell) {
  const w = cell.closest(".word").dataset.slot;
  const ids = (cell.dataset.owners ?? "").split("|").filter(Boolean);
  const [from, to] = cell.dataset.g.split("-").map(Number);
  const h = (side) => {
    const b = wordAt(m, w, side).slice(from, to + 1);
    return b.every((x) => x !== undefined) ? "0x" + b.join("")
      : "not in memory";
  };
  const range = from === to ? `byte ${from}` : `bytes ${from}–${to}`;
  const store = m.rec && w === m.rec.slot;
  const where = store ? `${range} of storage slot ${short(w)}`
    : `${range} of word ${w} (${hex(num(w) + from)}–${hex(num(w) + to)})`;
  const info = [["Bytes", esc(where)], ...(two()
    ? [["Before", code(h("before"))], ["After", code(h("after"))]]
    : [["Hex", code(h("after"))]])];
  const vals = two() ? (h("before") === h("after")
    ? `${h("after")} (the same before and after)`
    : `${h("before")} → ${h("after")}`) : h("after");
  if (!ids.length) {
    return { bytes: new Set(), rows: new Set(), at: { s: w, from, to },
      label: `${where} · ${vals} · no value shown owns these bytes`,
      info: [["Value", "none shown owns these bytes"], ...info] };
  }
  const names = ids.map((id) => m.owners.get(id).label).join(", ");
  return { bytes: ownerBytes(m, ids), at: { s: w, from, to },
    rows: new Set(ids.map((id) => m.owners.get(id).row)),
    label: `${names} · ${where} · ${vals}`,
    info: [["Values", code(names)], ...info] };
}

function forWord(m, w) {
  const store = m.rec && w === m.rec.slot;
  const label = store ? `storage slot ${w}` : `word ${w} (${hex(num(w))}–${
    hex(num(w) + 31)})`;
  return { bytes: new Set(), rows: new Set(), at: { s: w, from: 0, to: 31 },
    label, info: [[store ? "Slot" : "Word", code(store ? w : label)]] };
}

// A region step of "How this was found"
function forRegion(r, side) {
  const bytes = new Set();
  for (const [w, i] of regionBytes(r)) bytes.add(key(side, w, i));
  return { bytes, rows: new Set(), step: true,
    label: `region ${r.name} · ${span(r)}`,
    info: [["Region", code(r.name)], ["Where", esc(span(r))]] };
}

// ------------------------------------------------------------ page

const PROBE = "Point at a value or a byte for its details.";

function show() {
  const sel = chosen ? forValue(model, chosen) : null;
  const h = hover ?? sel;
  // (each location's panel, the same way)
  for (const root of [$("mpanel"), $("mspanel")]) {
    paint(root, $("mtree"), h, two() ? { before: "before",
      after: "after", dumps: { before: "Before", after: "After" } }
      : { cards: false });
  }
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

// The view in the URL hash: the level, the point, the mode (at a
// two-step point), the selection (absent: the point's default; empty:
// none)
let restored = false;
function keep() {
  if (!restored) return;
  setHash({ a: null, b: null, mopt: String(opt), mpt: pt,
    mmode: two() ? mode : null,
    msel: chosen === DEFAULT[pt] ? null : chosen ?? "" });
}

// The source, with the paused instructions' code ranges marked: one
// point's, or the two steps' (before, after)
function renderSource() {
  const src = data.program.source;
  const bytes = new TextEncoder().encode(src);
  const cls = new Array(bytes.length).fill("");
  for (const side of sides()) {
    const r = stepOf(side).range;
    if (!r) continue;
    for (let k = r.offset; k < r.offset + r.length; k++) {
      cls[k] += two() && side === "before" ? "a" : "b";
    }
  }
  let html = "";
  let k = 0;
  const dec = (a, b) => new TextDecoder().decode(bytes.slice(a, b));
  while (k < bytes.length) {
    let e = k;
    while (e < bytes.length && cls[e] === cls[k]) e++;
    const t = esc(dec(k, e));
    html += cls[k] ? `<mark class="m${cls[k]}">${t}</mark>` : t;
    k = e;
  }
  $("msrc").innerHTML = html;
  $("msrclegend").innerHTML = two()
    ? `<mark class="ma">before</mark> <mark class="mb">after</mark>`
    : `<mark class="mb">paused here</mark>`;
}

// What each point is, in a line
function note() {
  const p = point();
  const s = p.steps.map((x) => `step ${x.step} (${x.op})`).join(" and ");
  const L = level();
  const inl = opt ? "inlined: no call, no frame"
    : "a real call, with its frame";
  const text = {
    roll: `Just after ${"`"}let hit = rolledHit()${"`"}: the first step
      where bugc gives hit a location.`,
    mult: `Inside multiplied(10, 3), ${inl}: the two steps around
      ${"`"}m = combo${"`"}, the first where all three locals have a
      location with m = 5, then with m = 3.`,
    writes: `gained = 30, just before the SSTORE that adds it to her
      score; her record slot as the trace has it then (every counter but
      score already written).`,
  }[p.id];
  return `${text.replace(/\s+/g, " ")} At -O${opt}: ${s} of ${
    L.trace.steps}.`;
}

function render() {
  model = build();
  if (chosen && !find(model.tree, chosen)) chosen = null;
  if (!two()) mode = "after";
  $("mtree").innerHTML = renderValues(model);
  const { mem, store } = panels(model);
  $("mpanel").innerHTML = mem;
  $("mspanel").innerHTML = store ?? "";
  $("mstore").hidden = !store;
  window.fitDumps?.();
  for (const v of $("memory").querySelectorAll(".panel .view")) {
    v.hidden = v.dataset.side !== mode;
  }
  $("mmoderow").hidden = !two();
  $("msection").toggleAttribute("data-two", two());
  for (const b of $("mmode").querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(b.dataset.mode === mode));
  }
  for (const b of $("mlevel").querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(Number(b.dataset.opt) === opt));
  }
  for (const b of $("mpoint").querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(b.dataset.id === pt));
  }
  renderSource();
  $("mnote").textContent = note();
  hover = null;
  renderHow();
  show();
}

function target(el) {
  if (!model || !el?.closest) return null;
  if (el.closest("#mpanel .tray, #mspanel .tray")) return hover;
  const cell = el.closest(":is(#mpanel, #mspanel) .b[data-g]");
  if (cell) return forBytes(model, cell);
  const addr = el.closest(":is(#mpanel, #mspanel) .wrow[data-slot] .addr");
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
  const cell = el.closest(":is(#mpanel, #mspanel) .b[data-g]");
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
    const l = e.target.closest("#mlevel button");
    if (l) {
      opt = Number(l.dataset.opt);
      return render();
    }
    const p = e.target.closest("#mpoint button");
    if (p) {
      if (p.dataset.id !== pt) {
        pt = p.dataset.id;
        chosen = DEFAULT[pt];
      }
      return render();
    }
    const m = e.target.closest("#mmode button");
    if (m) {
      mode = m.dataset.mode;
      return render();
    }
    if (e.target.closest(":is(#mpanel, #mspanel) .b[data-g], #mtree .row")) {
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
    const c = e.target.closest?.(":is(#mpanel, #mspanel) .b[tabindex], " +
      "#mtree .row");
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
      { label: "the BUG example" });
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
  // Decode every step once; the checks read the values from here
  for (const L of data.levels) {
    const out = window.memResults.decoded[L.optimize] = {};
    for (const p of L.points) {
      out[p.id] = [];
      for (const [k, s] of p.steps.entries()) {
        const nodes = await decodeLocals(s.variables, s.memory);
        decoded[`${L.optimize}/${p.id}/${k}`] = nodes;
        const flat = {};
        walk(nodes, (n) => {
          flat[n.path] = n.value.text;
        });
        out[p.id].push({ values: flat, none: s.variables
          .filter((v) => !v.pointer).map((v) => v.identifier) });
      }
    }
  }
  const c = data.compiler;
  $("mmeta").innerHTML = `Program <code>${esc(data.program.file)}</code>` +
    `, alice's third hit, compiled by bugc from ethdebug/format ${
      c.branch === "main" ? "main" : `branch <code>${esc(c.branch)}</code>`}` +
    ` (commit <code>${esc(c.commit.slice(0, 9))}</code>).`;
  // Back to what the URL hash says, if it still makes sense
  const h = initialHash;
  if (data.levels.some((l) => String(l.optimize) === h.get("mopt"))) {
    opt = Number(h.get("mopt"));
  }
  if (level().points.some((p) => p.id === h.get("mpt"))) pt = h.get("mpt");
  if (["before", "after"].includes(h.get("mmode"))) mode = h.get("mmode");
  chosen = DEFAULT[pt];
  const sel = h.get("msel");
  if (!wired) wire();
  wired = true;
  render();
  if (sel !== null) {
    chosen = sel && find(model.tree, sel) ? sel : null;
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
