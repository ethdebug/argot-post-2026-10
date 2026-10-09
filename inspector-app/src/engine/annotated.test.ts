// The annotated layer's units and labels, at the post's shared moment
// (raw-annotated: transaction 11, step 986), checked against the story
// (test/expect.ts); and the short value formats
import { describe, it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { layout } from "./layout";
import { pointOf } from "./scene";
import {
  groupsOf, onChainNames, shortValue, unitsOf, type Part,
} from "./annotated";
import { A, B, C, MOTD, NAME_C, mid } from "../../test/expect";
import type { ValueNode } from "./types";

const text = (ps: Part[]) => ps.map((p) => p.text).join("");
const story = new Map(mid);

async function at(id: string) {
  const p = await testProject();
  const pt = pointOf("raw-annotated", 0);
  return decode(p, p.decodings[id], pt);
}

describe("the shared moment's labels", () => {
  it("storage: one label a variable (an entry each), the story's values",
    async () => {
      const d = await at("raw-annotated");
      const names = onChainNames(d);
      expect(names.get(C.slice(8, -1))).toBe("carol");
      const l = layout(d, "storage", { rows: "all" });
      const us = unitsOf(d, l, { names });
      const labels = us.map((u) => text(u.label[0]));
      expect(labels).toEqual([
        "playerList: [alice, bob, carol]",
        `motd: "${MOTD[0].slice(0, 23)}…"`,
        "totalScore 140 · totalHits 7",
        "players[alice]: score 30 · combo 2 · bestCombo 2 …",
        "players[bob]: score 10 · combo 1 · bestCombo 1 …",
        "players[carol]: score 100 · combo 0 · bestCombo 4 …"]);
      // (each number the story's)
      for (const [p, who] of [[A, "alice"], [B, "bob"], [C, "carol"]]) {
        const s = labels.find((x) => x.startsWith(`players[${who}]`))!;
        for (const f of ["score", "combo", "bestCombo"]) {
          expect(s).toContain(`${f} ${story.get(`${p}.${f}`)}`);
        }
      }
      expect(story.get("totalScore")).toBe("140");
      expect(story.get("totalHits")).toBe("7");
      // (two colours in the packed slot; a record's fields each its own)
      expect([...us[2].colours.values()]).toEqual([1, 2]);
      expect(new Set(us[5].label[0].map((x) => x.k).filter(Boolean)).size)
        .toBe(3);
      // carol's name, in rows of its own: a label of its own, her name
      const shown = l.rows;
      const gs = groupsOf(us, l, shown, { d, names });
      const name = gs.find((g) => !g.main && us[g.unit].id === C)!;
      expect(text(name.label[0])).toBe(
        `players[carol].name: "${NAME_C.slice(0, 23)}…"`);
    });

  it("the hand-written stack and memory: the moment's call chain, the " +
    "keccak scratch, the free memory pointer", async () => {
    const s = await at("raw-annotated");
    const d = await at("raw-annotated/hand");
    const names = onChainNames(s);
    const of = (loc: "stack" | "memory") => {
      const us = unitsOf(d, layout(d, loc), { names, hand: true });
      expect(us.every((u) => u.hand)).toBe(true);
      return us.map((u) => text(u.label[0]));
    };
    expect(of("stack")).toEqual(["return → _resetCombo: 0x1420",
      "return → play: 0x12cc", "return → dispatcher: 0x0496",
      "selector: 0x93e84cd9"]);
    expect(of("memory")).toEqual(["keccak input: key carol · slot 3",
      "free memory pointer: 0xe0",
      "_rolledHit's encoding: length 64 · prevrandao 0xe94e…3a62 · " +
      "sender carol"]);
  });
});

describe("short values", () => {
  const node = (typeText: string, text: string): ValueNode => ({ path: "x",
    label: "x", root: "x", type: "", typeText, regions: [],
    value: { text, hex: "0x" } });
  const names = new Map([["0x90f79bf6eb2c4f870365e785982e1f101e93b906",
    "carol"]]);
  it("an address by its on-chain name, else short", () => {
    expect(shortValue(node("address",
      "0x90f79bf6eb2c4f870365e785982e1f101e93b906"), names)).toBe("carol");
    expect(shortValue(node("address",
      "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"), names))
      .toBe("0x7099…79c8");
  });
  it("a string cut, quoted; bytes without leading zero bytes", () => {
    expect(shortValue(node("string", '"gl hf"'), names)).toBe('"gl hf"');
    expect(shortValue(node("string", JSON.stringify(NAME_C)), names,
      { text: 10 })).toBe('"carol, th…"');
    expect(shortValue(node("bytes32", `0x${"0".repeat(60)}1420`), names))
      .toBe("0x1420");
    expect(shortValue(node("bytes32", `0x${"ab".repeat(32)}`), names))
      .toBe("0xabab…abab");
    expect(shortValue(node("uint64", "100"), names)).toBe("100");
  });
});
