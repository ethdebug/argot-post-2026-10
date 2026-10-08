// Storage decoding with @ethdebug/pointers. Shared by the page (main.js)
// and the fixture script (bin/make-fixtures.mjs).
//
// Values come from dereference() and Cursor.View.read(). The derivation
// steps come from replay(), which walks the same template and asks the
// library's own evaluate() for each expression. Each replayed region must
// equal the region that dereference() returned, or decoding stops.
//
// On the page, index.html loads the library first (with progress) and
// puts it on globalThis.ethdebugPointers; in node, it is imported here.
const { dereference, Data, evaluate, commit } =
  globalThis.ethdebugPointers ?? await import("./vendor/pointers.js");

export { commit };

const word = (n) => "0x" + n.toString(16).padStart(64, "0");
const toHex = (bytes) =>
  "0x" + [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
const toBig = (bytes) => BigInt(toHex(bytes) === "0x" ? "0x0" : toHex(bytes));
const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// -------------------------------------------------------------- state

// A Machine.State with storage only. `readWord(slotHex)` gives the
// 32-byte word at a slot as hex.
export function storageState(readWord) {
  const none = (what) => {
    throw new Error(`${what} is not part of this state`);
  };
  return {
    storage: {
      async read({ slot, slice }) {
        const w = Data.fromHex(await readWord(word(slot.asUint())))
          .resizeTo(32);
        if (!slice) return w;
        const o = Number(slice.offset);
        return Data.fromBytes(w.slice(o, o + Number(slice.length)));
      },
    },
    // dereference() reads the stack length up front, even for storage
    stack: {
      get length() {
        return Promise.resolve(0n);
      },
      peek: () => none("stack"),
    },
    get memory() { return none("memory"); },
    get calldata() { return none("calldata"); },
    get returndata() { return none("returndata"); },
    get transient() { return none("transient"); },
    get code() { return none("code"); },
    get traceIndex() { return Promise.resolve(0n); },
    get programCounter() { return Promise.resolve(0n); },
    get opcode() { return Promise.resolve("STOP"); },
  };
}

// --------------------------------------------------------------- trace

const big = (h) => BigInt(h.startsWith("0x") ? h : "0x" + h);

// Mapping keys, from the KECCAK256 inputs in a trace: a mapping hashes
// key ++ base slot. Returns Map(base slot word -> [{ key, step }]).
export function mappingKeys(steps) {
  const byBase = new Map();
  for (const s of steps) {
    if (s.op !== "KECCAK256" && s.op !== "SHA3") continue;
    const st = s.stack;
    const offset = Number(big(st[st.length - 1]));
    const size = Number(big(st[st.length - 2]));
    if (size <= 32) continue;
    const mem = s.memory.map((w) => w.replace(/^0x/, "")).join("");
    const pre = mem.slice(offset * 2, (offset + size) * 2);
    if (pre.length < size * 2) continue;
    const base = "0x" + pre.slice(-64);
    const key = "0x" + pre.slice(0, -64);
    if (!byBase.has(base)) byBase.set(base, []);
    const list = byBase.get(base);
    if (!list.some((k) => k.key === key)) list.push({ key, pc: s.pc });
  }
  return byBase;
}

// Storage slots a trace touched: first SLOAD value and last SSTORE value.
// Each step has `stack` and, for SLOAD, `pushed` (the value it loaded).
export function touchedSlots(steps) {
  const slots = new Map();
  for (const s of steps) {
    if (s.op !== "SLOAD" && s.op !== "SSTORE") continue;
    const st = s.stack;
    const slot = word(big(st[st.length - 1]));
    if (!slots.has(slot)) slots.set(slot, {});
    const e = slots.get(slot);
    if (s.op === "SLOAD" && e.loaded === undefined && e.stored === undefined) {
      e.loaded = word(big(s.pushed));
    }
    if (s.op === "SSTORE") e.stored = word(big(st[st.length - 2]));
  }
  return slots;
}

// --------------------------------------------------------------- types

// A state variable's base slot, from its pointer in the program-level
// context: a region's `slot`, or the `slot` a template is given
export const baseSlot = (variable) => {
  const p = variable.pointer;
  return word(BigInt(p.slot ?? p.define?.slot));
};
const inStorage = (variable) => {
  const p = variable.pointer;
  return p.location === "storage" || p.define?.slot !== undefined;
};

const resolve = (type, types) =>
  type.kind === "alias" ? resolve(types[type.contains.type.id], types) : type;
const isDynBytes = (t) =>
  t.kind === "string" || (t.kind === "bytes" && t.size === undefined);
const isValue = (t) =>
  !["struct", "mapping", "array", "string", "bytes"].includes(t.kind) ||
  (t.kind === "bytes" && t.size !== undefined);

const signed = (v, bits) =>
  v >= 1n << BigInt(bits - 1) ? v - (1n << BigInt(bits)) : v;

// Decode bytes by ethdebug type. Returns display text.
export function decodeValue(type, bytes, types) {
  switch (type.kind) {
    case "uint":
      return toBig(bytes).toString();
    case "int":
      return signed(toBig(bytes), type.bits ?? bytes.length * 8).toString();
    case "bool":
      return toBig(bytes) === 0n ? "false" : "true";
    case "address":
    case "contract":
      return "0x" + toHex(bytes).slice(2).padStart(40, "0").slice(-40);
    case "enum": {
      const i = Number(toBig(bytes));
      return `${type.values?.[i] ?? "?"} (${i})`;
    }
    case "alias":
      return decodeValue(types[type.contains.type.id], bytes, types);
    case "string":
      return JSON.stringify(new TextDecoder().decode(bytes));
    default:
      return toHex(bytes);
  }
}

// A type's element type: by id (solc), or inline (bugc)
const inner = (t, types) =>
  t.contains.type.id === undefined ? t.contains.type
    : types[t.contains.type.id];

// A short Solidity-like name for an ethdebug type
export function typeName(type, types) {
  switch (type.kind) {
    case "uint":
    case "int":
      return `${type.kind}${type.bits}`;
    case "bytes":
      return type.size === undefined ? "bytes" : `bytes${type.size}`;
    case "struct":
    case "enum":
    case "alias":
      return type.definition?.name ?? type.kind;
    case "array": {
      const e = typeName(inner(type, types), types);
      return `${e}[${type.count ?? ""}]`;
    }
    case "mapping": {
      const k = typeName(types[type.contains.key.type.id], types);
      const v = typeName(types[type.contains.value.type.id], types);
      return `mapping(${k} => ${v})`;
    }
    default:
      return type.kind;
  }
}

// ----------------------------------------------------------- the sigil

// ethdebug/format writes a pointer expression's operator with "~"
// (`~keccak256`, `~wordsize`; #323), and the library takes no other.
// solc still writes "$" (ethdebug/format#324): its pointers and
// templates are rewritten here, where its output is read, and nowhere
// else. bugc writes "~".
export function solcTilde(contract) {
  const re = (v) => Array.isArray(v) ? v.map(re) : v && typeof v ===
    "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) =>
      [k.startsWith("$") ? `~${k.slice(1)}` : k, re(x)]))
    : typeof v === "string" && /^\$[a-z]/.test(v) ? `~${v.slice(1)}` : v;
  return { ...contract, pointers: re(contract.pointers ?? {}),
    variables: (contract.variables ?? []).map((x) => x.pointer
      ? { ...x, pointer: re(x.pointer) } : x) };
}

