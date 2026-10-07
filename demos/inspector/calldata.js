// The calldata of a transaction whose function takes one string
// parameter (setMotto(string m) here), laid out like the storage
// dump: the selector, then 32-byte words by offset. Its labels come from
// the ABI encoding rules, not from ethdebug: solc's ethdebug output (the
// Walnut fork used here) gives no pointer for a function parameter at
// any instruction, and no calldata type or template. So the steps below
// are the ABI's, and this file computes them itself.
import { octets, ruler, details } from "./panel.js";

const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const at = (n) => `0x${n.toString(16).padStart(4, "0")}`;

// The layout of the calldata: its parts, each with a byte range
// (`from`, `to`) and a value. Today it comes from the ABI encoding
// (calldataParts, below); when the compiler gives a pointer for the
// parameter, a layout made from the regions the pointer library returns
// takes its place (showCalldata's `layout`), and the rest of this file
// stays as it is.
//
// The parts of f(string m)'s calldata, by the ABI encoding: the
// selector; m's head word, which holds the offset of m's data from byte
// 4; at that offset, m's length; then m's bytes, padded with zeros to a
// whole word
export function calldataParts(input, param = "m") {
  const hex = input.slice(2);
  const bytes = hex.match(/../g);
  const word = (i) => BigInt("0x" + hex.slice(i * 2, i * 2 + 64));
  const offset = Number(word(4));
  const lenAt = 4 + offset;
  const length = Number(word(lenAt));
  const dataAt = lenAt + 32;
  const text = new TextDecoder().decode(new Uint8Array(bytes
    .slice(dataAt, dataAt + length).map((b) => parseInt(b, 16))));
  const parts = [
    { id: "selector", row: "selector", label: "selector", from: 0, to: 3,
      value: "0x" + hex.slice(0, 8) },
    { id: "m-offset", row: "m.offset", label: `${param} (offset)`, from: 4,
      to: 35, value: String(offset) },
    { id: "m-length", row: "m.length", label: `${param} (length)`, from: lenAt,
      to: lenAt + 31, value: String(length) },
    { id: "m-data", row: "m.data", label: `${param} (bytes)`, from: dataAt,
      to: dataAt + length - 1, value: JSON.stringify(text) },
  ];
  return { bytes, parts, offset, lenAt, length, dataAt, text, param };
}

let cd; // { parts, bytes, ... } for the transaction shown
let hover = null; // a part id, or "m" (all of m's parts)
let chosen = null;

const ids = (k) => (k === "m" ? ["m-offset", "m-length", "m-data"]
  : k ? [k] : []);
const partAt = (i) => cd.parts.find((p) => i >= p.from && i <= p.to);

// One line of the dump: the selector's 4 bytes, or a word from `start`
function line(start, n, zb) {
  const cells = [];
  for (let k = 0; k < 32; k++) {
    const i = start + k;
    if (k >= n) {
      cells.push('<span class="b"></span>');
      continue;
    }
    const p = partAt(i);
    const cls = ["b", p ? `t${cd.parts.indexOf(p)}` : "free"];
    if (!p || p.from === i) cls.push("gs");
    if (!p || p.to === i) cls.push("ge");
    if (cd.bytes[i] === "00") cls.push("z");
    cells.push(`<span class="${cls.join(" ")}" data-i="${i}"${p
      ? ` data-part="${p.id}"${p.from === i ? ' tabindex="0" role="button"' +
        ` aria-label="${esc(p.label)}"` : ""}` : ""}>${cd.bytes[i]}</span>`);
  }
  return `<div class="wrow${zb ? " zb" : ""}" data-at="${start}">` +
    `<span class="addr"><span class="a">${at(start)}</span></span>` +
    `<div class="word"><div class="bytes">${octets(cells)}</div></div></div>`;
}

function row(p, name, type) {
  return `<li data-part="${p.id}"><div class="row" tabindex="0"
    role="button" aria-pressed="false"><span class="name">${name}</span>
    <span class="type">${type}</span><span class="val"><span>${esc(
    p.value)}</span></span></div></li>`;
}

