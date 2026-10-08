// A variable's pointer, and the templates it uses, as YAML (vanilla
// main.js pointerYaml): as solc wrote them, the template names shortened
// to their types' names; one line each, nothing wraps (leaf regions and
// expressions in flow style; a line too long for the box in block
// style). Each line keeps its place in the pointer (`pos`: its block,
// "" for the variable's own pointer or a template's id, and its path of
// keys), as the dereference graph names a node's place, and tags for
// what it is part of.
import type { Compilation, Format } from "./types";
import { typeName } from "./values";

export interface PointerLine { text: string; tags: string[]; pos: string }
type Any = any;

const isExpr = (v: Any) => v && typeof v === "object" && !Array.isArray(v) &&
  Object.keys(v).length === 1 && Object.keys(v)[0].startsWith("~");
const isRegion = (v: Any) => v && typeof v === "object" && "location" in v;
const allScalar = (v: Any) => v && typeof v === "object" &&
  !Array.isArray(v) && Object.values(v).every((x) => typeof x !== "object");
// (a region's keys in the spec's order: name, location, slot, offset,
// length)
const ORDER = ["name", "location", "slot", "offset", "length"];
const entriesOf = (v: Any): [string, Any][] => isRegion(v)
  ? Object.entries(v).sort(([a], [b]) =>
    (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
  : Object.entries(v);
// (`rename` gives a template's short name: for the value of every
// `template` key, at any depth)
function flowOf(v: Any, rename?: (n: string) => string,
  isTemplate = false): string {
  if (typeof v === "string") return isTemplate ? rename?.(v) ?? v : v;
  if (typeof v !== "object") return String(v);
  if (Array.isArray(v)) {
    return `[${v.map((x) => flowOf(x, rename)).join(", ")}]`;
  }
  return `{ ${entriesOf(v).map(([k, x]) => `${k}: ${flowOf(x, rename,
    k === "template")}`).join(", ")} }`;
}

// a line's width: what fits the pointer's box
const WIDE = 80;
const COND = ["if", "then", "else"];

export function pointerText(c: Compilation, variable: string):
  { lines: PointerLine[]; names: Record<string, string> } {
  const pointers = c.templates as Record<string, Any>;
  const types = c.types as Record<string, Format.Type>;
  const v = c.stateVariables.find((x) => x.identifier === variable);
  if (!v) return { lines: [], names: {} };
  const names: Record<string, string> = {};
  const short = (n: string) => {
    if (!pointers[n]) return n;
    return names[n] ??= types[n] ? typeName(types[n], types) : n;
  };
  const lines: PointerLine[] = [];
  let blk = "";
  const put = (d: number, text: string, tags: string[], pos = "") =>
    lines.push({ text: "  ".repeat(d) + text, tags, pos: `${blk}|${pos}` });
  const sub = (pos: string, k: string | number) =>
    pos === "" ? String(k) : `${pos}.${k}`;
  const todo: string[] = [];
  // (keys in the spec's order: a conditional's if, then, else; a
  // region's name, location, slot, offset, length)
  const ordered = (o: Any): [string, Any][] => "if" in o
    ? Object.entries(o).sort(([a], [b]) =>
      (COND.indexOf(a) + 1 || 9) - (COND.indexOf(b) + 1 || 9))
    : entriesOf(o);
  const flowFits = (k: string, x: Any, d: number) =>
    `${"  ".repeat(d)}${k}: ${flowOf(x, short, k === "template")}`.length
      <= WIDE;
  const block = (o: Any, d: number, tags: string[], pos = "") => {
    for (const [k, x] of ordered(o)) {
      const at = sub(pos, k);
      const own = k === "define" ? [`define:${Object.keys(x)[0]}`]
        : k === "if" ? ["if"] : k === "expect" ? ["expect"] : [];
      if (k === "template") todo.push(x);
      // (and a template named inside a value written in flow style)
      const inner = (y: Any) => y && typeof y === "object" &&
        Object.entries(y).forEach(([kk, vv]) => kk === "template"
          ? todo.push(vv as string) : inner(vv));
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
          [...tags, ...own, ...(isRegion(x) ? [`region:${x.name}`] : [])],
          at);
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
  const item = (y: Any, d: number, tags: string[], pos: string) => {
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
  const ptr = v.pointer as Any;
  block(ptr, 1, ["var"]);
  // a mapping, array or string variable: its type's template, which the
  // decoding applies to its pointer
  const typeId = (v.type as { id?: string }).id;
  if (!ptr.in && typeId && pointers[typeId]) todo.unshift(typeId);
  const done = new Set<string>();
  while (todo.length) {
    const n = todo.shift()!;
    if (done.has(n) || !pointers[n]) continue;
    done.add(n);
    const kind = (types[n] as Any)?.kind ?? "template";
    blk = n;
    put(0, "", [], "-");
    put(0, `${short(n)}:`, [`t:${kind}`, "head"]);
    block(pointers[n], 1, [`t:${kind}`]);
  }
  return { lines, names };
}

// The lines of a band: places in the pointer ("=" for that line alone,
// "~" for the lines with that tag, else the line and everything under
// it)
export function band(lines: PointerLine[], places: string[]): number[] {
  const on = (l: PointerLine) => places.some((p) => p.startsWith("=")
    ? l.pos === p.slice(1) : p.startsWith("~") ? l.tags.includes(p.slice(1))
      : l.pos === p || l.pos.startsWith(p + "."));
  return lines.map((l, i) => on(l) ? i : -1).filter((i) => i >= 0);
}
