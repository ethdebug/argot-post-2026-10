import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { blockOf, rolledHit, scenarioOf } from "./scenario";
import { A, B, C, MOTD, NAME_C } from "../../../test/expect";

const json = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..",
  "..", "scenarios", "arcade", "scenario.json"), "utf8"));
const s = scenarioOf(json);
const address = (name: string) =>
  s.accounts.find((a) => a.name === name)!.address;
const key = (p: string) => p.slice("players[".length, -1);

describe("the arcade scenario", () => {
  it("reads bigints from decimal strings", () => {
    expect(s.chain).toEqual({ hardfork: "prague", chainId: 31337n });
    expect(typeof s.genesis.timestamp).toBe("bigint");
    expect(s.accounts.every((a) => a.balance > 0n)).toBe(true);
  });
  it("has alice, bob and carol at test/expect.ts's addresses", () => {
    expect([address("alice"), address("bob"), address("carol")])
      .toEqual([A, B, C].map(key));
  });
  it("tells README's story", () => {
    const calls = s.transactions.map((t) => [t.from, t.label]);
    const play = (who: string) => [who, "play()"];
    expect(calls).toEqual([
      ["deployer", "deploy"],
      ["alice", 'join("alice")'], ["bob", 'join("bob")'],
      ["carol", `join("${NAME_C}")`],
      play("alice"), play("alice"), play("bob"), play("carol"),
      play("carol"), play("carol"), play("carol"), play("carol"),
      play("alice"),
      ["deployer", `setMotd("${MOTD[1]}")`],
    ]);
  });
  it("rolls each play's outcome: carol's fifth play misses", () => {
    const hits = s.transactions.flatMap((t) => t.label === "play()"
      ? [rolledHit(t.block.prevrandao, address(t.from))] : []);
    expect(hits).toEqual([true, true, true, true, true, true, true, false,
      true]);
  });
  it("puts each transaction in its own block", () => {
    expect(blockOf(s, 0).number).toBe(s.genesis.number + 1n);
    expect(blockOf(s, 13).number).toBe(s.genesis.number + 14n);
    expect(blockOf(s, 13).timestamp).toBe(s.genesis.timestamp + 14n * 12n);
    expect(blockOf(s, 4).prevrandao).toBe(s.transactions[4].block.prevrandao);
  });
});

describe("scenarioOf", () => {
  it("reads the builds it is given by buildOf", () => {
    const vy = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "..",
      "..", "scenarios", "arcade", "builds", "vy", "build.json"), "utf8"));
    expect(scenarioOf({ ...json, builds: { vy } }).builds.vy.compilation)
      .toBe("arcade-vy-rule");
    expect(() => scenarioOf({ ...json, builds: { vy: {} } }))
      .toThrow(/build/);
  });
  it("refuses a scenario with a missing part", () => {
    expect(() => scenarioOf({ ...json, transactions: undefined }))
      .toThrow(/transactions/);
    expect(() => scenarioOf({ ...json, transactions: [{
      ...json.transactions[1], from: "dave" }] })).toThrow(/dave/);
  });
});

describe("rolledHit", () => {
  it("is keccak256(prevrandao . sender) % 3 != 0", () => {
    // keccak256 of 64 zero bytes = 0xad3228b6…5fb5 (mod 3 = 1: a hit)
    expect(rolledHit("0x00", "0x00")).toBe(true);
  });
});
