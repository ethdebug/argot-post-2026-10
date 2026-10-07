// The storage panel: two views of storage, before and after, each the
// full 32-byte words that hold the values in the tree, in slot order,
// with each byte linked to the value that owns it. Every byte range here
// comes from a region that @ethdebug/pointers returned (decode.js); this
// file only lays those regions over words.

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const num = (h) => BigInt(h === undefined || h === "0x" ? 0 : h);
const word = (n) => "0x" + n.toString(16).padStart(64, "0");
import { baseSlot, typeName } from "./decode.js";

const SIDES = ["before", "after"];
const TINTS = 5;

// ------------------------------------------------------- the URL hash

// What the page shows lives in the URL hash, so a reload (or a link)
// comes back to it: e.g. #ex=motd&mode=before&sel=motd, and for
// the memory section a=…&b=…&mmode=…&msel=…. A hash without "=" (such
// as #memory) is a plain link to a section. Read once, before either
// section writes it.
const params = () => new URLSearchParams(
  location.hash.includes("=") ? location.hash.slice(1) : "");
export const initialHash = params();

// Set (or, with null, drop) keys in the hash, without a history entry
let pending = null; // a hash the browser refused to set yet
export function setHash(changes) {
  const p = new URLSearchParams(pending ?? (location.hash.includes("=")
    ? location.hash.slice(1) : ""));
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined) p.delete(k);
    else p.set(k, v);
  }
  const h = p.toString().replace(/%5B/g, "[").replace(/%5D/g, "]");
  // only on a change (some browsers limit how often a page may call it)
  if (`#${h}` === location.hash || (!h && !location.hash)) return;
  // (and some limit it to 100 calls in 10 s: then try again later, with
  // the hash as it is then)
  try {
    history.replaceState(null, "", h ? `#${h}` : location.pathname +
      location.search);
    pending = null;
  } catch {
    pending = h;
    clearTimeout(setHash.later);
    setHash.later = setTimeout(() => setHash({}), 2000);
  }
}

// Which section a key press belongs to: the one that has the focus, or,
// with nothing focused, the one the pointer was last pressed in.
// Returns "memory", "calldata" or "storage".
let lastPressed = "storage";
const sectionOf = (el) => el?.closest?.("#memory") ? "memory"
  : el?.closest?.("#calldata") ? "calldata" : "storage";
document.addEventListener("pointerdown", (e) => {
  lastPressed = sectionOf(e.target);
}, true);
export function keySection() {
  const f = document.activeElement;
  return !f || f === document.body ? lastPressed : sectionOf(f);
}

// 0x0000…f39f…2266 -> 0xf39f…2266
export function short(h, keep = 4) {
  const s = "0x" + (h.replace(/^0x0*/, "") || "0");
  return s.length <= keep * 2 + 4 ? s : `${s.slice(0, keep + 2)}…${s.slice(-keep)}`;
}

// The storage bytes a region covers, as [slot word, byte index] pairs.
// Offsets count from the most significant byte; a region longer than the
// rest of its word goes on into the next slots.
export function regionBytes(r) {
  if (r.location !== "storage" || r.slot === undefined) return [];
  const slot = num(r.slot);
  const offset = Number(num(r.offset));
  const length = r.length === undefined ? 32 - offset : Number(num(r.length));
  const out = [];
  for (let k = 0; k < length; k++) {
    const at = offset + k;
    out.push([word(slot + BigInt(Math.floor(at / 32))), at % 32]);
  }
  return out;
}

// accounts[0xf39fd6…92266].nonce -> accounts[0xf39f…2266].nonce
export const shortKeys = (path) =>
  path.replace(/\[(0x[0-9a-fA-F]{16,})\]/g, (_, h) => `[${short(h)}]`);

// ------------------------------------------------------------- model

// Build the panel model for one fixture and its merged tree. `single`:
// a scene with one point (no other state; before and after are the
// same); `when`: what each side is called ("after the transaction").
// `names`: slot -> a name for a slot no template computed.
export function buildPanel(f, tree, { single = false, when, names } = {}) {
  const owners = new Map(); // id -> { id, row, label, text, regions }
  const order = []; // slot words, in the order the tree meets them
  const seen = new Set();
  const hashes = new Map(); // keccak value -> args, from the steps
  const cover = { before: new Map(), after: new Map() };

  const addSlot = (s) => {
    if (!seen.has(s) && f.slots[s]) {
      seen.add(s);
      order.push(s);
    }
  };
  const own = (id, row, label, side, v, region, type) => {
    if (!owners.has(id)) {
      owners.set(id, { id, row, label, type, text: {},
        regions: { before: [], after: [] } });
    }
    const o = owners.get(id);
    o.regions[side].push(region);
    if (v) o.text[side] = v.text;
    for (const [s, i] of regionBytes(region)) {
      addSlot(s);
      if (!cover[side].has(s)) cover[side].set(s, Array.from(
        { length: 32 }, () => []));
      const ids = cover[side].get(s)[i];
      if (!ids.includes(id)) ids.push(id);
    }
  };
  const learn = (how) => {
    for (const s of how?.steps ?? []) {
      if (s.kind !== "define" || !s.expr?.$keccak256 || !s.args) continue;
      hashes.set(num(s.value.hex), s.args.map((a) => ({
        name: a.expr?.$wordsized ?? JSON.stringify(a.expr),
        value: num(a.value.hex),
      })));
    }
  };
  const visit = (n) => {
    for (const side of SIDES) {
      const v = n[side];
      if (!v) continue;
      learn(v.how);
      const name = shortKeys(n.path);
      const t = f.contract.types[n.typeId];
      own(n.path, n.path, v.length ? `${name} (length)` : name, side, v,
        v.region, t && typeName(t, f.contract.types));
      for (const p of v.parts ?? []) {
        learn(p.how);
        own(`${n.path}#length`, n.path, `${name} (length)`, side, null,
          p.region);
      }
    }
    (n.children ?? []).forEach(visit);
  };
  tree.forEach(visit);

  // Slots the transaction read or wrote, from the trace
  const read = new Set();
  const written = new Set();
  for (const s of f.trace.kept) {
    if (s.op !== "SLOAD" && s.op !== "SSTORE") continue;
    const slot = word(num(s.stack[s.stack.length - 1]));
    (s.op === "SLOAD" ? read : written).add(slot);
  }
  // (at one point, only the values' slots: the transaction is not shown;
  // and any slot given a name)
  if (!single) [...read, ...written].forEach(addSlot);
  // each variable's own slot (a mapping's holds nothing)
  for (const v of f.contract.variables) {
    if (v.pointer.location !== "code") addSlot(baseSlot(v));
  }
  Object.keys(names ?? {}).forEach(addSlot);

  // slot number -> variables, from the program-level context
  const bases = new Map();
  for (const v of f.contract.variables) {
    if (v.pointer.location === "code") continue;
    const k = BigInt(baseSlot(v));
    bases.set(k, [...(bases.get(k) ?? []), v.identifier]);
  }

  // Address order, as storage is laid out: slot numbers ascending, so a
  // run of hashed slots (a long string's data) reads as one block
  order.sort((a, b) => (num(a) < num(b) ? -1 : num(a) > num(b) ? 1 : 0));

  // every tree path, so a composite's own rows (an entry's key line, a
  // record) light with its parts
  const paths = [];
  const walkPaths = (n) => {
    paths.push(n.path);
    (n.children ?? []).forEach(walkPaths);
  };
  tree.forEach(walkPaths);
  return { f, owners, order, hashes, cover, read, written, bases, single,
    paths,
    when: when ?? { before: "before the transaction",
      after: "after the transaction" },
    names: new Map(Object.entries(names ?? {})) };
}

