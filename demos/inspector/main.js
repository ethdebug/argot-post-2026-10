// Storage inspection demo. Loads the fixtures, decodes each contract's
// storage before and after the transaction (decode.js), and draws it.
import {
  storageState, mappingKeys, decodeStorage, typeName, commit,
} from "./decode.js";
import {
  buildPanel, renderPanel, forRow, forBytes, forRegion, forSlot, paint,
  shortKeys, steady, initialHash, setHash, locked,
  details,
} from "./panel.js";

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
    ` data-short="${esc(short)}" title="${esc(h)}" tabindex="0">` +
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

let current; // the selected fixture: { f, tree, panel }

// Which state to show: "before" or "after" (one dump at a time)
let mode = "after";
// Whether to show the other state beside this one: the cards in the
// dump and the insets in the tree
let insets = true;
const WHEN = {
  before: "before the transaction",
  after: "after the transaction",
};

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
    // the shown state's value; the row says whether it changed
    val = `<span>${mode === "before" ? b : a}</span>`;
    val = `<span class="val ${valueChanged ? "chg" : "same"}">${val}</span>`;
  } else if (node.note) {
    val = `<span class="muted">${esc(node.note)}</span>`;
  }
  const kids = node.children?.length
    ? `<ul>${node.children.map((c) => row(c)).join("")}</ul>`
    : node.children && !node.before && !node.after
      ? `<p class="muted empty">no keys hashed in this transaction</p>`
      : "";
  const cls = node.changed ? "chg" : "same";
  const keyNote = node.key && node.key.toLowerCase().endsWith(
    current.f.tx.from.slice(2).toLowerCase()) ? " (sender)" : "";
  return `<li class="${cls}${top ? " top" : ""}"` +
    ` data-path="${esc(node.path)}">` +
    `<div class="row" tabindex="0" role="button" aria-pressed="false">` +
    `<span class="name">${esc(node.label)}${keyNote}</span>` +
    `<span class="type">${esc(tname)}</span>${val}</div>${kids}</li>`;
}

function renderTree() {
  $("tree").innerHTML =
    `<ul>${current.tree.map((n) => row(n, true)).join("")}</ul>`;
}

