// Vyper's own layout of Arcade's `players`, as a hand-written ethdebug
// pointer (Vyper emits no ethdebug): HashMap[address, Player] at slot
// 108 hashes the slot first, keccak256(108 . key); a Player keeps each
// member in a slot of its own (no packing, each value at the word's
// low end), then name, a String[64]: its length word, then its bytes
// from the next slot. Region names follow solc's templates (value-…,
// name-…), so the same decoding reads both.
import type { Compilation, Variable } from "../types";

const member = (name: string, k: number, size: number) => ({
  name, location: "storage", offset: `0x${(32 - size).toString(16)}`,
  length: `0x${size.toString(16).padStart(2, "0")}`,
  slot: k ? { "~sum": ["slot", `0x${k.toString(16).padStart(2, "0")}`] }
    : "slot" });
const MEMBERS: [string, string, number][] = [["score", "vy_uint64", 8],
  ["combo", "vy_uint32", 4], ["bestCombo", "vy_uint32", 4],
  ["plays", "vy_uint32", 4], ["hitCount", "vy_uint32", 4],
  ["lastBlock", "vy_uint64", 8]];
const yields = (prefix: string, names: string[]) =>
  Object.fromEntries(names.map((n) => [n, `${prefix}-${n}`]));

export function vyperRule(fixture: unknown): Compilation {
  const vy = (fixture as { vyper: { compiler: string; base: string } })
    .vyper;
  const base = `0x${BigInt(vy.base).toString(16).padStart(2, "0")}`;
  const players: Variable = { identifier: "players",
    type: { id: "vy_players" },
    pointer: { define: { slot: base }, in: { template: "vy_players" } } as
      never };
  return {
    id: "arcade-vy-rule", language: "vyper",
    compiler: `vyper ${vy.compiler}`, provenance: "hand-written",
    sources: [],
    types: {
      vy_uint64: { kind: "uint", bits: 64 },
      vy_uint32: { kind: "uint", bits: 32 },
      vy_address: { kind: "address" },
      vy_String64: { kind: "string" },
      vy_Player: { kind: "struct", definition: { name: "Player" },
        contains: [...MEMBERS.map(([name, id]) => ({ name,
          type: { id } })), { name: "name", type: { id: "vy_String64" } }] },
      vy_players: { kind: "mapping", contains: {
        key: { type: { id: "vy_address" } },
        value: { type: { id: "vy_Player" } } } },
    } as never,
    templates: {
      vy_players: { expect: ["slot", "key"], for: {
        define: { slot: { "~keccak256": [{ "~wordsized": "slot" },
          { "~wordsized": "key" }] } },
        in: { template: "vy_Player", yields: yields("value",
          [...MEMBERS.map(([n]) => n), "name-length", "name-data"]) } } },
      vy_Player: { expect: ["slot"], for: { group: [
        ...MEMBERS.map(([name, , size], k) => member(name, k, size)),
        { define: { slot: { "~sum": ["slot", "0x06"] } },
          in: { template: "vy_String64",
            yields: yields("name", ["length", "data"]) } }] } },
      vy_String64: { expect: ["slot"], for: { group: [
        { name: "length", location: "storage", slot: "slot" },
        { name: "data", location: "storage",
          slot: { "~sum": ["slot", "0x01"] }, offset: "0x00",
          length: { "~read": "length" } }] } },
    } as never,
    stateVariables: [players],
  };
}
