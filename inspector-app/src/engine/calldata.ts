// The calldata of a call whose function takes one string parameter
// (setMotd(string text) here), by the ABI encoding: solc's ethdebug
// output gives no pointer for a function parameter at any instruction,
// and no calldata type or template, so these parts are the ABI's, and
// this file computes them itself (vanilla calldata.js calldataParts).
// When the compiler gives a pointer for the parameter, a layout made
// from the library's regions takes this one's place.
import type { Hex } from "./types";

export interface CalldataPart {
  id: "selector" | "m-offset" | "m-length" | "m-data";
  label: string; from: number; to: number; value: string;
}
export interface Calldata {
  bytes: string[]; parts: CalldataPart[]; param: string;
  offset: number; lenAt: number; length: number; dataAt: number;
  text: string; partAt(i: number): CalldataPart | undefined;
}

// the selector; the head word, which holds the offset of the data from
// byte 4; at that offset, the length; then the bytes, padded with zeros
// to a whole word
export function abiParts(input: Hex, param = "m"): Calldata {
  const hex = input.slice(2);
  const bytes = hex.match(/../g) ?? [];
  const word = (i: number) => Number(BigInt("0x" +
    hex.slice(i * 2, i * 2 + 64)));
  const offset = word(4);
  const lenAt = 4 + offset;
  const length = word(lenAt);
  const dataAt = lenAt + 32;
  const text = new TextDecoder().decode(new Uint8Array(bytes
    .slice(dataAt, dataAt + length).map((b) => parseInt(b, 16))));
  const parts: CalldataPart[] = [
    { id: "selector", label: "selector", from: 0, to: 3,
      value: "0x" + hex.slice(0, 8) },
    { id: "m-offset", label: `${param} (offset)`, from: 4, to: 35,
      value: String(offset) },
    { id: "m-length", label: `${param} (length)`, from: lenAt,
      to: lenAt + 31, value: String(length) },
    { id: "m-data", label: `${param} (bytes)`, from: dataAt,
      to: dataAt + length - 1, value: JSON.stringify(text) },
  ];
  return { bytes, parts, param, offset, lenAt, length, dataAt, text,
    partAt: (i) => parts.find((p) => i >= p.from && i <= p.to) };
}
