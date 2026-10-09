// The arcade scenario with its builds, from files, and its runs (each
// build run once per test file)
import fs from "node:fs";
import path from "node:path";
import * as evm from "../src/engine/run/evm";
import { scenarioOf } from "../src/engine/run/scenario";
import { runScenario } from "../src/engine/run/run";
import type { BuildId, Run, Scenario } from "../src/engine/run/types";
import type { Runs } from "../src/engine/project";

export const BUILDS = ["sol", "vy", "bug-O0", "bug-O2"] as const;
const dir = path.join(__dirname, "..", "scenarios", "arcade");
const json = (p: string) =>
  JSON.parse(fs.readFileSync(path.join(dir, p), "utf8"));

export const arcade = (): Scenario => scenarioOf({
  ...json("scenario.json"),
  builds: Object.fromEntries(BUILDS.map((b) =>
    [b, json(`builds/${b}/build.json`)])),
});

const ran = new Map<BuildId, Promise<Run>>();
let scenario: Scenario | undefined;
export const runOf = (build: BuildId): Promise<Run> => {
  if (!ran.has(build)) {
    ran.set(build, runScenario(scenario ??= arcade(), build, evm));
  }
  return ran.get(build)!;
};

// The runs, for a Project in authoring mode (engine/project.ts Runs)
export const runs: Runs = {
  scenario: async () => scenario ??= arcade(),
  run: async (_, build) => runOf(build),
};