function render() {
  const { f } = current;
  $("summary").textContent = f.summary;
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
  renderTree();
  renderHow();
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


function renderHow() {
  const box = $("how");
  const node = chosen && find(current.tree, chosen);
  if (!node) {
    box.innerHTML = `<p class="muted howrest">Click any value in the tree,
      or a byte in the words, to see how the page found it.</p>`;
    return;
  }
  const { types } = current.f.contract;
  const type = types[node.typeId];
  const head = `<p class="howhead"><code>${esc(shortKeys(node.path))}</code>` +
    `${type ? ` <span class="type">${esc(typeName(type, types))}</span>`
      : ""}</p>`;
  if (!node.before && !node.after) {
    const n = node.children?.length ?? 0;
    box.innerHTML = head + `<p class="small">${node.note ? esc(node.note)
      : `This has no value of its own. ${n
        ? `Pick one of the ${n} values below it in the tree.`
        : "No values below it are shown."}`}</p>`;
    return;
  }
  const side = mode;
  const other = side === "before" ? "after" : "before";
  const v = node[side];
  if (!v) {
    box.innerHTML = head + `<p class="small">${WHEN[side][0].toUpperCase()
      }${WHEN[side].slice(1)}: ${esc(missing(node, side))}.</p>`;
    return;
  }
  // The other state's derivation, beside this one (unless "show other
  // state" is off): shared steps once, a step that evaluates
  // differently with both evaluations, and where the two take
  // different branches, the rest as two lists, this state's first
  const o = insets ? node[other] : null;
  const A = items(node, v, side);
  const B = o ? items(node, o, other) : null;
  let k = 0;
  while (B && k < A.length && k < B.length && A[k].key === B[k].key &&
    A[k].branch === B[k].branch) k++;
  const forked = B && (k < A.length || k < B.length);
  let shared = A;
  let fork = "";
  if (forked) {
    // the step where they part (same test, other branch) is shared
    if (A[k] && B[k] && A[k].key === B[k].key) k++;
    shared = A.slice(0, k);
    const label = (list, sd) => {
      const b = [...list.slice(0, k)].reverse().find((x) => x.branch);
      return `${sd}${b ? ` · ${b.branch} (${b.words})` : ""}`;
    };
    const branch = (list, sd, cls) => `<div class="branch ${cls}">` +
      `<p class="branch-head"><span class="ev-tag">${esc(label(list, sd))
      }</span></p><ol class="steps" start="${k + 1}"
      style="counter-reset: step ${k}">${list.slice(k)
        .map((x) => x.html).join("")}</ol></div>`;
    fork = branch(A, side, "mine") + branch(B, other, "theirs");
  }
  const dual = (x, i) => {
    const y = B?.[i];
    if (!y || y.key !== x.key || x.eval === y.eval) return x.html;
    const [b, a] = side === "before" ? [x, y] : [y, x];
    return x.html.replace(/<\/div><\/li>\s*$/, `<div class="evals">` +
      `<div><span class="ev-tag">before</span> ${b.eval}</div>` +
      `<div><span class="ev-tag">after</span> ${a.eval}</div></div>` +
      "</div></li>");
  };
  const same = B && !forked && A.every((x, i) => x.eval === B[i].eval);
  const whose = `<p class="howside">For the state <b>${WHEN[side]}</b>.` +
    `${same ? " The same steps find the same bytes in both states." : ""}` +
    "</p>";
  const note = v.how.context
    ? "The library read the region the program context gave."
    : "The library's dereference() returned these regions and read " +
      "them. The steps above replay the same template with the " +
      "library's evaluator; they agree.";
  box.innerHTML = head + whose + `<ol class="steps">${shared.map(dual)
    .join("")}</ol>` + fork + `<p class="muted small">${note}</p>`;
}

// The steps of one state's derivation, each with a key for its
// structure (what it does, not the values it finds), its evaluation in
// short, and the HTML of its list item
function items(node, v, side) {
  const { types } = current.f.contract;
  const r = v.region;
  const linked = (region) => ` data-region="${esc(JSON.stringify(region))}"` +
    ` data-side="${side}" tabindex="0"`;
  const out = [];
  if (v.how.context) {
    const { variable, slot, offset, length } = v.how.context;
    out.push({ key: "context", eval: "",
      html: `<li><span class="k">Start</span>
      <code>${esc(variable)}</code> is at slot ${hex(slot)}, ${length}
      bytes at offset ${offset} (from the high end of the word)
      <span class="tag">from the program context</span><br>
      solc emits no template for a value type at the top level: its
      pointer in the program context is the region.</li>` });
  } else {
    const { origin } = v.how;
    out.push({ key: "start", eval: "", html: `<li><span class="k">Start</span>
      <code>${esc(origin.variable)}</code> starts at slot
      ${hex(origin.slot)} <span class="tag">from the program context</span>
      ${origin.key ? `<br>Key ${hex(origin.key)}: this transaction hashed
      it with that slot <span class="tag">from the trace</span>` : ""}
      </li>` });
    const all = stepsOf(v);
    let i = 0;
    while (all[i]?.s.kind === "define") i++; // the page's own inputs
    for (const { s, region } of all.slice(i)) {
      // a region step lights its bytes in the words
      out.push({
        key: structure(s), eval: evaluation(s),
        branch: s.kind === "if" ? s.branch : undefined,
        words: s.kind === "if" ? branchWords(node, s) : undefined,
        html: stepHtml(s, types).replace(/^<li>/,
          region ? `<li${linked(region)}>` : "<li>"),
      });
    }
  }
  const bytes = (len) => {
    const o = Number(num(r.offset ?? "0x0"));
    const n = len ?? 32 - o;
    return o === 0 && n === 32 ? "the whole word"
      : `bytes ${o}–${o + n - 1} (offset ${o}, length ${n})`;
  };
  const len = r.length !== undefined ? Number(num(r.length)) : undefined;
  const raw = (h) => (h === "0x" ? "no bytes" : hex(h, 14));
  // each item as two columns: its kind, and the rest
  const cols = (html) => html.trim().replace(
    /^(<li[^>]*>)\s*(<span class="k">[^<]*<\/span>)([\s\S]*)<\/li>$/,
    '$1$2<div class="c">$3</div></li>');
  const done = (x) => ({ ...x, html: cols(x.html) });
  out.push({ key: "result", eval: `${raw(v.hex)} → <b>${esc(v.text)}</b>`,
    html: `<li class="final"${linked(r)}><span class="k">Result</span>
    ${esc(r.location)} slot ${hex(r.slot, 14)}, ${bytes(len)}.
    <div>Read ${WHEN[side]}: ${raw(v.hex)} → <b>${esc(v.text)}</b></div>
    </li>` });
  return out.map(done);
}

// What a step does, without the values it finds
function structure(s) {
  switch (s.kind) {
    case "template": return `template ${s.name}`;
    case "define": return `define ${s.id} ${JSON.stringify(s.expr)}`;
    case "list": return `list ${s.each} ${JSON.stringify(s.count.expr)}`;
    case "if": return `if ${JSON.stringify(s.cond.expr)}`;
    case "region": return `region ${s.name} ${JSON.stringify(
      s.fields.map((f) => [f.field, f.expr]))}`;
    default: return s.kind;
  }
}

// A step's evaluation, in short: its inputs, its value, its branch
function evaluation(s) {
  const ins = (x) => x.args ? `${x.args.map((a) => shown(a.value))
    .join(", ")} → ` : "";
  switch (s.kind) {
    case "define": return `${ins(s)}${shown(s.value)}`;
    case "if": return `${ins(s.cond)}${shown(s.cond.value)} → ${s.branch}`;
    case "list": return `item ${esc(s.index)} of ${shown(s.count.value)}`;
    case "region": return s.fields.map((f) =>
      `${f.field} ${shown(f.value)}`).join("; ");
    default: return "";
  }
}

function stepHtml(s, types) {
  switch (s.kind) {
    case "template": {
      const t = types[s.name];
      const what = t ? ` for <b>${esc(typeName(t, types))}</b>` : "";
      const rule = current.f.contract.pointers[s.name];
      return `<li><span class="k">Template</span> solc's rule${what},
        <code class="wrap">${esc(s.name)}</code>. It expects
        ${s.expect.map((x) => `<code>${esc(x)}</code>`).join(" and ")}.
        <details><summary>The rule as solc wrote it</summary>
        <pre>${esc(JSON.stringify(rule, null, 1))}</pre></details></li>`;
    }
    case "define":
      return `<li><span class="k">Define</span> <code>${esc(s.id)}</code>
        = ${expr(s.expr)} = ${shown(s.value)}${args(s)}</li>`;
    case "list":
      return `<li><span class="k">Item</span> <code>${esc(s.each)}</code>
        = <b>${esc(s.index)}</b>, of ${expr(s.count.expr)} =
        ${shown(s.count.value)} items</li>`;
    case "if":
      return `<li><span class="k">If</span> ${expr(s.cond.expr)} =
        ${shown(s.cond.value)}, so take <b>${s.branch}</b>${args(s.cond)}
        </li>`;
    case "region":
      return `<li><span class="k">Region</span> <code>${esc(s.name)}</code>:
        ${s.fields.map((x) => `${x.field} ${expr(x.expr)} =
          ${shown(x.value)}${args(x)}`).join("; ")}</li>`;
    default:
      return "";
  }
}

const args = (s) =>
  s.args
    ? `<div class="args">where ${s.args.map((a) =>
      `${expr(a.expr)} = ${shown(a.value)}`).join(", ")}</div>`
    : "";

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
  const h = hover ?? sel;
  paint($("panel"), $("tree"), h, { cards: insets });
  treeCard(h);
  for (const r of $("tree").querySelectorAll("li[data-path] > .row")) {
    const on = r.parentElement.dataset.path === chosen;
    r.classList.toggle("sel", on);
    r.setAttribute("aria-pressed", String(on));
  }
  $("details").innerHTML = details(h, PROBE);
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
  const node = insets && path && find(current.tree, path);
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
  steady(anchor, () => {
    markSource(node);
    renderHow();
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
  const step = el.closest("#how li[data-region]");
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
  if (e.target.closest?.("#memory")) {
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
  if (!current || t.closest("#memory")) return;
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
  if (act(t)) return;
  // Empty space clears the selection; controls, text and the panels
  // that explain do not
  if (t.closest("#how, #picker, #details, #src, .addr, .tray, a, " +
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
    const f = document.activeElement;
    if (chosen && !f?.closest?.("#memory")) choose(null);
    return;
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
  const keys = mappingKeys(f.trace.kept);
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

// The view in the URL hash: example, mode, selected variable
let restored = false; // until the hash is read back, do not write it
const exId = (id) => id.split("-")[0]; // "strings-update" -> "strings"
function keep() {
  if (!restored || !current) return;
  setHash({ ex: exId(current.id), mode, sel: chosen,
    insets: insets ? null : "0" });
}

const loaded = {};
let index = []; // the examples shown, from fixtures/index.json
let wanted; // the example asked for last
// gray lines in the tree while an example's data loads
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

// Show an example. Its data is fetched the first time (with progress in
// the bar at the top); until then the picker shows the choice and the
// tree waits. Returns false when the data did not load.
window.select = async (id) => {
  wanted = id;
  for (const b of $("picker").querySelectorAll("button")) {
    b.setAttribute("aria-checked", String(b.dataset.id === id));
  }
  if (!loaded[id]) {
    const x = index.find((e) => e.id === id);
    $("tree").innerHTML = SKELETON;
    $("summary").textContent = x?.summary ?? "";
    let f;
    try {
      f = await window.loading.load(`fixtures/${id}.json`,
        { label: x ? `“${x.title}”` : id });
    } catch (e) {
      if (wanted === id) {
        window.loading.fail(e, () => window.select(id));
        $("tree").innerHTML = `<p class="error">${esc(e.message)}` +
          ` <button type="button" class="btn">Retry</button></p>`;
        $("tree").querySelector("button").onclick = window.loading.retry;
      }
      return false;
    }
    const tree = await decode(f);
    loaded[id] = { id, f, tree, panel: buildPanel(f, tree) };
    record(id, tree);
  }
  if (wanted !== id) return true; // another example was asked for since
  current = loaded[id];
  render();
  keep();
  firstShown();
  return true;
};

// After the page is usable, fetch the other examples one at a time while
// the browser is idle and nothing else is loading
function prefetch(ids) {
  const idle = window.requestIdleCallback ??
    ((f) => setTimeout(f, 200));
  const next = () => idle(() => {
    if (!ids.length) return;
    if (window.loading.busy()) return setTimeout(next, 500);
    window.loading.load(`fixtures/${ids.shift()}.json`, { quiet: true })
      .catch(() => {}).then(next);
  });
  next();
}

async function main() {
  index = (await window.loading.load("fixtures/index.json"))
    .filter((x) => !x.hidden);
  $("picker").innerHTML = index.map((x) =>
    `<button role="radio" data-id="${esc(x.id)}">${esc(x.title)}</button>`)
    .join("");
  $("picker").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) window.select(b.dataset.id).catch(fail);
  });
  // Back to what the URL hash says, if it still makes sense
  const h = initialHash;
  const ex = index.find((x) => x.id === h.get("ex") ||
    exId(x.id) === h.get("ex")) ?? index[0];
  // (an old "compare" shows After)
  if (["before", "after"].includes(h.get("mode"))) mode = h.get("mode");
  insets = h.get("insets") !== "0";
  $("insets").checked = insets;
  // the first example (after a failure, once Retry or a pick shows one)
  window.select(ex.id);
  await ready;
  $("meta").innerHTML =
    `@ethdebug/pointers from main (commit <code>${commit.slice(0, 9)}` +
    "</code>), pending release." + ` Compiled with solc ${esc(
    current.f.contract.compiler.split("+")[0])} (Walnut's fork, ` +
    "walnuthq/solidity PR #10).";
  applyMode();
  const sel = h.get("sel");
  if (sel && current.id === ex.id && find(current.tree, sel)) {
    choose(sel, null, true);
  }
  restored = true;
  keep();
  window.results.usable = performance.now();
  window.results.done = true;
  prefetch(index.map((x) => x.id).filter((id) => !loaded[id]));
}

function fail(e) {
  console.error(e);
  window.results.errors.push(String(e?.message ?? e));
  $("tree").innerHTML = `<p class="error">Could not decode: ${esc(
    e?.message ?? e)}</p>`;
  window.results.done = true;
}

main().catch(fail);
