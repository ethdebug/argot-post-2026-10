// A small ABI encoder: a call's input from its signature and arguments,
// for the types Arcade's calls use (string, bytes, uint<N>, address)
import sha3 from "js-sha3";
import type { Hex } from "../types";
import type { TxSpec } from "./types";

const word = (n: bigint) => n.toString(16).padStart(64, "0");
const utf8 = (s: string) => new TextEncoder().encode(s);
const bytesOf = (h: string) => Uint8Array.from(
  (h.replace(/^0x/, "").match(/../g) ?? []).map((b) => parseInt(b, 16)));
const padded = (b: Uint8Array) => [...b].map((x) => x.toString(16)
  .padStart(2, "0")).join("").padEnd(Math.ceil(b.length / 32) * 64, "0");

export const keccak = (data: Uint8Array | string): Hex =>
  `0x${sha3.keccak256(typeof data === "string" ? utf8(data) : data)}`;

// one argument: its head (static) or its tail (dynamic, after the
// length word)
function encode(type: string, v: unknown):
  { head?: string; tail?: string } {
  if (type === "string" || type === "bytes") {
    const b = type === "string" ? utf8(String(v)) : bytesOf(String(v));
    return { tail: word(BigInt(b.length)) + padded(b) };
  }
  if (/^uint(8|16|32|64|128|256)?$/.test(type)) {
    return { head: word(BigInt(v as bigint | number | string)) };
  }
  if (type === "address") return { head: word(BigInt(String(v))) };
  throw new Error(`the ABI encoder does not know ${type}`);
}

export function encodeCall(signature: string, args: unknown[]): Hex {
  const m = signature.match(/^\w+\((.*)\)$/);
  if (!m) throw new Error(`not a signature: ${signature}`);
  const types = m[1] ? m[1].split(",") : [];
  if (types.length !== args.length) {
    throw new Error(`${signature}: ${args.length} arguments`);
  }
  const parts = types.map((t, k) => encode(t, args[k]));
  let tails = "";
  const heads = parts.map((p) => {
    if (p.head !== undefined) return p.head;
    const at = word(BigInt(parts.length * 32 + tails.length / 2));
    tails += p.tail;
    return at;
  });
  return `${keccak(signature).slice(0, 10)}${heads.join("")}${tails}` as Hex;
}

// a transaction's input: its call, encoded, or as given; none for a
// create (its code is the build's)
export function inputOf(tx: TxSpec): Hex {
  if (!tx.call) return "0x";
  return "input" in tx.call ? tx.call.input
    : encodeCall(tx.call.signature, tx.call.args);
}