const PLAIN = 1n << 32n; // below this, a slot is a plain number

// The keccak value a computed slot is near, and its inputs
function derive(hashes, n) {
  for (const [h, args] of hashes) {
    const d = n - h;
    if (d >= 0n && d < 1n << 16n) return { d, args };
  }
}

// A plain name for a slot: "slot 1", or how the template computed it,
// e.g. "keccak(0xf39f…2266, slot 0) + 1".
export function slotName(m, s) {
  if (m.names?.has(s)) return m.names.get(s);
  const n = num(s);
  if (n < PLAIN) return `slot ${n}`;
  const k = derive(m.hashes, n);
  if (!k) return `slot ${short(s)}`;
  const a = k.args.map((x) =>
    x.name === "key"
      ? (x.value < PLAIN ? String(x.value) : short(word(x.value)))
      : slotName(m, word(x.value)));
  return `keccak(${a.join(", ")})${k.d ? ` + ${k.d}` : ""}`;
}

// "slot 1" or "slot 0x7230…a723": what the hover label calls a slot
const slotRef = (s) =>
  num(s) < 1n << 32n ? `slot ${num(s)}` : `slot ${short(s)}`;

// "bytes 24–31 of slot 0x7230…a723", for each slot a region touches
export function regionText(r) {
  const by = new Map();
  for (const [s, i] of regionBytes(r)) {
    if (!by.has(s)) by.set(s, [i, i]);
    by.get(s)[1] = i;
  }
  if (!by.size) return "no bytes";
  const parts = [...by].map(([s, [a, b]]) =>
    `${a === 0 && b === 31 ? "all 32 bytes" : a === b ? `byte ${a}`
      : `bytes ${a}–${b}`} of ${slotRef(s)}`);
  return parts.length <= 2 ? parts.join(", ")
    : `${parts[0]}, and ${parts.length - 1} more slots`;
}

// ------------------------------------------------------------ render

const pairs = (h) => (h ?? "0x" + "0".repeat(64)).slice(2).match(/../g);

// Runs of bytes with the same owners, in one word
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

// Byte numbers over the 32 bytes of a word: 0, 8, 16, 24
export const ruler = () =>
  `<div class="ruler" aria-hidden="true"><div class="bytes">${octets(
    Array.from({ length: 32 }, (_, i) =>
      `<span class="b">${i % 8 === 0 ? i : ""}</span>`))}</div></div>`;

// 32 byte cells as four groups of eight, so the word reads in parts
export const octets = (cells) =>
  [0, 8, 16, 24].map((k) =>
    `<span class="oct">${cells.slice(k, k + 8).join("")}</span>`).join("");

const empty = () => Array.from({ length: 32 }, () => []);

// One slot's word in one view, all 32 bytes on one line
function wordHtml(m, s, side, tint, name) {
  const { before, after } = m.f.slots[s];
  const mine = pairs(side === "before" ? before : after);
  const other = pairs(side === "before" ? after : before);
  const ids = m.cover[side].get(s) ?? empty();
  const cells = [];
  for (const g of groups(ids)) {
    const label = g.owners.map((id) => m.owners.get(id).label).join(", ");
    for (let i = g.from; i <= g.to; i++) {
      const cls = ["b"];
      if (g.owners.length) cls.push(`t${tint.get(g.owners[0]) % TINTS}`);
      else cls.push("free");
      if (i === g.from) cls.push("gs");
      if (i === g.to) cls.push("ge");
      if (mine[i] === "00") cls.push("z");
      if (mine[i] !== other[i]) cls.push("chg");
      const first = i === g.from && g.owners.length;
      const range = g.from === g.to ? `byte ${g.from}`
        : `bytes ${g.from} to ${g.to}`;
      cells.push(`<span class="${cls.join(" ")}" data-i="${i}"` +
        ` data-g="${g.from}-${g.to}"${g.owners.length
          ? ` data-owners="${esc(g.owners.join("|"))}"` : ""}` +
        `${first ? ` tabindex="0" role="button" aria-label="${esc(
          `${label}, ${range} of ${name}, ${side}`)}"` : ""}` +
        `>${mine[i]}</span>`);
    }
  }
  return `<div class="word" data-side="${side}" data-slot="${s}">` +
    `<div class="bytes">${octets(cells)}</div></div>`;
}

// "…0002": the end of a slot's address, as a dump shows it
const tail = (s) => `…${s.slice(-4)}`;

