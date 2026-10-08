import { it, expect } from "vitest";
import { decodeValue, typeName } from "./values";

const types = {
  t_uint64: { kind: "uint", bits: 64 },
  t_address: { kind: "address" },
  t_string_storage: { kind: "string" },
  t_array$_t_address_$dyn_storage: { kind: "array",
    contains: { type: { id: "t_address" } } },
  t_mapping: { kind: "mapping", contains: {
    key: { type: { id: "t_address" } },
    value: { type: { id: "t_uint64" } } } },
} as never;
const b = (...xs: number[]) => Uint8Array.from(xs);

it("decodes by type", () => {
  expect(decodeValue({ kind: "uint", bits: 128 } as never, b(0, 0x28), types))
    .toEqual({ text: "40", hex: "0x0028" });
  expect(decodeValue({ kind: "int", bits: 8 } as never, b(0xff), types).text)
    .toBe("-1");
  expect(decodeValue({ kind: "bool" } as never, b(1), types).text)
    .toBe("true");
  expect(decodeValue({ kind: "string" } as never, b(104, 105), types).text)
    .toBe('"hi"');
  expect(decodeValue({ kind: "address" } as never, b(0xab), types).text)
    .toBe("0x" + "ab".padStart(40, "0"));
});

it("names types as Solidity does", () => {
  const t = types as Record<string, never>;
  expect(typeName({ kind: "uint", bits: 128 } as never, t)).toBe("uint128");
  expect(typeName(t["t_array$_t_address_$dyn_storage"], t))
    .toBe("address[]");
  expect(typeName(t.t_mapping, t)).toBe("mapping(address => uint64)");
});