// -------------------------------------------------------------- replay

const isRegion = (p) => typeof p === "object" && "location" in p;
const toData = (v) => (v.sort === "bytes" ? v.data : Data.fromUint(v.value));
const asInt = (v) => (v.sort === "bytes" ? v.data.asUint() : v.value);
const showValue = (v) =>
  v.sort === "bytes"
    ? { hex: v.data.toHex() }
    : { int: v.value.toString(), hex: "0x" + v.value.toString(16) };

// Walk a pointer the way the library does, and record for each region the
// steps that led to it: templates entered, variables defined, list items,
// conditions, and the region's evaluated fields. Expressions go to the
// library's evaluate(); this function only follows the structure.
//
// Scoping: a `define` holds for its `in` only.
export async function replay(pointer, { state, templates }) {
  const out = [];
  const regions = Object.create(null);
  const renames = [];

  const ev = (expr, variables) =>
    evaluate(expr, { state, regions: { ...regions }, variables });

  // For operations, also evaluate each operand, to show inputs.
  async function explain(expr, variables) {
    const value = await ev(expr, variables);
    const step = { expr, value: showValue(value) };
    if (expr && typeof expr === "object") {
      const [op] = Object.keys(expr);
      const args = Array.isArray(expr[op]) ? expr[op] : [expr[op]];
      if (op !== "~read" && args.some((a) => typeof a === "object")) {
        step.args = [];
        for (const a of args) {
          step.args.push({ expr: a, value: showValue(await ev(a, variables)) });
        }
      }
    }
    return { value, step };
  }

  // (`block`, `at`: where the node is: the template it is in, "" for
  // the pointer itself, and its path of keys in it)
  async function walk(p, variables, steps, block = "", at = []) {
    const where = (...ks) => ({ block, at: [...at, ...ks] });
    if (isRegion(p)) {
      const region = { ...p };
      const fields = [];
      for (const k of ["slot", "offset", "length"]) {
        if (!(k in p)) continue;
        const { value, step } = await explain(p[k], variables);
        region[k] = toData(value);
        fields.push({ field: k, ...step });
      }
      const name = renames.reduceRight(
        (n, m) => (hasOwn(m, n) ? m[n] : n),
        p.name,
      );
      if (p.name !== undefined) regions[p.name] = region;
      out.push({
        region: { ...region, name },
        steps: [...steps, { kind: "region", name: p.name, fields,
          ...where() }],
      });
      return;
    }
    if ("group" in p) {
      for (const [i, child] of p.group.entries()) {
        await walk(child, variables, steps, block, [...at, "group", i]);
      }
      return;
    }
    if ("list" in p) {
      const { count, each, is } = p.list;
      const c = await explain(count, variables);
      const n = asInt(c.value);
      for (let i = 0n; i < n; i++) {
        const vars = { ...variables, [each]: { sort: "integer", value: i } };
        await walk(is, vars, [
          ...steps,
          { kind: "list", each, index: i.toString(), count: c.step,
            ...where("list") },
        ], block, [...at, "list", "is"]);
      }
      return;
    }
    if ("if" in p) {
      const c = await explain(p.if, variables);
      const branch = asInt(c.value) ? "then" : "else";
      if (p[branch] === undefined) return;
      await walk(p[branch], variables, [
        ...steps,
        { kind: "if", cond: c.step, branch, ...where("if") },
      ], block, [...at, branch]);
      return;
    }
    if ("define" in p) {
      const vars = { ...variables };
      const defs = [];
      for (const [id, expr] of Object.entries(p.define)) {
        const { value, step } = await explain(expr, vars);
        vars[id] = value;
        defs.push({ kind: "define", id, ...step, ...where("define", id) });
      }
      await walk(p.in, vars, [...steps, ...defs], block, [...at, "in"]);
      return;
    }
    if ("template" in p) {
      const t = templates[p.template];
      if (!t) throw new Error(`no template ${p.template}`);
      const yields = p.yields ?? {};
      renames.push(yields);
      await walk(t.for, variables, [
        ...steps,
        { kind: "template", name: p.template, expect: t.expect, yields,
          // (the values the template takes: its expected inputs, bound)
          inputs: Object.fromEntries((t.expect ?? []).filter((e) =>
            variables[e] !== undefined).map((e) => [e,
            showValue(variables[e])])), block: p.template, at: [] },
      ], p.template, ["for"]);
      renames.pop();
      for (const [from, to] of Object.entries(yields)) {
        if (from in regions && to !== from) {
          regions[to] = { ...regions[from], name: to };
        }
      }
      return;
    }
    throw new Error(`replay: unsupported pointer ${JSON.stringify(p)}`);
  }

  await walk(pointer, Object.create(null), []);
  return out;
}

