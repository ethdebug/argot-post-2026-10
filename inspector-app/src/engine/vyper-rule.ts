// Vyper's own layout of Arcade's storage, as hand-written ethdebug
// pointers (Vyper emits no ethdebug), checked against the run's storage
// (vyper-rule.test.ts). Vyper 0.4.3 gives each variable whole slots, in
// declaration order, and packs nothing:
// - playerList, a DynArray[address, 100] (slots 0–100): its length,
//   then its items from the next slot, one a slot
// - motd, a String[100] (slots 101–105): its length word, then its bytes
//   from the next slot (no keccak'd data, no short form)
// - totalScore (106), totalHits (107): one slot each, at the low end
// - players, a HashMap[address, Player] at 108: an entry's slot hashes
//   the slot first, keccak256(108 . key); a Player keeps each member in
//   a slot of its own, then name, a String[64], as motd
// Region names follow solc's templates (value-…, name-…, item), so the
// same decoding reads both.
import type { Compilation, Variable } from "./types";

const member = (name: string, k: number, size: number) => ({
  name, location: "storage", offset: `0x${(32 - size).toString(16)}`,
  length: `0x${size.toString(16).padStart(2, "0")}`,
  slot: k ? { "~sum": ["slot", `0x${k.toString(16).padStart(2, "0")}`] }
    : "slot" });
const MEMBERS: [string, string, number][] = [["score", "vy_uint64", 8],
  ["combo", "vy_uint32", 4], ["bestCombo", "vy_uint32", 4],
  ["plays", "vy_uint32", 4], ["hits", "vy_uint32", 4],
  ["lastBlock", "vy_uint64", 8]];
const yields = (prefix: string, names: string[]) =>
  Object.fromEntries(names.map((n) => [n, `${prefix}-${n}`]));

// (Vyper's slot for players: its storage layout's, 108 for Arcade.vy;
// `compiler`: the whole name, "vyper 0.4.3+commit.bff19ea2")
export const VY_PLAYERS = "108";
const word = (slot: number, size: number) => ({ location: "storage",
  slot: `0x${slot.toString(16).padStart(2, "0")}`,
  offset: `0x${(32 - size).toString(16)}`,
  length: `0x${size.toString(16).padStart(2, "0")}` });
export function vyperRule(vy: { compiler: string; base: string }):
  Compilation {
  const base = `0x${BigInt(vy.base).toString(16).padStart(2, "0")}`;
  const at = (n: number) => `0x${n.toString(16).padStart(2, "0")}`;
  const playerList: Variable = { identifier: "playerList",
    type: { id: "vy_playerList" },
    pointer: { define: { slot: at(0) }, in: { template: "vy_playerList" } } as
      never };
  const motd: Variable = { identifier: "motd", type: { id: "vy_String" },
    pointer: { define: { slot: at(101) },
      in: { template: "vy_String" } } as never };
  const totalScore: Variable = { identifier: "totalScore",
    type: { id: "vy_uint128" }, pointer: word(106, 16) as never };
  const totalHits: Variable = { identifier: "totalHits",
    type: { id: "vy_uint64" }, pointer: word(107, 8) as never };
  const players: Variable = { identifier: "players",
    type: { id: "vy_players" },
    pointer: { define: { slot: base }, in: { template: "vy_players" } } as
      never };
  return {
    id: "arcade-vy-rule", language: "vyper",
    compiler: vy.compiler, provenance: "hand-written",
    sources: [],
    types: {
      vy_uint128: { kind: "uint", bits: 128 },
      vy_uint64: { kind: "uint", bits: 64 },
      vy_uint32: { kind: "uint", bits: 32 },
      vy_address: { kind: "address" },
      vy_String: { kind: "string" },
      vy_playerList: { kind: "array", contains: {
        type: { id: "vy_address" } } },
      vy_Player: { kind: "struct", definition: { name: "Player" },
        contains: [...MEMBERS.map(([name, id]) => ({ name,
          type: { id } })), { name: "name", type: { id: "vy_String" } }] },
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
          in: { template: "vy_String",
            yields: yields("name", ["length", "data"]) } }] } },
      // (a DynArray of addresses: its length, then an item a slot)
      vy_playerList: { expect: ["slot"], for: { group: [
        { name: "length", location: "storage", slot: "slot" },
        { list: { count: { "~read": "length" }, each: "index", is: {
          name: "item", location: "storage",
          slot: { "~sum": ["slot", "0x01", "index"] },
          offset: "0x0c", length: "0x14" } } }] } },
      // (a String[N], motd's and a name's: its length word, then its
      // bytes from the next slot)
      vy_String: { expect: ["slot"], for: { group: [
        { name: "length", location: "storage", slot: "slot" },
        { name: "data", location: "storage",
          slot: { "~sum": ["slot", "0x01"] }, offset: "0x00",
          length: { "~read": "length" } }] } },
    } as never,
    stateVariables: [playerList, motd, totalScore, totalHits, players],
  };
}