// Two dumps of storage, stacked: before the transaction, then after.
// Each is one column of words in address order, one word to a line,
// with the address in a narrow gutter and a gap line where the
// addresses jump. Names stay out of the dump: the tree and the line
// above relate to it by highlighting.
export function renderPanel(m) {
  const rows = m.order.map((s) => {
    const name = slotName(m, s);
    const n = num(s);
    // Owners in byte order, each with its tint, the same in both views
    const tint = new Map();
    for (const side of SIDES) {
      for (const ids of m.cover[side].get(s) ?? []) {
        for (const id of ids) if (!tint.has(id)) tint.set(id, tint.size);
      }
    }
    const { before, after } = m.f.slots[s];
    const zero = (w) => !w || /^0x0*$/.test(w);
    const same = !m.single && before === after;
    const rd = m.read.has(s);
    const wr = m.written.has(s);
    // What the transaction did to the slot, for the popover (nothing, at
    // one point)
    const facts = m.single ? "" : !wr ? (rd ? "read only"
      : "not read or written")
      : zero(after) && !zero(before) ? "cleared (written to zero)"
        : same ? "written, same value" : rd ? "read, written" : "written";
    // the one mark at rest: written without a change, which nothing
    // else would show
    const ring = !m.single && wr && same;
    return { s, n, name, tint, same, facts, ring };
  });
  const gap = `<div class="gap" aria-hidden="true"><span>⋯</span></div>`;
  const room = `<div class="gap room" aria-hidden="true"></div>`;
  const view = (side) => {
    const title = m.single ? "Storage" : side === "before" ? "Before"
      : "After";
    const lines = [];
    rows.forEach((x, k) => {
      const prev = rows[k - 1];
      // a gap line where the addresses jump; and room for a popover
      // before a hashed slot that starts a value right after another
      // slot (a "room" line, with no "⋯")
      // (nothing comes before slot 0: no line at all)
      if (k === 0 && x.n === 0n) {
        // slot 0 at the top
      } else if (k === 0 || x.n !== prev.n + 1n) lines.push(gap);
      else if (!/^slot \d+$|\+ \d+$/.test(x.name)) lines.push(room);
      const what = `${x.name}${x.name.startsWith("slot") ? "" : ` (slot ${
        short(x.s)})`}${x.facts ? `; ${x.facts}` : ""}`;
      lines.push(`<div class="wrow${x.same ? " same" : ""}${k % 2
        ? " zb" : ""}"` +
        ` data-slot="${x.s}" data-name="${esc(x.name)}"` +
        ` data-facts="${esc(x.facts)}"${x.name === slotRef(x.s) ? ""
          : ` data-full="= ${x.s}"`}>` +
        `<span class="addr" tabindex="0"` +
        ` aria-label="${esc(`${x.s}; ${what}`)}">${x.ring
          ? `<span class="ring"` +
          ` aria-label="written, same value"></span>` : ""}<span class="a">${
          tail(x.s)}</span></span>` +
        wordHtml(m, x.s, side, x.tint, x.name) + `</div>`);
    });
    lines.push(gap);
    return `<div class="view" data-side="${side}" role="group"` +
      ` aria-label="Storage ${esc(m.when[side])}">` +
      `<div class="view-head"><span class="view-name">${title}</span>` +
      `<div class="wrow head"><span class="addr"></span>${ruler()}</div>` +
      `</div><div class="rows">${lines.join("")}</div></div>`;
  };
  return `<p class="muted small swipe">Each word is one line of 32 bytes;
    scroll sideways to see bytes 24 to 31.</p>` +
    `<div class="views">${view("before")}${view("after")}</div>`;
}

// --------------------------------------------------------- highlight

// What to light up: byte keys "side|slot|i" and tree rows by path, plus
// the label to show. A byte hover also marks its position (at) in both
// views.
const key = (side, s, i) => `${side}|${s}|${i}`;

function ownerBytes(m, ids, into) {
  for (const id of ids) {
    const o = m.owners.get(id);
    if (!o) continue;
    for (const side of SIDES) {
      for (const r of o.regions[side]) {
        for (const [s, i] of regionBytes(r)) into.add(key(side, s, i));
      }
    }
  }
  return into;
}

// Where a value is: "bytes 24–31 of slot 0x7230…a723"
function whereText(o) {
  const b = o.regions.before.map(regionText).join("; ");
  const a = o.regions.after.map(regionText).join("; ");
  return !b || !a || a === b ? a || b : `before: ${b} · after: ${a}`;
}

// "before 0x0000 = 0 → after 0x012c = 300", or "0x01 = 1 (unchanged)"
const change = (b, a) => {
  if (b === a) return a === undefined ? "" : `${a} (unchanged)`;
  return `before ${b ?? "none"} → after ${a ?? "none"}`;
};

// The hex at bytes from..to of a slot, on one side
const hexAt = (m, s, side, from, to) =>
  "0x" + pairs(m.f.slots[s]?.[side]).slice(from, to + 1).join("");

// One side of a value: its hex (when it fits in one word) and its value
function sideText(m, o, side) {
  const rs = o.regions[side];
  if (!rs.length) return undefined;
  const t = o.text[side];
  const b = rs.length === 1 ? regionBytes(rs[0]) : [];
  if (b.length && b.every(([s]) => s === b[0][0])) {
    const h = hexAt(m, b[0][0], side, b[0][1], b[b.length - 1][1]);
    return t === undefined ? h : `${h} = ${t}`;
  }
  return t;
}

// ------------------------------------------------------ the details

const code = (x) => `<code>${esc(x)}</code>`;

// Where a region is, for the details: "slot …a723 (keccak(…) + 1),
// bytes 24–31", for each slot it touches
function regionHtml(m, r) {
  const by = new Map();
  for (const [s, i] of regionBytes(r)) {
    if (!by.has(s)) by.set(s, [i, i]);
    by.get(s)[1] = i;
  }
  if (!by.size) return "no bytes";
  const one = ([s, [a, b]]) => {
    const nm = slotName(m, s);
    const slot = num(s) < PLAIN ? `slot ${num(s)}`
      : `slot ${code(tail(s))} (${esc(nm)})`;
    return `${slot}, ${a === 0 && b === 31 ? "bytes 0–31"
      : a === b ? `byte ${a}` : `bytes ${a}–${b}`}`;
  };
  const all = [...by];
  return all.length <= 2 ? all.map(one).join("; ")
    : `${one(all[0])}, and ${all.length - 1} more slots`;
}