const same = (a, b) =>
  a.name === b.name &&
  a.location === b.location &&
  ["slot", "offset", "length"].every(
    (k) => (a[k] === undefined) === (b[k] === undefined) &&
      (a[k] === undefined || a[k].asUint() === b[k].asUint()),
  );

// Dereference a pointer with the library, and pair each region with the
// replayed steps for it.
async function instantiate(pointer, state, templates, origin) {
  const cursor = await dereference(pointer, { state, templates });
  const view = await cursor.view(state);
  const replayed = await replay(pointer, { state, templates });
  if (replayed.length !== view.regions.length) {
    throw new Error(
      `library gave ${view.regions.length} regions, replay gave ` +
        `${replayed.length}`,
    );
  }
  replayed.forEach((r, i) => {
    if (!same(r.region, view.regions[i])) {
      const fmt = (x) =>
        `${x.name} slot ${x.slot?.toHex()} offset ${x.offset?.toHex()} ` +
        `length ${x.length?.toHex()}`;
      throw new Error(
        `region ${i} differs: library ${fmt(view.regions[i])}, replay ` +
          `${fmt(r.region)}`,
      );
    }
  });
  const used = new Map();
  const at = (index) => ({
    region: regionJson(view.regions[index]),
    how: { origin, pointer, steps: replayed[index].steps },
  });
  return {
    has: (name) => view.regions.named(name).length > 0,
    async take(name) {
      const list = view.regions.named(name);
      const i = used.get(name) ?? 0;
      used.set(name, i + 1);
      if (!list[i]) throw new Error(`no region named ${name} (#${i})`);
      const index = [...view.regions].indexOf(list[i]);
      const bytes = await view.read(list[i]);
      return { bytes, index, ...at(index) };
    },
    // The regions a string or bytes value reads to find its length:
    // the nearest "length-flag" before its data region, and a
    // "long-length" between the two, if any.
    lengthParts(prefix, index) {
      const all = [...view.regions];
      const flag = join(prefix, "length-flag");
      const long = join(prefix, "long-length");
      let f = index - 1;
      while (f >= 0 && all[f].name !== flag) f--;
      if (f < 0) return [];
      const parts = [at(f)];
      for (let i = f + 1; i < index; i++) {
        if (all[i].name === long) parts.push(at(i));
      }
      return parts;
    },
  };
}

