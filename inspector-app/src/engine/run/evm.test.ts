// The runner's seam to @ethdebug/evm (vendor/PIN), on Arcade
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { chain } from "./evm";
import { buildOf } from "./build";
import { encodeCall } from "./abi";
import { opByte } from "./opcodes";
import { A } from "../../../test/expect";

const sol = buildOf(JSON.parse(fs.readFileSync(path.join(__dirname, "..",
  "..", "..", "scenarios", "arcade", "builds", "sol", "build.json"),
  "utf8")));
const DEPLOYER = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const ALICE = A.slice("players[".length, -1) as `0x${string}`;

describe("chain", () => {
  it("deploys Arcade and runs alice's join in a block", async () => {
    const ch = chain(31337n);
    await ch.fund(DEPLOYER, 10n ** 22n);
    await ch.fund(ALICE, 10n ** 22n);
    const deployed = await ch.send({ from: DEPLOYER, input: sol.create,
      block: { number: 1n, timestamp: 12n, prevrandao: "0x01" } });
    expect(deployed.success).toBe(true);
    // (anvil's first contract from its account 0)
    expect(deployed.created).toBe(
      "0x5fbdb2315678afecb367f032d93f642f64180aa3");
    const joined = await ch.send({ from: ALICE, to: deployed.created!,
      input: encodeCall("join(string)", ["alice"]),
      block: { number: 2n, timestamp: 24n, prevrandao: "0x02" } });
    expect(joined.success).toBe(true);
    expect(joined.steps.length).toBeGreaterThan(100);
    expect(new Set(joined.steps.map((s) => s.depth))).toEqual(new Set([0]));
    expect(joined.steps.some((s) => s.op === opByte("SSTORE"))).toBe(true);
    expect(joined.frames).toHaveLength(1);
    expect(joined.frames[0]).toMatchObject({ first: 0,
      last: joined.steps.length - 1, reverted: false, caller: ALICE });
    expect(new Set(joined.frameOf)).toEqual(new Set([0]));
    // playerList's length (slot 0) is 1
    expect(await ch.storage(deployed.created!, 0n)).toBe(1n);
  });
});