// One state of a value: "975 (0x…03cf)"
function stateHtml(m, o, side) {
  const rs = o.regions[side];
  if (!rs.length) return "none";
  const t = o.text[side];
  const b = rs.length === 1 ? regionBytes(rs[0]) : [];
  if (b.length && b.every(([s]) => s === b[0][0])) {
    const h = hexAt(m, b[0][0], side, b[0][1], b[b.length - 1][1]);
    const hs = h.length > 18 ? `0x…${h.slice(-6)}` : h;
    return t === undefined ? code(hs) : `${esc(t)} (${code(hs)})`;
  }
  return t === undefined ? "" : esc(t);
}

function ownerInfo(m, o) {
  const b = o.regions.before.map((r) => regionHtml(m, r)).join("; ");
  const a = o.regions.after.map((r) => regionHtml(m, r)).join("; ");
  if (m.single) {
    return [["Value", `${code(o.label)}${o.type ? ` (${esc(o.type)})`
      : ""}`], ["Where", a], ["Holds", stateHtml(m, o, "after")]];
  }
  return [
    ["Value", `${code(o.label)}${o.type ? ` (${esc(o.type)})` : ""}`],
    ...(!b || !a || a === b ? [["Where", a || b]]
      : [["Where before", b], ["Where after", a]]),
    ["Before", stateHtml(m, o, "before")],
    ["After", stateHtml(m, o, "after")],
  ];
}

// The details block under the dump: term and value rows, or a hint
export function details(h, hint) {
  if (!h) return `<p class="muted">${esc(hint)}</p>`;
  if (!h.info) return `<p>${esc(h.label)}</p>`;
  return `<dl>${h.info.map(([t, d]) => `<dt>${esc(t)}</dt><dd>${d}</dd>`)
    .join("")}</dl>`;
}

function ownerLabel(m, o) {
  const v = m.single ? sideText(m, o, "after") ?? ""
    : change(sideText(m, o, "before"), sideText(m, o, "after"));
  return `${o.label} · ${whereText(o)}${v ? ` · ${v}` : ""}`;
}

// One value, or a part of one (a string's length)
export function forOwner(m, id) {
  const o = m.owners.get(id);
  return { bytes: ownerBytes(m, [id], new Set()), rows: new Set([o.row]),
    label: ownerLabel(m, o), info: ownerInfo(m, o) };
}

// A tree row, and everything under it
export function forRow(m, path) {
  const ids = [...m.owners.values()]
    .filter((o) => o.row === path || o.row.startsWith(path + ".") ||
      o.row.startsWith(path + "["))
    .map((o) => o.id);
  const own = m.owners.get(path);
  const below = `${ids.length} value${ids.length === 1 ? "" : "s"} below`;
  const label = own ? ownerLabel(m, own) : `${path} · ${below}`;
  const info = own ? ownerInfo(m, own)
    : [["Value", `${code(shortKeys(path))}, ${below}`]];
  // (the row itself is lit too, in the selection colour, even when it
  // owns no bytes: a mapping, a struct)
  // the composites under it light too (an entry's key line, a member
  // that is itself a struct), each in its child's colour
  const under = (m.paths ?? []).filter((p) => p.startsWith(path + ".") ||
    p.startsWith(path + "["));
  const colors = childColors(m, path, ids);
  if (colors) {
    const child = (row) => row.slice(path.length)
      .match(/^(\.[^.[]+|\[[^\]]*\])/)?.[0];
    for (const p of under) {
      if (colors.has(p)) continue;
      const c = child(p);
      const k = [...colors].find(([q]) => q.slice(path.length)
        .startsWith(c))?.[1];
      if (k !== undefined) colors.set(p, k);
    }
  }
  // a variable whose own slot holds no data (a mapping's): that slot's
  // gutter shows its role, with its label; its bytes stay plain
  const gutters = new Set();
  for (const [slot, vars] of m.bases ?? []) {
    if (!vars.includes(path)) continue;
    const s = word(slot);
    const cov = m.cover.after.get(s) ?? m.cover.before.get(s);
    if (!cov?.some((ids) => ids.length)) gutters.add(s);
  }
  return { bytes: ownerBytes(m, ids, new Set()), rows: new Set([path,
    ...ids.map((id) => m.owners.get(id).row), ...under]), label, info, path,
    colors, gutters };
}

// The variable a slot links to when the slot is the variable's own but
// holds none of its data (a mapping's slot): its bytes and its address
// stand for that variable, as data bytes stand for their values
export function baseOf(m, s) {
  const v = m.bases?.get(BigInt(s))?.[0];
  if (!v) return null;
  const cov = m.cover.after.get(s) ?? m.cover.before.get(s);
  return cov?.some((ids) => ids.length) ? null : v;
}

// The colours of a composite's immediate children: each child (a
// mapping's entry, an array's element, a struct's member) gets one of
// the child colours (pk1 …, in tree order, cycling); everything under a
// child takes its colour. The selection colour (0, --mark) is the
// composite's own: its row and its own bytes (an array's length, a
// string's length word), never a child's. A leaf has no children: none
// (one colour, as before).
// Returns Map(tree path -> colour) or null.
export const PICKS = 10;
function childColors(m, path, ids) {
  const child = (row) => row.slice(path.length)
    .match(/^(\.[^.[]+|\[[^\]]*\])/)?.[0];
  const rows = ids.map((id) => m.owners.get(id).row);
  const kids = [...new Set(rows.map(child).filter(Boolean))];
  if (!kids.length) return null;
  const colors = new Map([[path, 0]]);
  for (const r of rows) {
    const c = child(r);
    colors.set(r, c ? 1 + kids.indexOf(c) % (PICKS - 1) : 0);
  }
  return colors;
}

