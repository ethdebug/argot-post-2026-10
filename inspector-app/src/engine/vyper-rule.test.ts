import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { A, B, C, MOTD, NAME_C } from "../../test/expect";
import { decode } from "./decode";
import { keccak } from "./run/abi";
import type { ValueNode } from "./types";

const POINT = "vyper:0";

it("vyRule: carol's name is 34 bytes over two words", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings["vyper/rule"], POINT);
  const n = d.byPath.get(`${C}.name`)!;
  expect(n.value!.text).toBe(`"${NAME_C}"`);
  const data = n.regions.find((r) => r.role === "value")!;
  expect([data.offset, data.length]).toEqual([0, 34]);
});

it("the compilation is badged hand-written; keys from the trace",
  async () => {
    const p = await testProject();
    const c = await p.compilation(p.decodings["vyper/rule"].compilation);
    expect([c.id, c.language, c.provenance])
      .toEqual(["arcade-vy-rule", "vyper", "hand-written"]);
    expect(c.stateVariables.map((v) => v.identifier)).toEqual(["playerList",
      "motd", "totalScore", "totalHits", "players"]);
    const d = await decode(p, p.decodings["vyper/rule"], POINT);
    expect(d.graphs.get("players")!.inputs[0].values.map((v) => v.value))
      .toEqual([A, B, C].map((x) =>
        "0x" + x.slice(10, 50).padStart(64, "0")));
    expect(p.bookmarks.find((b) => b.id === "vyper")!.decoding)
      .toBe("vyper");
  });

// Every Vyper storage variable, decoded by the hand-written layout, and
// the run's own storage: the values the scenario wrote, at the slots
// Vyper 0.4.3 gives them (whole slots, declaration order, nothing packed;
// a String's bytes from its length's next slot; a HashMap entry at
// keccak256(slot . key)); and every word the run holds owned by them
it("vyRule: every variable, as the run stores it", async () => {
  const p = await testProject();
  const [point] = (await p.timeline("scene:vyper")).points;
  const d = await decode(p, p.decodings["vyper/rule"], point.id);
  const text = (path: string) => d.byPath.get(path)?.value?.text;
  const keys = [A, B, C].map((x) => x.slice(8, -1));
  expect(d.tree.map((n) => n.path)).toEqual(["playerList", "motd",
    "totalScore", "totalHits", "players"]);
  expect(keys.map((_, i) => text(`playerList[${i}]`))).toEqual(keys);
  expect(text("motd")).toBe(JSON.stringify(MOTD[0]));
  expect([text("totalScore"), text("totalHits")]).toEqual(["140", "7"]);
  expect([A, B, C].map((x) => text(`${x}.score`)))
    .toEqual(["30", "10", "100"]);
  expect([A, B, C].map((x) => text(`${x}.name`)))
    .toEqual(['"alice"', '"bob"', `"${NAME_C}"`]);
  // (the slots: Vyper's, computed here)
  const slot = (path: string, role = "value") => d.byPath.get(path)!
    .regions.find((r) => r.role === role)!.slot;
  const word = (n: bigint) => n.toString(16).padStart(64, "0");
  const entry = (key: string) => BigInt(keccak(Uint8Array.from(Buffer.from(
    word(108n) + key.slice(2).padStart(64, "0"), "hex"))));
  expect([slot("playerList", "length"), slot("playerList[2]")])
    .toEqual([0n, 3n]);
  expect([slot("motd", "length"), slot("motd")]).toEqual([101n, 102n]);
  expect([slot("totalScore"), slot("totalHits")]).toEqual([106n, 107n]);
  for (const [i, x] of [A, B, C].entries()) {
    const e = entry(keys[i]);
    expect([slot(`${x}.score`), slot(`${x}.lastBlock`),
      slot(`${x}.name`, "length"), slot(`${x}.name`)])
      .toEqual([e, e + 5n, e + 6n, e + 7n]);
  }
  // (every word the run holds is a variable's)
  const owned = new Set<bigint>();
  const visit = (n: ValueNode) => {
    for (const r of n.regions) {
      if (r.slot === undefined) continue;
      for (let k = 0n; k * 32n < BigInt(r.offset + r.length); k++) {
        owned.add(r.slot + k);
      }
    }
    n.children?.forEach(visit);
  };
  d.tree.forEach(visit);
  const held = [...point.snapshot.storage].filter(([, v]) =>
    !/^0x0*$/.test(v)).map(([k]) => BigInt(k));
  expect(held.length).toBeGreaterThan(30);
  for (const k of held) expect(owned.has(k), k.toString(16)).toBe(true);
});
