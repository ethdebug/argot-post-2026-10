// A scenario from its JSON (bigints as decimal strings), its blocks, and
// Arcade's roll
import type { Hex } from "../types";
import type { Scenario, TxSpec } from "./types";
import { keccak } from "./abi";
import { buildOf } from "./build";

const word = (h: string) => BigInt(h).toString(16).padStart(64, "0");
const big = (v: unknown, what: string): bigint => {
  if (typeof v !== "string" || !/^\d+$/.test(v)) {
    throw new Error(`scenario: ${what} is not a decimal string`);
  }
  return BigInt(v);
};
const need = <T>(v: T | undefined, what: string): T => {
  if (v === undefined || v === null) throw new Error(`scenario: no ${what}`);
  return v;
};

type Json = Record<string, any>;

// (`builds`: the builds' JSON, each read by buildOf; a scenario file
// holds none: its builds are files of their own, merged in by the caller)
export function scenarioOf(json: unknown): Scenario {
  const j = json as Json;
  const accounts = need(j.accounts as Json[], "accounts").map((a) => ({
    name: need(a.name as string, "account name"),
    address: (need(a.address as string, "address")).toLowerCase() as Hex,
    balance: big(a.balance, `${a.name}'s balance`) }));
  const names = new Set(accounts.map((a) => a.name));
  const transactions = need(j.transactions as Json[], "transactions")
    .map((t, k): TxSpec => {
      if (!names.has(t.from)) {
        throw new Error(`scenario: tx ${k} is from ${t.from}, no account`);
      }
      if (t.kind !== "create" && t.kind !== "call") {
        throw new Error(`scenario: tx ${k} has kind ${t.kind}`);
      }
      const b = need(t.block as Json, `block of tx ${k}`);
      return {
        label: need(t.label as string, `label of tx ${k}`),
        from: t.from, kind: t.kind,
        ...(t.call ? { call: t.call } : {}),
        ...(t.value !== undefined ? { value: big(t.value, "value") } : {}),
        block: {
          prevrandao: need(b.prevrandao as Hex, `prevrandao of tx ${k}`),
          ...(b.numberDelta !== undefined
            ? { numberDelta: big(b.numberDelta, "numberDelta") } : {}),
          ...(b.secondsDelta !== undefined
            ? { secondsDelta: big(b.secondsDelta, "secondsDelta") } : {}),
        },
      };
    });
  const chain = need(j.chain as Json, "chain");
  if (chain.hardfork !== "prague") {
    throw new Error(`scenario: hardfork ${chain.hardfork}`);
  }
  const genesis = need(j.genesis as Json, "genesis");
  return {
    id: need(j.id as string, "id"),
    chain: { hardfork: "prague", chainId: big(chain.chainId, "chainId") },
    accounts,
    builds: Object.fromEntries(Object.entries(j.builds ?? {})
      .map(([id, b]) => [id, buildOf(b)])),
    genesis: { number: big(genesis.number, "genesis number"),
      timestamp: big(genesis.timestamp, "genesis timestamp") },
    transactions,
  };
}

// Block k (one transaction per block): the deltas of blocks 0…k after
// genesis, and its own prevrandao
export function blockOf(s: Scenario, k: number):
  { number: bigint; timestamp: bigint; prevrandao: Hex } {
  let number = s.genesis.number;
  let timestamp = s.genesis.timestamp;
  for (const t of s.transactions.slice(0, k + 1)) {
    number += t.block.numberDelta ?? 1n;
    timestamp += t.block.secondsDelta ?? 12n;
  }
  return { number, timestamp, prevrandao: s.transactions[k].block.prevrandao };
}

// Arcade's roll (_rolledHit): keccak256(abi.encode(prevrandao, sender))
// % 3 != 0
export function rolledHit(prevrandao: Hex, sender: Hex): boolean {
  const h = keccak(Uint8Array.from((word(prevrandao) + word(sender))
    .match(/../g)!.map((b) => parseInt(b, 16))));
  return BigInt(h) % 3n !== 0n;
}