// A run of bytes in one word, and the same positions in the other view
export function forBytes(m, cell) {
  const w = cell.closest(".word");
  const s = w.dataset.slot;
  const ids = (cell.dataset.owners ?? "").split("|").filter(Boolean);
  const [from, to] = cell.dataset.g.split("-").map(Number);
  const range = from === to ? `byte ${from}` : `bytes ${from}–${to}`;
  const nm = slotName(m, s);
  const where = `${range} of ${slotRef(s)}${nm === slotRef(s) ? ""
    : ` = ${nm}`}`;
  const at = { s, from, to };
  // Each side's hex, and the decoded value when this run is that value
  const val = (side) => {
    const h = hexAt(m, s, side, from, to);
    const o = ids.length === 1 && m.owners.get(ids[0]);
    const rs = o ? o.regions[side] : [];
    if (rs.length === 1 && o.text[side] !== undefined) {
      const b = regionBytes(rs[0]);
      if (b.length === to - from + 1 && b[0][0] === s && b[0][1] === from) {
        return `${h} = ${o.text[side]}`;
      }
    }
    return h;
  };
  const vals = m.single ? val("after") : change(val("before"), val("after"));
  const info = [
    ["Bytes", `${range} of ${num(s) < PLAIN ? `slot ${num(s)}`
      : `slot ${code(tail(s))} (${esc(nm)})`}`],
    ...(m.single ? [["Hex", code(hexAt(m, s, "after", from, to))]] : [
      ["Before", code(hexAt(m, s, "before", from, to))],
      ["After", code(hexAt(m, s, "after", from, to))]]),
  ];
  if (!ids.length) {
    return { bytes: new Set(), rows: new Set(), at,
      label: `${where} · ${vals} · no value shown owns these bytes`,
      info: [["Value", "none shown owns these bytes"], ...info] };
  }
  const names = ids.map((id) => m.owners.get(id).label).join(", ");
  const own = ids.length === 1 && m.owners.get(ids[0]);
  return { bytes: ownerBytes(m, ids, new Set()), at,
    rows: new Set(ids.map((id) => m.owners.get(id).row)), ids,
    label: `${names} · ${where} · ${vals}`,
    info: own ? [...ownerInfo(m, own), ["Pointed at", info[0][1]]]
      : [["Values", code(names)], ...info] };
}

// A whole slot, from its address in the gutter
export function forSlot(m, s) {
  const nm = slotName(m, s);
  const { before, after } = m.f.slots[s];
  const what = before === after ? "unchanged" : "changed";
  return { bytes: new Set(), rows: new Set(), at: { s, from: 0, to: 31 },
    label: `${slotRef(s)}${nm === slotRef(s) ? "" : ` = ${nm}`} · ${s}${
      m.single ? "" : ` · ${what}`}`,
    info: [["Slot", `${code(tail(s))}${nm === slotRef(s) ? ""
      : ` (${esc(nm)})`}`], ["Address", code(s)],
    ...(m.single ? [] : [["Transaction", what]])] };
}

// A step of a replay: its slots' whole rows and its regions' bytes, in
// one state (an empty step lights nothing, and the rest mutes)
export function forStep(m, side, { slots = [], regions = [] }) {
  const bytes = new Set();
  // a slot's bytes that values own (the rest stay muted, as unused);
  // all of a slot no value owns (a mapping's own slot)
  for (const s of slots) {
    const cov = m.cover[side].get(s);
    const owned = cov ? cov.map((ids, i) => ids.length ? i : -1)
      .filter((i) => i >= 0) : [];
    for (const i of owned.length ? owned : [...Array(32).keys()]) {
      bytes.add(key(side, s, i));
    }
  }
  for (const r of regions) {
    for (const [s, i] of regionBytes(r)) bytes.add(key(side, s, i));
  }
  return { bytes, rows: new Set(), step: true, label: "" };
}

// A region step of "How this was found"
export function forRegion(m, r, side, name) {
  const bytes = new Set();
  for (const [s, i] of regionBytes(r)) bytes.add(key(side, s, i));
  return { bytes, rows: new Set(), step: true,
    label: `${name ? `region ${name} · ` : ""}${regionText(r)} (${side})`,
    info: [["Region", name ? code(name) : "unnamed"],
      ["Where", regionHtml(m, r)], ["State", esc(m.when[side])]] };
}

// Put a popover at an address: its left edge on the gutter's, its arrow
// on the address; near an edge of what clips it (the panel, or the
// page), shift the body and keep the arrow where it is.
function place(pop, a, beside = false) {
  let clip = { left: 0, right: document.documentElement.clientWidth };
  for (let e = pop.parentElement.parentElement; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      const r = e.getBoundingClientRect();
      clip = { left: Math.max(clip.left, r.left),
        right: Math.min(clip.right, r.right) };
      break;
    }
  }
  pop.style.maxWidth = `${clip.right - clip.left - 8}px`;
  const at = a.getBoundingClientRect();
  const box = pop.parentElement.getBoundingClientRect();
  const w = pop.offsetWidth;
  const mid = at.left + at.width / 2;
  // 6px left of the gutter, as the cards; or (`beside`) just right of
  // it, over the bytes, clear of the addresses
  const g = a.closest(".addr").getBoundingClientRect();
  const gutter = beside ? g.right + 4 : g.left - 6;
  const left = Math.max(clip.left + 4, Math.min(gutter, clip.right - 4 - w));
  pop.style.left = `${left - box.left}px`;
  pop.style.setProperty("--ax", `${beside ? 8 : mid - left}px`);
  pop.classList.toggle("beside", beside);
}

// The lit rows of a dump, as runs: rows next to each other in the dump
// (consecutive addresses; a gap line ends a run). A row the value uses
// only in the other state counts too.
function runs(view) {
  const out = [];
  let run = null;
  for (const el of view.querySelector(".rows").children) {
    if (el.classList.contains("wrow") && (el.classList.contains("on") ||
      el.classList.contains("only") || el.classList.contains("known") ||
      el.classList.contains("gut"))) {
      if (!run) out.push(run = []);
      run.push(el);
    } else if (!el.classList.contains("cmp")) {
      run = null;
    }
  }
  return out;
}

