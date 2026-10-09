import { it, expect } from "vitest";
import { fixture } from "../../../test/io";
import { testProject } from "../../../test/project";
import { A, B, C, NAME_C, lastBlock } from "../../../test/expect";
import { decode } from "../decode";

const vy = fixture<{ vyper: { entries:
  { key: string; members: { slot: string; name: string;
    text: string }[] }[] } }>("arcade-vyper");
const POINT = "vyper:0";

it("vyRule: each player's words equal the fixture's vyper.entries",
  async () => {
    const p = await testProject();
    const d = await decode(p, p.decodings["vyper/rule"], POINT);
    for (const e of vy.vyper.entries) {
      const path = `players[${e.key}]`;
      let word = 0n; // (a long name's bytes: one member a word)
      for (const m of e.members) {
        const field = m.name.replace(/ \(.*\)$/, "");
        const n = d.byPath.get(`${path}.${field}`)!;
        const role = m.name.endsWith("(length)") ? "length" : "value";
        const r = n.regions.find((x) => x.role === role)!;
        const k = m.name.endsWith("(bytes)") ? word++ : 0n;
        expect(r.slot! + k, `${path} ${m.name}`).toBe(BigInt(m.slot));
        // (the fixture's text is its word's: a long name's 32 bytes, in
        // order)
        if (m.name.endsWith("(bytes)")) {
          const at = Number(k) * 32;
          expect(JSON.parse(n.value!.text).slice(at, at + 32))
            .toBe(JSON.parse(m.text));
        } else if (field === "lastBlock") {
          // (the scenario's blocks, not anvil's: test/expect.ts)
          expect(n.value!.text).toBe(lastBlock.mid[[A, B, C].indexOf(
            path)]);
        } else if (role === "value") expect(n.value!.text).toBe(m.text);
        else expect(String(JSON.parse(n.value!.text).length))
          .toBe(m.text);
      }
    }
  });

it("vyRule: carol's name is 34 bytes over two words", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings["vyper/rule"], POINT);
  const n = d.byPath.get(`${C}.name`)!;
  expect(n.value!.text).toBe(`"${NAME_C}"`);
  const data = n.regions.find((r) => r.role === "value")!;
  expect([data.offset, data.length]).toEqual([0, 34]);
  const words = vy.vyper.entries[2].members;
  expect(data.slot).toBe(BigInt(words[7].slot));
});

it("the compilation is badged hand-written; keys from the trace",
  async () => {
    const p = await testProject();
    const c = await p.compilation(p.decodings["vyper/rule"].compilation);
    expect([c.id, c.language, c.provenance])
      .toEqual(["arcade-vy-rule", "vyper", "hand-written"]);
    expect(c.stateVariables.map((v) => v.identifier)).toEqual(["players"]);
    const d = await decode(p, p.decodings["vyper/rule"], POINT);
    expect(d.graphs.get("players")!.inputs[0].values.map((v) => v.value))
      .toEqual([A, B, C].map((x) =>
        "0x" + x.slice(10, 50).padStart(64, "0")));
    expect(p.bookmarks.find((b) => b.id === "vyper")!.decoding)
      .toBe("vyper");
  });