function render() {
  const [sel, off, len, data] = cd.parts;
  $("ctree").innerHTML = `<ul>${row(sel, "selector", "bytes4")
    .replace("<li", '<li class="top"')}<li class="top" data-part="m">
    <div class="row" tabindex="0" role="button" aria-pressed="false">
    <span class="name">${esc(cd.param)}</span><span class="type">string calldata</span>
    <span class="val"><span>${esc(data.value)}</span></span></div><ul>${
    row(off, "offset", "uint256")}${row(len, "length", "uint256")}${
    row(data, "bytes", "bytes")}</ul></li></ul>`;
  const lines = [line(0, 4, false)];
  for (let s = 4, k = 1; s < cd.bytes.length; s += 32, k++) {
    lines.push(line(s, Math.min(32, cd.bytes.length - s), k % 2));
  }
  $("cpanel").innerHTML = `<div class="views"><div class="view"
    data-side="after" role="group" aria-label="Calldata"><div
    class="view-head"><span class="view-name">Calldata</span><div
    class="wrow head"><span class="addr"></span>${ruler()}</div></div>
    <div class="rows">${lines.join("")}</div></div></div>`;
  const step = (p, k, html) => `<li data-part="${p.id}" tabindex="0">` +
    `<span class="k">${k}</span><div class="c">${html}</div></li>`;
  $("chow").innerHTML = `<p class="howside">By the ABI encoding of
    <code>${esc(cd.signature)}</code>, not by ethdebug.</p>
    <ol class="steps">${[
    step(sel, "Selector", `bytes 0–3: <b>${esc(sel.value)}</b>, the first
      4 bytes of keccak256("${esc(cd.signature)}")`),
    step(off, "Head", `<code>${esc(cd.param)}</code> is the first argument, so its head
      word is at ${at(4)}. A string is dynamic: the word holds the offset
      of its data, counted from byte 4: <b>${cd.offset}</b>`),
    step(len, "Length", `at 4 + ${cd.offset} = ${at(cd.lenAt)}: the
      length, <b>${cd.length}</b> bytes`),
    step(data, "Bytes", `at ${at(cd.dataAt)}: ${cd.length} bytes, padded
      with zeros to a whole word → <b>${esc(data.value)}</b>`),
  ].join("")}</ol>`;
  paint();
}

function paint() {
  const k = hover ?? chosen;
  const lit = new Set(ids(k));
  const root = $("cpanel");
  for (const c of root.querySelectorAll(".b[data-i]")) {
    c.classList.toggle("hl", lit.has(c.dataset.part));
  }
  for (const r of root.querySelectorAll(".wrow[data-at]")) {
    r.classList.toggle("on", !!r.querySelector(".b.hl"));
  }
  root.classList.toggle("active", lit.size > 0);
  $("ctree").classList.toggle("active", lit.size > 0);
  for (const li of $("ctree").querySelectorAll("li[data-part]")) {
    const on = li.dataset.part === k || (k === "m" &&
      ids("m").includes(li.dataset.part)) || (li.dataset.part === "m" &&
      ids("m").includes(k));
    const r = li.querySelector(":scope > .row");
    r.classList.toggle("hl", lit.size > 0 && on);
    r.classList.toggle("sel", li.dataset.part === chosen);
    r.setAttribute("aria-pressed", String(li.dataset.part === chosen));
  }
  for (const s of $("chow").querySelectorAll("li[data-part]")) {
    s.classList.toggle("hl", lit.has(s.dataset.part));
  }
  const p = cd.parts.find((x) => x.id === k);
  $("cdetails").innerHTML = details(k && {
    info: k === "m"
      ? [["Value", `<code>${esc(cd.param)}</code> (string calldata)`],
        ["Where", cd.parts.slice(1).map((x) =>
          `${esc(x.label)}: bytes ${at(x.from)}–${at(x.to)}`).join("; ")],
        ["Holds", esc(cd.parts[3].value)]]
      : [["Value", `<code>${esc(p.label)}</code>`],
        ["Where", `bytes ${at(p.from)}–${at(p.to)}`],
        ["Holds", esc(p.value)]],
  }, "Point at a part or a byte for its details.");
  window.calldataResults = { lit: [...lit], chosen };
}

// The part an element stands for: a byte, a tree row, a step
function partOf(el) {
  const c = el.closest?.("#cpanel .b[data-part], #chow li[data-part]");
  if (c) return c.dataset.part;
  const li = el.closest?.("#ctree li[data-part]");
  return li && el.closest(".row") ? li.dataset.part : null;
}

// Show the calldata of a transaction, or hide the section (null).
// `signature`: the function's, e.g. "setMotto(string)"; `param`: the
// string parameter's name.
export function showCalldata(input,
  { signature, param, layout = calldataParts } = {}) {
  $("calldata").hidden = !input;
  if (!input) return;
  cd = { ...layout(input, param), signature };
  hover = null;
  chosen = null;
  render();
}

function over(e) {
  if (!cd || $("calldata").hidden) return;
  const k = e.target.closest?.("#calldata") ? partOf(e.target) : null;
  if (k !== hover) {
    hover = k;
    paint();
  }
}
document.addEventListener("pointerover", over);
document.addEventListener("focusin", over);
// A click (or Enter) on a byte or a row selects its part; again, or
// Escape, clears it
function act(el) {
  const k = partOf(el);
  if (!k || el.closest("#chow")) return false;
  chosen = chosen === k ? null : k;
  hover = null;
  paint();
  return true;
}
document.addEventListener("click", (e) => {
  if (!cd || !e.target.closest?.("#calldata")) return;
  if (!act(e.target) && !e.target.closest("#chow, #cdetails") && chosen) {
    chosen = null;
    paint();
  }
});
document.addEventListener("keydown", (e) => {
  if (!cd || !e.target.closest?.("#calldata")) return;
  if (e.key === "Escape" && chosen) {
    chosen = null;
    paint();
  } else if ((e.key === "Enter" || e.key === " ") && act(e.target)) {
    e.preventDefault();
  }
});