// One name for a run of slots: "slot 0", "slots 0–2",
// "keccak(slot 0), 2 slots", or the names in turn
function runName(rows) {
  const names = rows.map((r) => r.dataset.name);
  if (names.length === 1) return names[0];
  const plain = names.map((n) => n.match(/^(slot|word) (\S+)$/));
  if (plain.every(Boolean)) {
    return `${plain[0][1]}s ${plain[0][2]}–${plain.at(-1)[2]}`;
  }
  const ps = names.map((n) => n.match(/^(.*?)(?: \+ (\d+))?$/));
  const k = ps.map((p) => BigInt(p[2] ?? 0));
  if (ps.every((p, i) => p[1] === ps[0][1] && k[i] === k[0] + BigInt(i))) {
    return `${ps[0][1]}${k[0] ? ` + ${k[0]}` : ""}, ${names.length} slots`;
  }
  return names.join(" · ");
}

// The slot popover for a run: how its slots were found, and what the
// transaction did to them
function popFor(rows, more) {
  const facts = [...new Set(rows.map((r) => r.dataset.facts))]
    .filter(Boolean);
  const pop = document.createElement("span");
  pop.className = "pop";
  pop.setAttribute("role", "status");
  pop.innerHTML = `<span class="pop-how">${esc(runName(rows))}${
    facts.length ? ` · ${esc(facts.join(" / "))}` : ""}${more
    ? ` · +${more} more` : ""}</span>`;
  return pop;
}

