// The runner tells the fixtures' story: the fixtures' transactions read
// and write the same slots, and the raw and memory fixtures' trace steps
// are the runs' (addendum §8; test/expect.ts's values, from the runs and
// the snapshots: engine/source.test.ts)
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fromFixture } from "../fixtures/legacy";
import { factsOf } from "./facts";
import { opName } from "./opcodes";
import { arcade, runOf } from "../../../test/run";
import { A } from "../../../test/expect";

const fixture = (id: string) => JSON.parse(fs.readFileSync(path.join(
  __dirname, "..", "..", "..", "..", "demos", "inspector", "fixtures",
  `${id}.json`), "utf8"));
const hex = (b: Uint8Array) => `0x${Buffer.from(b).toString("hex")}`;

describe("the story's transactions, from the runs", () => {
  it("each fixture's transaction read and wrote the same slots", async () => {
    const sol = await runOf("sol");
    for (const [id, tx] of [["arcade-mid", 11], ["arcade-alice", 12],
      ["arcade-motd", 13]] as const) {
      const f = fromFixture(fixture(id), id).timeline.points[1].transaction!;
      const r = factsOf(sol, tx);
      expect([...r.reads].sort(), id).toEqual([...f.reads].sort());
      expect([...r.writes].sort(), id).toEqual([...f.writes].sort());
      expect(r.input, id).toBe(fixture(id).tx.input);
    }
  });
});

describe("the raw moment: carol's join, trace step 569", () => {
  const raw = fixture("raw");
  it("has raw.json's pc, op, stack, memory and calldata", async () => {
    const sol = await runOf("sol");
    const t = sol.txs[3];
    expect(t.steps).toBe(raw.step.of);
    expect([t.pc[569], opName(t.op[569])]).toEqual([2908, "ADD"]);
    expect([raw.step.pc, raw.step.op]).toEqual([2908, "ADD"]);
    const s = sol.stateAt({ tx: 3, step: 569 });
    expect(s.stack).toEqual(raw.stack);
    expect(hex(s.memory!)).toBe(raw.memory);
    expect(hex(s.calldata!)).toBe(raw.calldata);
  });
  it("has raw.json's storage, and the join's later slots as zero",
    async () => {
      const s = (await runOf("sol")).stateAt({ tx: 3, step: 569 }).storage;
      const later = [...s.keys()].filter((k) => !(k in raw.storage));
      for (const [slot, w] of Object.entries(raw.storage)) {
        expect(s.get(slot as never), slot).toBe(w);
      }
      // (her name's second word, her record's name slot read, and
      // playerList[2]: touched after trace step 569)
      expect(later).toHaveLength(3);
      for (const k of later) expect(BigInt(s.get(k)!)).toBe(0n);
    });
});

describe("the memory fixture's paused trace steps, in the bug runs", () => {
  const mem = fixture("memory");
  const s = arcade();
  // alice's third hit (transaction 12): its roll hashes prevrandao (in
  // memory's word 0) and alice; the fixture's block and prevrandao were
  // anvil's
  const prevrandao = s.transactions[12].block.prevrandao;
  it.each([[0, "bug-O0"], [1, "bug-O2"]] as const)("%i: %s",
    async (level, build) => {
      const run = await runOf(build);
      const t = run.txs[12];
      expect(t.steps).toBe(mem.levels[level].trace.steps);
      for (const p of mem.levels[level].points) {
        for (const at of p.steps) {
          const what = `${build} ${p.id} ${at.step}`;
          expect([t.pc[at.step], opName(t.op[at.step])], what)
            .toEqual([at.pc, at.op]);
          // (memory.json's memory is after its trace step's instruction)
          const m = run.stateAt({ tx: 12, step: at.step + 1 }).memory!;
          const f = Buffer.from(at.memory.slice(2), "hex");
          expect(m.length, what).toBe(f.length);
          const differ = [...m.keys()].filter((i) => m[i] !== f[i]);
          // only prevrandao (word 0) and, at -O 0, the block
          // number's low byte (byte 1439: 13 here)
          const allowed = (i: number) => i < 32 ||
            (level === 0 && i === 1439);
          expect(differ.filter((i) => !allowed(i)), what).toEqual([]);
          if (differ.some((i) => i < 32)) {
            expect(hex(m.slice(0, 32)), what).toBe(prevrandao);
          }
          if (level === 0) expect(m[1439], what).toBe(13);
        }
      }
    });
});
