// The arcade scenario with its builds, from files, and its runs (each
// build run once per test file)
import fs from "node:fs";
import path from "node:path";
import * as evm from "@ethdebug/evm";
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