const regionJson = (r) => {
  const o = { name: r.name, location: r.location };
  for (const k of ["slot", "offset", "length"]) {
    if (r[k] !== undefined) o[k] = r[k].toHex();
  }
  return o;
};

// ---------------------------------------------------------------- walk

const join = (prefix, n) => (prefix ? `${prefix}-${n}` : n);
// Struct member names that start with "$" are written "_$" in region names
const memberRegion = (m) => (m.startsWith("$") ? "_" + m : m);

// Decode one contract's storage in one state. `keys` is mappingKeys().
// The state variables, with each one's base slot, offset and type, come
// from the program-level context (`contract.variables`).
// Returns a list of nodes:
//   { label, path, type, value?: { text, hex, region, how }, children? }
export async function decodeStorage(contract, state, keys) {
  const { types, pointers: templates } = contract;
  const nodes = [];
  for (const variable of contract.variables.filter(inStorage)) {
    const label = variable.identifier;
    const typeId = variable.type.id;
    const type = types[typeId];
    const base = baseSlot(variable);
    const node = { label, path: label, typeId };
    if (!type) {
      node.note = `no ethdebug type ${typeId}`;
    } else if (isValue(resolve(type, types))) {
      node.value = await contextValue(contract, state, variable, type);
    } else if (type.kind === "mapping") {
      node.children = await walkMapping(
        contract, state, keys, typeId, base, label, variable,
      );
    } else {
      const origin = { variable: label, slot: base };
      const scope = await instantiate(
        { define: { slot: base }, in: { template: typeId } },
        state, templates, origin,
      );
      Object.assign(node, await walk(contract, scope, typeId, "", node.path));
    }
    nodes.push(node);
  }
  return nodes;
}

