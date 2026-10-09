// The runner on the arcade scenario, every build. (After a change to the
// scenario or a build: UPDATE=1 npx vitest run src/engine/run/run.test.ts
// writes digests.json.)
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as evm from "./evm";
import { digest, runScenario } from "./run";
import { opByte } from "./opcodes";
import { arcade, BUILDS, runOf } from "../../../test/run";
import type { Hex } from "../types";

const file = path.join(__dirname, "..", "..", "..", "scenarios", "arcade",
  "digests.json");
const digests = (): Record<string, string> =>
  fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
const word = (n: bigint): Hex => `0x${n.toString(16).padStart(64, "0")}`;

describe.each(BUILDS)("runScenario: %s", (build) => {
  it("gives the same digest twice, the one in digests.json", async () => {
    const [a, b] = [await runOf(build),
      await runScenario(arcade(), build, evm)];
    const d = await digest(a);
    expect(await digest(b)).toBe(d);
    if (process.env.UPDATE) {
      fs.writeFileSync(file, JSON.stringify({ ...digests(), [build]: d },
        null, 2) + "\n");
    }
    expect(d).toBe(digests()[build]);
  });
  it("runs every transaction successfully", async () => {
    const run = await runOf(build);
    expect(run.txs).toHaveLength(arcade().transactions.length);
    for (const tx of run.txs) expect(tx.result.success, tx.label).toBe(true);
    expect(run.address).toBe("0x5fbdb2315678afecb367f032d93f642f64180aa3");
  });
  it("after each SSTORE, holds its value at the next trace step",
    async () => {
      const run = await runOf(build);
      let n = 0;
      run.txs.forEach((tx, k) => {
        for (const w of tx.storage) {
          if (run.txs[k].frames[w.frame].address !== run.address) continue;
          expect(tx.op[w.step]).toBe(opByte("SSTORE"));
          const at = run.stateAt({ tx: k, step: w.step + 1 }).storage;
          expect(at.get(w.slot)).toBe(w.value);
          n++;
        }
      });
      expect(n).toBeGreaterThan(20);
    });
  it("at a transaction's end, holds what the EVM holds", async () => {
    const s = arcade();
    const ch = evm.chain(s.chain.chainId);
    const run = await runScenario(s, build, evm, ch);
    const end = run.stateAt({ tx: run.txs.length - 1, step: "end" });
    expect(end.storage.size).toBeGreaterThan(10);
    for (const [slot, value] of end.storage) {
      expect(word(await ch.storage(run.address, BigInt(slot))), slot)
        .toBe(value);
    }
    expect(end.memory).toBeUndefined();
    expect(end.stack).toBeUndefined();
    expect(end.calldata).toBeUndefined();
  });
  it("records op bytes as the code has them", async () => {
    const run = await runOf(build);
    const code = Buffer.from(arcade().builds[build].create.slice(2), "hex");
    const tx = run.txs[0];
    for (let i = 0; i < tx.steps; i++) {
      expect(tx.op[i], `trace step ${i}`).toBe(code[tx.pc[i]]);
    }
  });
});

describe("runScenario", () => {
  it("runs the four builds in under 2 s", async () => {
    const t = performance.now();
    for (const b of BUILDS) await runScenario(arcade(), b, evm);
    expect(performance.now() - t).toBeLessThan(2000);
  });
});
