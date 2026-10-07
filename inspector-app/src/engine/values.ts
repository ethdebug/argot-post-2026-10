// Values by ethdebug type (vanilla decode.js decodeValue, typeName)
import type { Format, TypeId, ValueNode } from "./types";
import { toBig, toHex } from "./hex";

type Types = Record<TypeId, Format.Type>;
// the fields this module reads, of any ethdebug type
type Any = {
  kind: string; bits?: number; size?: number; count?: number;
  values?: string[]; definition?: { name?: string };
  contains?: any;
};
const as = (t: Format.Type) => t as unknown as Any;

const signed = (v: bigint, bits: number) =>
  v >= 1n << BigInt(bits - 1) ? v - (1n << BigInt(bits)) : v;

function text(type: Format.Type, bytes: Uint8Array, types: Types): string {
  const t = as(type);
  const n = () => toBig(toHex(bytes));
  switch (t.kind) {
    case "uint":
      return n().toString();
    case "int":
      return signed(n(), t.bits ?? bytes.length * 8).toString();
    case "bool":
      return n() === 0n ? "false" : "true";
    case "address":
    case "contract":
      return "0x" + toHex(bytes).slice(2).padStart(40, "0").slice(-40);
    case "enum": {
      const i = Number(n());
      return `${t.values?.[i] ?? "?"} (${i})`;
    }
    case "alias":
      return text(types[t.contains.type.id], bytes, types);
    case "string":
      return JSON.stringify(new TextDecoder().decode(bytes));
    default:
      return toHex(bytes);
  }
}

// Decode bytes by ethdebug type: the display text, and the bytes' hex
export const decodeValue = (type: Format.Type, bytes: Uint8Array,
  types: Types) => ({ text: text(type, bytes, types), hex: toHex(bytes) });

// A type's element type: by id (solc), or inline (bugc)
const inner = (t: Any, types: Types): Format.Type =>
  t.contains.type.id === undefined ? t.contains.type
    : types[t.contains.type.id];

// A short Solidity-like name for an ethdebug type
export function typeName(type: Format.Type, types: Types): string {
  const t = as(type);
  switch (t.kind) {
    case "uint":
    case "int":
      return `${t.kind}${t.bits}`;
    case "bytes":
      return t.size === undefined ? "bytes" : `bytes${t.size}`;
    case "struct":
    case "enum":
    case "alias":
      return t.definition?.name ?? t.kind;
    case "array":
      return `${typeName(inner(t, types), types)}[${t.count ?? ""}]`;
    case "mapping": {
      const k = typeName(types[t.contains.key.type.id], types);
      const v = typeName(types[t.contains.value.type.id], types);
      return `mapping(${k} => ${v})`;
    }
    default:
      return t.kind;
  }
}

const resolve = (t: Any, types: Types): Any =>
  t.kind === "alias" ? resolve(as(types[t.contains.type.id]), types) : t;

// A value type: one region, no template (an alias of one, too)
export function isValueType(type: Format.Type, types: Types): boolean {
  const t = resolve(as(type), types);
  return !["struct", "mapping", "array", "string", "bytes"]
    .includes(t.kind) || (t.kind === "bytes" && t.size !== undefined);
}

// A composite's summary, as its tree row shows it: an array's length
// ("length 3", from its length word), a mapping's entries ("3
// entries"), a struct's fields ("7 fields")
export function summary(n: ValueNode): string | undefined {
  if (!n.children || n.value) return undefined;
  const k = n.children.length;
  if (n.regions.some((r) => r.role === "length")) return `length ${k}`;
  const [one, many] = n.typeText.startsWith("mapping(")
    ? ["entry", "entries"] : /\[\d*\]$/.test(n.typeText)
      ? ["item", "items"] : ["field", "fields"];
  return `${k} ${k === 1 ? one : many}`;
}