// A compare block for a run: a picture of the same rows in the OTHER
// dump, cloned as they are drawn there (tints, highlight, change marks,
// byte groups) and muted a little, in a card cropped to the run's lit
// columns, at the same size and in the same columns as the run. It
// floats over the neighboring rows: under the run in the Before dump (a
// picture of After), over it in the After dump (a picture of Before).
function block(root, rows, side, label) {
  const other = side === "before" ? "after" : "before";
  // only the words where a lit byte differs in the other state: no
  // card for what did not change
  const twins = rows.map((r) => {
    const t = root.querySelector(`.view[data-side="${other}"] ` +
      `.wrow[data-slot="${CSS.escape(r.dataset.slot)}"]`);
    if (!t) return null;
    const cells = (x) => [...x.querySelectorAll(":scope > .word .b")];
    const [mine, theirs] = [cells(r), cells(t)];
    const at = [...mine, ...theirs].filter((c) => c.classList.contains("hl"))
      .map((c) => +c.dataset.i);
    return at.some((i) => mine[i]?.textContent !== theirs[i]?.textContent)
      ? t : null;
  }).filter(Boolean);
  if (!twins.length) return null;
  const el = document.createElement("div");
  el.className = `cmp ${side}`;
  el.twins = twins;
  el.dataset.label = label;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<span class="cmp-tag">${esc(label)}</span>` +
    `<div class="cmp-frame"><div class="cmp-photo"></div></div>`;
  const photo = el.querySelector(".cmp-photo");
  for (const t of twins) {
    const c = t.cloneNode(true);
    c.querySelectorAll(".pop, .cmp").forEach((x) => x.remove());
    for (const x of [c, ...c.querySelectorAll("*")]) {
      for (const a of ["tabindex", "role", "aria-label", "title", "data-slot",
        "data-side", "data-owners", "data-g", "data-name", "data-facts",
        "data-full"]) x.removeAttribute(a);
    }
    c.dataset.of = t.dataset.slot; // which slot it pictures
    photo.append(c);
  }
  return el;
}

// Size and place a block: whole words, from the gutter (each line keeps
// its address) to the end of the 32 bytes; the picture's columns stay
// on the run's columns
function fit(el, rows) {
  const row = rows[0].getBoundingClientRect();
  const photo = el.querySelector(".cmp-photo");
  photo.style.width = `${row.width}px`;
  // 6px of room left of the addresses (CSS), 3px right of the bytes
  el.querySelector(".cmp-frame").style.width = `${row.width + 9}px`;
  el.style.left = "0px";
}

const overlaps = (a, b) => a.left < b.right - 0.5 && b.left < a.right - 0.5 &&
  a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5;

// Where annotations may go: inside the content of every box around the
// dumps that scrolls or clips, as it is before they are added, so a
// highlight never adds a scrollbar or grows a box. Measured once per
// paint, in screen coordinates.
function bounds(root) {
  const out = [];
  for (let e = root.querySelector(".views"); e && e !== document.body;
    e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.overflowX === "visible" && cs.overflowY === "visible") continue;
    const r = e.getBoundingClientRect();
    const top = r.top + e.clientTop - e.scrollTop;
    const left = r.left + e.clientLeft - e.scrollLeft;
    out.push({ top, left, bottom: top + e.scrollHeight,
      right: left + e.scrollWidth });
  }
  return out;
}
// (a card's few px of padding may hang past the left edge: overflow
// to the left never scrolls)
const inside = (r, bs) => bs.every((b) => r.top >= b.top - 0.5 &&
  r.bottom <= b.bottom + 0.5 && r.left >= b.left - 8 &&
  r.right <= b.right + 0.5);

// What an annotation covers on screen
const rects = (el) => [...el.querySelectorAll(".cmp-frame, .cmp-tag")]
  .map((e) => e.getBoundingClientRect())
  .concat(el.classList.contains("pop") ? [el.getBoundingClientRect()] : []);

// Keep `el` where it is on screen while `change()` moves things above
// it (a narrow page, where the derivation sits over the words): scroll
// the page, or the box that scrolls it, by as much as it moved.
export function steady(el, change) {
  if (!el?.isConnected) return change();
  const before = el.getBoundingClientRect().top;
  change();
  if (!el.isConnected) return;
  const delta = el.getBoundingClientRect().top - before;
  if (Math.abs(delta) < 0.5) return;
  let box = el.parentElement;
  while (box && !/(auto|scroll)/.test(getComputedStyle(box).overflowY)) {
    box = box.parentElement;
  }
  if (box && box !== document.documentElement) box.scrollTop += delta;
  else window.scrollBy(0, delta);
}

// While a value is selected, the view stays on it. A hover on its own
// bytes or rows only puts that detail in the info line; a derivation
// step (`step`) lights its region; any other hover is ignored (null).
// `sel` is the selection's highlight.
export function locked(h, sel) {
  if (!sel || !h || h.step) return h;
  const mine = h.rows.size && [...h.rows].every((r) => sel.rows.has(r));
  if (!mine) return null;
  // a selected composite: the one child pointed at (all its rows in one
  // colour) stays vivid, and the other children mute
  const ks = new Set([...h.rows].map((r) => sel.colors?.get(r)));
  const focus = sel.colors && ks.size === 1 ? [...ks][0] : undefined;
  return { ...sel, label: h.label, info: h.info, focus };
}

// A lit byte's or row's colour, from a composite's children (pk1 …):
// the first colour is the plain highlight, with no class
const pick = (el, k) => {
  for (let j = 1; j < PICKS; j++) el.classList.toggle(`pk${j}`, k === j);
  // a source of the step's input (a mapping key's list item)
  el.classList.toggle("pksrc", k === "src");
};

// Draw a highlight (or none) on the dumps and the tree. `names` names
// the two sides, as the compare blocks label them.
export function paint(root, tree, h, opts = {}) {
  root.querySelectorAll(".pop, .cmp, .tray, .bruler").forEach((p) =>
    p.remove());
  root.querySelectorAll(".addr.popped, .addr.grp").forEach((a) =>
    a.classList.remove("popped", "grp", "grp-top", "grp-end"));
  for (const w of root.querySelectorAll(".word[data-slot]")) {
    const side = w.dataset.side;
    const s = w.dataset.slot;
    const at = h?.at?.s === s ? h.at : null;
    let on = false;
    for (const c of w.querySelectorAll(".b")) {
      const i = +c.dataset.i;
      const hl = !!h && h.bytes.has(key(side, s, i));
      const isAt = !!at && i >= at.from && i <= at.to;
      c.classList.toggle("hl", hl);
      const k = hl && h.colors && (c.dataset.owners ?? "").split("|")
        .map((id) => h.colors.get(id.replace(/#length$/, "")))
        .find((x) => x !== undefined);
      pick(c, k);
      // (the selected item's own colour, 0, never mutes)
      c.classList.toggle("muted", hl && ((h.focus !== undefined &&
        !!k && k !== h.focus) || !!h.dim?.has(key(side, s, i))));
      c.classList.toggle("at", isAt);
      on ||= hl || isAt;
    }
    // one outline around each run of pointed-at bytes, not one per byte
    for (const c of w.querySelectorAll(".b")) {
      const at = c.classList.contains("at");
      const p = c.previousElementSibling, n = c.nextElementSibling;
      c.classList.toggle("at-s", at && !p?.classList.contains("at"));
      c.classList.toggle("at-e", at && !n?.classList.contains("at"));
    }
    // a slot the value uses only in the other state
    const o = side === "before" ? "after" : "before";
    const only = !on && !!h && [...Array(32).keys()].some((i) =>
      h.bytes.has(key(o, s, i)));
    w.closest(".wrow")?.classList.toggle("on", on);
    w.closest(".wrow")?.classList.toggle("only", only);
    // a slot a replay has derived by now, lit or not: it keeps its label
    // (its run's tint in the gutter, and its popover)
    w.closest(".wrow")?.classList.toggle("known", !on && !only &&
      !!h?.known?.has(s));
    w.closest(".wrow")?.classList.toggle("gut", !on && !only &&
      !!h?.gutters?.has(s));
  }
  // While something is lit, the rest steps back (style.css .active);
  // the active thing (a selection, a replay's step) gets the brown caps
  root.classList.toggle("active", !!h);
  root.classList.toggle("chosen", !!h && !!opts.chosen);
  tree.classList.toggle("active", !!h);
  for (const r of tree.querySelectorAll("li[data-path]")) {
    const on = !!h && h.rows.has(r.dataset.path);
    r.firstElementChild.classList.toggle("hl", on);
    const k = on && h.colors?.get(r.dataset.path);
    pick(r.firstElementChild, k);
    r.firstElementChild.classList.toggle("muted", on &&
      ((h.focus !== undefined && !!k && k !== h.focus) ||
        !!h.dimRows?.has(r.dataset.path)));
  }
  // A run of rows in one colour is one block: the outermost item whose
  // lit rows all have its colour carries the background (its key line
  // and its parts, one left edge, rounded at its ends)
  const colourOf = (row) => [...row.classList].find((c) => /^pk\d$/.test(c))
    ?? "pk0";
  for (const li of tree.querySelectorAll("li[data-path]")) {
    li.classList.remove("blk", "muted", ...[...li.classList].filter((c) =>
      /^pk\d$/.test(c)));
  }
  for (const li of tree.querySelectorAll("li[data-path]")) {
    const own = li.firstElementChild;
    if (!own.classList.contains("hl")) continue;
    if (li.parentElement.closest("li.blk")) continue;
    // (a block is a composite's rows; the selected row keeps its own
    // highlight and bar, as any row)
    // (nor a collapsed group: its one row shows; its fill is the row's)
    if (!li.querySelector("li[data-path]") || li.querySelector(".row.sel") ||
      li.classList.contains("collapsed")) {
      continue;
    }
    const ks = new Set([...li.querySelectorAll(".row.hl")].map(colourOf));
    if (ks.size !== 1) continue;
    const k = [...ks][0];
    li.classList.add("blk");
    if (k !== "pk0") li.classList.add(k);
    li.classList.toggle("muted", own.classList.contains("muted"));
  }
  const views = [...root.querySelectorAll(".view")].filter((v) => !v.hidden);
  // the other state's picture beside each lit run, in every mode
  // (unless turned off: `cards: false`)
  const compare = opts.cards !== false && !!h?.bytes.size;
  const names = { ...NAMES, ...opts };
  const lit = () => [...root.querySelectorAll(".b.hl")].map((c) =>
    c.getBoundingClientRect());
  // The tray is the same for Before and After: lay the hidden dump out
  // for a moment, and note the runs whose cards would not fit there
  const force = new Set();
  const hidden = [...root.querySelectorAll(".view")].filter((v) => v.hidden);
  if (compare && hidden.length === 1) {
    const hv = hidden[0];
    hv.hidden = false;
    const dry = annotate(root, hv, compare, names,
      document.createElement("div"), lit(), bounds(root));
    for (const { run, el } of dry) {
      if (el.classList.contains("cmp")) {
        for (const r of run) force.add(r.dataset.slot);
      }
    }
    hv.querySelectorAll(".pop, .cmp").forEach((p) => p.remove());
    hv.querySelectorAll(".addr.popped, .addr.grp").forEach((a) =>
      a.classList.remove("popped", "grp", "grp-top", "grp-end"));
    hv.hidden = true;
  }
  const tray = document.createElement("div");
  tray.className = "tray";
  // what no annotation may cover: lit bytes, and the annotations
  // already placed
  const taken = lit();
  // a replay step about bytes in a slot: their positions, 0 to 31, under
  // that slot (an overlay, like a popover)
  if (h?.ruler) {
    for (const v of views) {
      const row = v.querySelector(`.wrow[data-slot="${h.ruler}"]`);
      const w = row?.querySelector(":scope > .word");
      if (!w) continue;
      const el = document.createElement("div");
      el.className = "bruler";
      el.setAttribute("aria-hidden", "true");
      el.style.left = `${w.offsetLeft}px`;
      // (above the slot, over the "⋯" line before it, when there is one;
      // labelled, so it does not read as a slot's bytes)
      if (row.previousElementSibling?.classList.contains("gap")) {
        el.classList.add("above");
      }
      el.innerHTML = `<span class="blabel">byte</span><div class="bytes">${
        octets(Array.from({ length: 32 }, (_, i) =>
          `<span class="b">${i}</span>`))}</div>`;
      row.append(el);
      taken.push(el.getBoundingClientRect());
    }
  }
  const room = bounds(root);
  root.querySelector(".views")?.append(tray);
  for (const v of views) {
    annotate(root, v, compare, names, tray, taken, room, force);
  }
  if (!tray.childElementCount) tray.remove();
  else {
    // over the dumps' columns, at the bottom of the window
    const r = root.getBoundingClientRect();
    tray.style.left = `${Math.max(8, r.left)}px`;
    tray.style.width = `${Math.min(r.width,
      document.documentElement.clientWidth - 16)}px`;
  }
}


// The annotations of one dump, per run of lit rows. Before: the slot
// popover over the run, the compare block under it.
// After: the compare block over the run, the slot popover under it.
// One that would cover lit bytes or another annotation is not moved
// around: it goes, labeled, to the tray under the dumps.
// `force`: slots whose runs' cards go to the tray anyway (they do in
// the other state). Returns what went to the tray.
function annotate(root, v, compare, names, tray, taken, room, force) {
  const all = runs(v);
  if (!all.length) return [];
  const side = v.dataset.side;
  const other = side === "before" ? "after" : "before";
  const fits = (el) => {
    const rs = rects(el);
    if (rs.some((r) => taken.some((t) => overlaps(r, t)) ||
      !inside(r, room))) return false;
    taken.push(...rs);
    return true;
  };
  // the address labels of the lit rows, which no popover may cover (an
  // unlit row's may be covered, as by a card)
  const words = [...v.querySelectorAll(".rows > .wrow > .word")]
    .map((e) => ({ row: e.closest(".wrow"), r: e.getBoundingClientRect() }));
  const labels = [...v.querySelectorAll(
    ".rows > .wrow:is(.on, .only, .known) > .addr")]
    .map((e) => ({ row: e.closest(".wrow"), r: e.getBoundingClientRect() }));
  const pinned = [];
  for (const run of all) {
    // the run's addresses, tinted as one rounded group in the gutter
    run.forEach((r, k) => r.querySelector(":scope > .addr").classList.add(
      "grp", ...(k === 0 ? ["grp-top"] : []),
      ...(k === run.length - 1 ? ["grp-end"] : [])));
    // the slot popover, for every run (also one used only in the other
    // state): over the first row (Before) or under the last (After); if
    // that would cover lit bytes, a lit row's address or another
    // annotation, the other way; if both would, none. It may cover
    // unlit rows (a gap line, or a neighbour's dim bytes and address).
    {
      const pop = popFor(run, 0);
      // a run a replay found at an earlier step: a muted label
      if (run.every((r) => r.classList.contains("known"))) {
        pop.classList.add("kept");
      }
      // under the run (over it in Before), at the gutter; else beside the
      // gutter, over the bytes; then the other way. Never over another
      // row's address; it may cover unlit bytes.
      const ways = side === "before" ? ["over", "under"] : ["under", "over"];
      let placed = false;
      // (always at the gutter, its arrow on the address: only over or
      // under differs)
      for (const [way, beside] of ways.map((x) => [x, false])) {
        const prow = way === "over" ? run[0] : run.at(-1);
        const addr = prow.querySelector(".addr");
        pop.classList.toggle("under", way === "under");
        addr.append(pop);
        addr.classList.add("popped");
        place(pop, prow.querySelector(".a"), beside);
        const r = pop.getBoundingClientRect();
        // (a muted label, for a run found at an earlier step, covers no
        // other row's bytes either: it would hide data)
        const kept = pop.classList.contains("kept") && words.some((t) =>
          !run.includes(t.row) && overlaps(t.r, r));
        if (!kept && !labels.some((t) => !run.includes(t.row) &&
          overlaps(t.r, r)) && fits(pop)) {
          placed = true;
          break;
        }
        addr.classList.remove("popped");
      }
      if (!placed) pop.remove();
    }
    // the compare block: under the last row (Before), over the first
    // (After)
    const el = compare && block(root, run, side, names[other]);
    if (!el) continue;
    (side === "before" ? run.at(-1) : run[0]).append(el);
    fit(el, run);
    if (run.some((r) => force?.has(r.dataset.slot)) || !fits(el)) {
      el.classList.add("pinned");
      pinned.push({ run, el });
    }
  }
  for (const { run, el } of pinned) {
    const card = document.createElement("div");
    card.className = "pin";
    card.dataset.side = side;
    card.innerHTML = `<p class="pin-head">${esc(names.dumps[side])} dump · ${
      esc(runName(run))} · ${el.classList.contains("pop")
      ? "how the slots were found" : `the bytes ${esc(names[other])}`}` +
      " (no room beside the lit rows)</p>";
    card.append(el);
    tray.append(card);
    if (el.classList.contains("cmp")) fit(el, run);
  }
  return pinned;
}

const NAMES = {
  before: "before", after: "after",
  dumps: { before: "Before", after: "After" },
};
