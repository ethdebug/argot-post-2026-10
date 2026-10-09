// The annotated layer's units and labels, at the post's shared moment
// (reveal: transaction 11, step 986), checked against the story
// (test/expect.ts); and the short value formats
import { describe, it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { layout } from "./layout";
import { pointOf } from "./scene";
import {
  cellsOf, notesOf, onChainNames, shortValue, unitsOf,
} from "./annotated";
import { A, B, C, MOTD, NAME_C, mid } from "../../test/expect";
import type { ValueNode } from "./types";

const story = new Map(mid);

async function at(id: string) {
  const p = await testProject();
  const pt = pointOf("reveal", 0);
  return decode(p, p.decodings[id], pt);
}

describe("the shared moment's popovers", () => {
  it("storage: a tint a top-level value (a record each), a popover " +
    "each, the story's values", async () => {
    const d = await at("reveal");
    const names = onChainNames(d);
    expect(names.get(C.slice(8, -1))).toBe("carol");
    const l = layout(d, "storage", { rows: "all" });
    const us = unitsOf(d, l);
    expect(us.map((u) => u.path)).toEqual(["playerList", "motd",
      "totalScore", "totalHits", A, B, C]);
    // (each its own child colour, never the selection's yellow)
    expect(us.map((u) => u.k)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    // (a record's slot: every byte its record's, one unit)
    const cs = cellsOf(us, l, l.rows.find((r) => r.how.endsWith(
      "slot 3)"))!.address);
    expect(new Set(cs).size).toBe(1);
    expect(cs[0]).toBeGreaterThanOrEqual(4);
    const notes = notesOf(d, l, us, l.rows, { names });
    // (a value's popover badged in its colour; the totals, each theirs;
    // a record's key facts, one line: combo, then bestCombo, the ones a
    // card leaves out first; her name in full)
    expect(notes.map((n) => n.badge)).toEqual([0, 1, undefined, 4, 5, 6]);
    expect(notes[2].items.map((x) => x.unit)).toEqual([2, 3]);
    expect(notes[5].items.map((x) => [x.line, x.drop])).toEqual([[0,
      undefined], [0, 1], [0, 2], [0, undefined]]);
    const said = notes.map((n) => `${n.how} : ${n.items.map((x) =>
      x.text).join(" · ")}`);
    const rec = (p: string, who: string, name: string) =>
      `players[${who}] : ${["score", "combo", "bestCombo"].map((f) =>
        `${f} ${story.get(`${p}.${f}`)}`).join(" · ")} · name ${name}`;
    expect(said).toEqual([
      "playerList : alice · bob · carol",
      `motd : "${MOTD[0].slice(0, 23)}…"`,
      `slot 2 : totalScore ${story.get("totalScore")} · totalHits ${
        story.get("totalHits")}`,
      rec(A, "alice", '"alice"'), rec(B, "bob", '"bob"'),
      rec(C, "carol", `"${NAME_C}"`)]);
    // (carol's: her record's two slots, and her name's two, apart)
    expect(notes[5].runs.map((r) => r.length)).toEqual([2, 2]);
  });

  it("the hand-written stack: one popover for its run (or one an item, " +
    "its name alone), the moment's call chain", async () => {
    const s = await at("reveal");
    const d = await at("reveal/hand");
    const l = layout(d, "stack");
    const us = unitsOf(d, l);
    const [n, ...more] = notesOf(d, l, us, l.rows,
      { names: onChainNames(s), perRun: true });
    expect(more).toEqual([]);
    // (abbreviated, the stack shows its values: the names alone)
    expect(notesOf(d, l, us, l.rows, { names: onChainNames(s),
      perRun: true, values: false })[0].items[0].text)
      .toBe("return → _resetCombo");
    expect(n.how).toBe("stack 0–3");
    expect(n.items.map((x) => [x.text, x.seg, x.line, x.unit])).toEqual([
      ["return → _resetCombo 0x00…001420", 0, 0, 0],
      ["return → play 0x00…0012cc", 0, 1, 1],
      ["return → dispatcher 0x00…000496", 0, 2, 2],
      ["selector 0x00…e84cd9", 0, 3, 3]]);
    // (the figure's: one an item, its name badged, nothing else)
    expect(notesOf(d, l, us, l.rows, { names: onChainNames(s),
      each: true }).map((x) => [x.how, x.badge, x.items, x.runs]))
      .toEqual([["return → _resetCombo", 0, [], [[l.rows[0].address]]],
        ["return → play", 1, [], [[l.rows[1].address]]],
        ["return → dispatcher", 2, [], [[l.rows[2].address]]],
        ["selector", 3, [], [[l.rows[3].address]]]]);
    // (and memory's, kept for later figures: the keccak scratch, the
    // free memory pointer)
    const m = layout(d, "memory");
    const ms = notesOf(d, m, unitsOf(d, m), m.rows,
      { names: onChainNames(s), perRun: true });
    expect(ms.map((n) => n.items.map((x) => [x.text, x.line, x.unit])))
      .toEqual([
        [["keccak input", 0, 0], ["key carol", 1, undefined],
          ["slot 3", 1, undefined], ["free memory pointer 0xe0", 2, 1]],
        [["_rolledHit's encoding", 0, 2], ["length 64", 1, undefined],
          ["prevrandao 0xe94e…3a62", 1, undefined],
          ["sender carol", 2, undefined]]]);
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
  it("a string cut, quoted; bytes without leading zero bytes; a stack item's padded", () => {
    expect(shortValue(node("string", '"gl hf"'), names)).toBe('"gl hf"');
    expect(shortValue(node("string", JSON.stringify(NAME_C)), names,
      { text: 10 })).toBe('"carol, th…"');
    expect(shortValue(node("bytes32", `0x${"0".repeat(60)}1420`), names))
      .toBe("0x1420");
    // (a stack item's: as the stack shows it)
    expect(shortValue(node("bytes32", `0x${"0".repeat(60)}1420`), names,
      { word: true })).toBe("0x00…001420");
    expect(shortValue(node("bytes32", `0x${"ab".repeat(32)}`), names))
      .toBe("0xabab…abab");
    expect(shortValue(node("uint64", "100"), names)).toBe("100");
  });
});
