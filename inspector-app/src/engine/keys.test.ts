import { it, expect } from "vitest";
import { keysFor } from "./keys";
import type { Decoding, Hex, TxFacts, ValueNode } from "./types";

const w = (h: string) => `0x${h.padStart(64, "0")}` as Hex;
const SLOT = w("3");
const [A, B, C] = ["aa", "bb", "cc"].map((x) => w(x.repeat(20)));
const d = { keys: { from: "list", path: "playerList" } } as Decoding;
const list = (keys: Hex[]): ValueNode[] => [{ path: "playerList",
  children: keys.map((k, i) => ({ path: `playerList[${i}]`,
    value: { text: `0x${k.slice(-40)}` } })) } as unknown as ValueNode];
const tx = (inputs: Hex[][]) => ({ keccakInputs: inputs }) as TxFacts;

it("the list's keys, then the trace's the list has not yet, once each",
  () => {
    const k = keysFor(d, list([A, B]), tx([[B, SLOT], [C, SLOT],
      [C, SLOT], [A, w("9")]]), SLOT);
    expect(k.values).toEqual([{ value: A, source: "playerList[0]" },
      { value: B, source: "playerList[1]" }, { value: C }]);
    expect(k.provenance).toEqual({ list: "playerList" });
  });

it("no trace key the list has: the list's keys alone", () => {
  const k = keysFor(d, list([A, B]), tx([[A, SLOT], [B, SLOT]]), SLOT);
  expect(k.values.map((v) => v.value)).toEqual([A, B]);
});