// A value type has no template: its pointer in the program-level context
// is the region. With no offset, the value starts at byte 0; with no
// length, it fills the word.
async function contextValue(contract, state, variable, type) {
  const p = variable.pointer;
  const offset = Number(p.offset ?? 0);
  const length = Number(p.length ?? 32);
  const region = {
    location: "storage",
    slot: baseSlot(variable),
    offset: "0x" + offset.toString(16),
    length: "0x" + length.toString(16),
  };
  const cursor = await dereference(region, { state });
  const view = await cursor.view(state);
  const bytes = await view.read(view.regions[0]);
  return {
    text: decodeValue(type, bytes, contract.types),
    hex: bytes.toHex(),
    region: regionJson(view.regions[0]),
    how: {
      context: { variable: variable.identifier, pointer: p,
        slot: region.slot, offset, length },
    },
  };
}

const valueOf = (r, text) =>
  ({ text, hex: r.bytes.toHex(), region: r.region, how: r.how });

async function walk(contract, scope, typeId, prefix, path) {
  const { types } = contract;
  const type = types[typeId];
  if (type.kind === "alias" && !isValue(resolve(type, types))) {
    return walk(contract, scope, type.contains.type.id, prefix, path);
  }
  if (isValue(resolve(type, types)) || isDynBytes(type)) {
    const name = isDynBytes(type) ? join(prefix, "data") : prefix;
    const r = await scope.take(name);
    const value = valueOf(r, decodeValue(type, r.bytes, types));
    // The bytes that hold a string's length, for the storage panel
    if (isDynBytes(type)) value.parts = scope.lengthParts(prefix, r.index);
    return { value };
  }
  if (type.kind === "struct") {
    const children = [];
    for (const m of type.contains) {
      const p = `${path}.${m.name}`;
      children.push({
        label: m.name, path: p, typeId: m.type.id,
        ...(await walk(contract, scope, m.type.id,
          join(prefix, memberRegion(m.name)), p)),
      });
    }
    return { children };
  }
  if (type.kind === "array") {
    const elem = type.contains.type.id;
    let count;
    let value;
    const children = [];
    if (type.count !== undefined) {
      count = Number(type.count);
    } else {
      const r = await scope.take(join(prefix, "length"));
      count = Number(toBig(r.bytes));
      value = { ...valueOf(r, `length ${count}`), length: true };
    }
    for (let i = 0; i < count; i++) {
      const p = `${path}[${i}]`;
      children.push({
        label: `[${i}]`, path: p, typeId: elem,
        ...(await walk(contract, scope, elem, join(prefix, "item"), p)),
      });
    }
    return { children, value };
  }
  if (type.kind === "mapping") {
    return { note: "a mapping inside another value: not shown (needs " +
      "chaining templates; see the notes below)" };
  }
  throw new Error(`unsupported type kind ${type.kind}`);
}

async function walkMapping(
  contract, state, keys, typeId, base, path, variable,
) {
  const { types, pointers: templates } = contract;
  const type = types[typeId];
  const keyType = types[type.contains.key.type.id];
  const valueId = type.contains.value.type.id;
  const children = [];
  for (const { key } of keys.get(base) ?? []) {
    const keyText = isDynBytes(keyType)
      ? decodeValue(keyType, Data.fromHex(key), types)
      : decodeValue(keyType, Data.fromHex(key).resizeTo(32), types);
    const p = `${path}[${keyText}]`;
    const origin = { variable: variable.identifier, slot: base, key };
    const scope = await instantiate(
      { define: { slot: base, key }, in: { template: typeId } },
      state, templates, origin,
    );
    children.push({
      label: `[${keyText}]`, path: p, typeId: valueId, key,
      ...(await walk(contract, scope, valueId, "value", p)),
    });
  }
  return children;
}

// ------------------------------------------------------------- memory

