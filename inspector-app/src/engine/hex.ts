// Hex words, slot addresses and byte keys
import type { ByteKey, Hex, Location } from "./types";

// 0x + 64 hex digits, lowercase
export const slotHex = (n: bigint): Hex =>
  `0x${n.toString(16).padStart(64, "0")}`;

export const byteKey = (l: Location, row: Hex, byte: number): ByteKey =>
  `${l}|${row}|${byte}`;

export const toHex = (bytes: Uint8Array): Hex =>
  `0x${[...bytes].map((b) => b.toString(16).padStart(2, "0")).join("")}`;

// "0x" (no bytes) is zero
export const toBig = (h: string): bigint =>
  BigInt(h === "0x" || h === "" ? 0 : h);

// 0x0000…f39f…2266 -> 0xf39f…2266
export function short(h: string, keep = 4): string {
  const s = "0x" + (h.replace(/^0x0*/, "") || "0");
  return s.length <= keep * 2 + 4 ? s
    : `${s.slice(0, keep + 2)}…${s.slice(-keep)}`;
}

// A word, short: padded to 32 bytes, its first byte and its last `n`
// bytes, "0x00…001420": every word the same width (the stack's, a stack
// item's popover's)
export function wordShort(hex: string, n = 3): string {
  const h = hex.replace(/^0x/, "").padStart(64, "0");
  return `0x${h.slice(0, 2)}…${h.slice(-2 * n)}`;
}
