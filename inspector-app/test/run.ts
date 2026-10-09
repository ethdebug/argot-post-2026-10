// The arcade scenario with its builds, from files, and its runs (each
// build run once per test file)
import fs from "node:fs";
import path from "node:path";
import * as evm from "../src/engine/run/evm";
import { scenarioOf } from "../src/engine/run/scenario";
import { runScenario } from "../src/engine/run/run";
import type { BuildId, Run, Scenario } from "../src/engine/run/types";

export const BUILDS = ["sol", "vy", "bug-O0", "bug-O2"] as const;
const dir = path.join(__dirname, "..", "scenarios", "arcade");
const json = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));

export const arcade = (): Scenario => scenarioOf({
  ...json("scenario.json"),
  builds: Object.fromEntries(BUILDS.map((b) =>
    [b, json(`builds/${b}/build.json`)])),
});

const runs = new Map<BuildId, Promise<Run>>();
export const runOf = (build: BuildId): Promise<Run> => {
  if (!runs.has(build)) runs.set(build, runScenario(arcade(), build, evm));
  return runs.get(build)!;
};

// ------------------------------------------------- a Project over runs
// (test-only, until MomentSource, T4.2: a timeline per build, its points
// the moments asked for, their facts from the run)

import type { Project } from "../src/engine/project";
import type {
  Compilation, Decoding, Hex, Snapshot, TimelinePoint, TxFacts, Variable,
} from "../src/engine/types";
import type { MomentRef } from "../src/engine/run/types";
import { factsOf } from "../src/engine/run/facts";

export const momentId = (m: MomentRef) => `${m.tx}:${m.step}`;
const ZERO: Hex = `0x${"0".repeat(64)}`;
const SOL_BASE = 3n;   // (players' slot in Arcade.sol)

// A run knows every slot of its contract: one no transaction wrote is
// zero. (A snapshot will carry the slots its decodings read; T4.2.)
class Total extends Map<Hex, Hex> {
  get(k: Hex): Hex { return super.get(k) ?? ZERO; }
}

const compilationOf = (id: string, build: BuildId,
  only?: string[]): Compilation => {
  const b = arcade().builds[build];
  const vars = ((b.programs!.runtime.context as { variables: Variable[] })
    .variables).filter((v) => !only || only.includes(v.identifier));
  return { id, language: b.language, compiler: b.compiler,
    provenance: "compiler", sources: b.sources,
    types: b.resources!.types, templates: b.resources!.pointers,
    stateVariables: vars };
};

// The keys solc's rule finds in a Vyper run: Vyper hashes slot . key,
// solc key . slot; so its (slot, account) inputs as (account, solc's
// slot) (as the Vyper fixture's keys were made)
const asSolc = (inputs: Hex[][], accounts: Hex[]): Hex[][] =>
  inputs.flatMap((ws) => ws.length === 2 && accounts.includes(
    `0x${ws[1].slice(26)}` as Hex)
    ? [[ws[1], `0x${SOL_BASE.toString(16).padStart(64, "0")}` as Hex]]
    : []);

export async function runProject(moments: Record<"sol" | "vy",
  MomentRef[]>): Promise<Project> {
  const accounts = arcade().accounts.map((a) => a.address);
  const point = (run: Run, m: MomentRef, vy: boolean): TimelinePoint => {
    const s = run.stateAt(m);
    // (the mapping keys of the story so far, from every transaction)
    const inputs = run.txs.slice(0, m.tx + 1).flatMap((t) =>
      t.keccakInputs);
    const transaction: TxFacts = { ...factsOf(run, m.tx),
      keccakInputs: vy ? asSolc(inputs, accounts) : inputs };
    const snapshot: Snapshot = { ...s, storage: new Total(s.storage) };
    return { id: momentId(m), label: momentId(m), at: { tx: "0x",
      step: m.step === "end" ? -1 : m.step }, snapshot, transaction };
  };
  const timelines = Object.fromEntries(await Promise.all(
    (["sol", "vy"] as const).map(async (b) => {
      const run = await runOf(b);
      return [b, { id: b, contract: { address: run.address,
        compilation: "arcade-sol" }, bookmarks: [],
        points: moments[b].map((m) => point(run, m, b === "vy")) }];
    })));
  const compilations: Record<string, Compilation> = {
    "arcade-sol": compilationOf("arcade-sol", "sol"),
    // (solc's rule for players, over Vyper's storage)
    "arcade-sol-players": compilationOf("arcade-sol-players", "sol",
      ["players"]),
  };
  const decodings: Record<string, Decoding> = {
    sol: { id: "sol", compilation: "arcade-sol", timeline: "sol",
      variables: "state", keys: { from: "list", path: "playerList" } },
    vyAsSol: { id: "vyAsSol", compilation: "arcade-sol-players",
      timeline: "vy", variables: "state", keys: { from: "trace" } },
  };
  return { bookmarks: [], scenes: [], decodings, memo: new Map(),
    timeline: async (id) => timelines[id],
    compilation: async (id) => compilations[id] };
}