// A Machine.State with memory only, from a hex dump of memory. Bytes past
// the end read as zero, as in the EVM.
export function memoryState(hex) {
  const mem = Data.fromHex(hex);
  const none = (what) => {
    throw new Error(`${what} is not part of this state`);
  };
  return {
    memory: {
      get length() {
        return Promise.resolve(BigInt(mem.length));
      },
      async read({ slice }) {
        const o = Number(slice.offset);
        const n = Number(slice.length);
        const out = new Uint8Array(n);
        out.set(mem.slice(o, Math.min(o + n, mem.length)));
        return Data.fromBytes(out);
      },
    },
    stack: {
      get length() {
        return Promise.resolve(0n);
      },
      peek: () => none("stack"),
    },
    get storage() { return none("storage"); },
    get calldata() { return none("calldata"); },
    get returndata() { return none("returndata"); },
    get transient() { return none("transient"); },
    get code() { return none("code"); },
    get traceIndex() { return Promise.resolve(0n); },
    get programCounter() { return Promise.resolve(0n); },
    get opcode() { return Promise.resolve("STOP"); },
  };
}

// The values in memory at one point: each `variables` entry whose pointer
// is in memory, dereferenced by the library against that point's memory
// (a pointer that reads the stack is left out: the state has no stack).
// Returns one node per local, as decodeStorage does:
//   { label, path, type, value?: { text, hex, region, how, parts },
//     children? }
// A value's `parts` are the regions read to find it (the local's word,
// the base address, a length, an element's word); `how` holds the
// replayed steps of each part and of the value's own region, in order.
export async function decodeLocals(variables, hex) {
  const state = memoryState(hex);
  const out = [];
  for (const v of variables) {
    const p = JSON.stringify(v.pointer ?? {});
    if (!p.includes('"memory"') || p.includes('"stack"')) continue;
    const origin = { variable: v.identifier };
    const scope = await instantiate(v.pointer, state, {}, origin);
    // a frame pointer the local's word is found from (in a function)
    const chain = [];
    for (const f of ["-frame"]) {
      if (scope.has(f)) chain.push(await scope.take(f));
    }
    out.push({ label: v.identifier, path: v.identifier, type: v.type,
      pointer: v.pointer,
      ...(await walkLocal(scope, v.type, v.identifier, v.identifier,
        chain)) });
  }
  return out;
}

// One value in memory, from the regions bugc's pointer names: the value's
// word (a reference type's holds the address of its data), then, for a
// reference type, "-length" at that address and "-element" words or a
// "-data" region after it. `chain`: the regions read to get here.
async function walkLocal(scope, type, prefix, path, chain) {
  const ref = isDynBytes(type) ||
    (type.kind === "array" && type.count === undefined);
  const r = await scope.take(prefix);
  const value = (main, text, parts) => ({ text, hex: main.bytes.toHex(),
    region: main.region, parts: parts.map((x) => x.region),
    how: { origin: main.how.origin, pointer: main.how.pointer,
      steps: stepsAlong([...parts, main]) } });
  if (!ref) {
    return { value: value(r, decodeValue(type, r.bytes, {}), chain) };
  }
  const len = await scope.take(join(prefix, "length"));
  const n = Number(toBig(len.bytes));
  if (isDynBytes(type)) {
    const d = await scope.take(join(prefix, "data"));
    return { value: value(d, decodeValue(type, d.bytes, {}),
      [...chain, r, len]) };
  }
  const children = [];
  for (let i = 0; i < n; i++) {
    children.push({ label: `[${i}]`, path: `${path}[${i}]`,
      type: inner(type, {}),
      ...(await walkLocal(scope, inner(type, {}), join(prefix, "element"),
        `${path}[${i}]`, [...chain, r, len])) });
  }
  return { value: { ...value(len, `length ${n}`, [...chain, r]),
    length: true }, children };
}

// The steps that find a list of regions, in order: each region's own
// steps, without those already given (a list item shared by the regions
// of one element). Each region step carries its region.
function stepsAlong(rs) {
  const seen = new Set();
  const out = [];
  for (const r of rs) {
    r.how.steps.forEach((s, i, all) => {
      const k = JSON.stringify(s);
      if (seen.has(k)) return;
      seen.add(k);
      out.push(i === all.length - 1 ? { ...s, at: r.region,
        read: r.bytes.toHex() } : s);
    });
  }
  return out;
}
