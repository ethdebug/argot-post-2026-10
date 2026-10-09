// @ethdebug/evm, vendored (vendor/PIN): the parts of its API the runner
// uses, on Arcade
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { Executor, type FrameEvent, type TraceStep } from "@ethdebug/evm";
import { buildOf } from "./build";
import { encodeCall } from "./abi";
import { A } from "../../../test/expect";

const sol = buildOf(JSON.parse(fs.readFileSync(path.join(__dirname, "..",
  "..", "..", "scenarios", "arcade", "builds", "sol", "build.json"),
  "utf8")));
const DEPLOYER = "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const ALICE = A.slice("players[".length, -1);

describe("@ethdebug/evm", () => {
  it("deploys Arcade and runs alice's join in a block", async () => {
    const evm = new Executor({ chainId: 31337n });
    await evm.fund(DEPLOYER, 10n ** 22n);
    await evm.fund(ALICE, 10n ** 22n);
    const deployed = await evm.deploy({ from: DEPLOYER, create: sol.create,
      block: { number: 1n, timestamp: 12n, prevrandao: 1n } });
    expect(deployed.success).toBe(true);
    // (anvil's first contract from its account 0)
    expect(deployed.address).toBe(
      "0x5fbdb2315678afecb367f032d93f642f64180aa3");
    const steps: TraceStep[] = [];
    const frames: FrameEvent[] = [];
    const joined = await evm.call({ from: ALICE, to: deployed.address!,
      input: encodeCall("join(string)", ["alice"]),
      block: { number: 2n, timestamp: 24n, prevrandao: 2n } },
    { step: (s) => steps.push(s), frame: (e) => frames.push(e),
      memory: "changed" });
    expect(joined.success).toBe(true);
    expect(steps.length).toBeGreaterThan(100);
    expect(new Set(steps.map((s) => s.depth))).toEqual(new Set([0]));
    expect(steps.some((s) => s.opcode === "SSTORE")).toBe(true);
    expect(frames.map((f) => f.kind)).toEqual(["enter", "exit"]);
    // playerList's length (slot 0) is 1
    expect(await evm.getStorage(0n, deployed.address)).toBe(1n);
  });
});
