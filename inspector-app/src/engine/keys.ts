// Mapping keys (vanilla decode.js mappingKeys; main.js decode keysFor):
// from the KECCAK256 inputs a trace saw (a mapping hashes key ++ slot),
// or from a list in the same storage (playerList lists players' keys)
import type {
  Decoding, Hex, InputNode, TxFacts, ValueNode,
} from "./types";

const word = (h: string): Hex =>
  `0x${h.replace(/^0x/, "").toLowerCase().padStart(64, "0")}`;

// The keys hashed with a base slot (any base, when none is given), in
// the order first seen: Solidity hashes key . slot; Vyper, slot . key
export function mappingKeys(tx: TxFacts, base?: Hex): Hex[] {
  const out: Hex[] = [];
  const hex = (ws: Hex[]) => `0x${ws.map((w) => w.slice(2)).join("")}` as Hex;
  for (const words of tx.keccakInputs) {
    if (words.length < 2) continue;
    const last = word(words[words.length - 1]);
    const key = !base || last === word(base) ? hex(words.slice(0, -1))
      : word(words[0]) === word(base) ? hex(words.slice(1)) : undefined;
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

const find = (tree: ValueNode[], path: string): ValueNode | undefined => {
  for (const n of tree) {
    if (n.path === path) return n;
    const c = n.children && find(n.children, path);
    if (c) return c;
  }
};

// The input `key` of a decoding's mappings: the items of its list (in
// the tree decoded so far), or the trace's keys
export function keysFor(d: Decoding, tree: ValueNode[], tx?: TxFacts,
  base?: Hex): InputNode {
  if (d.keys.from === "list") {
    const list = d.keys.path;
    const items = find(tree, list)?.children ?? [];
    return { id: "key", name: "key", provenance: { list },
      values: items.map((n) => ({ value: word(n.value!.text),
        source: n.path })) };
  }
  return { id: "key", name: "key", provenance: "trace",
    values: (tx ? mappingKeys(tx, base) : []).map((value) => ({ value })) };
}
