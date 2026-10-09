// The scenes' snapshot files (addendum §1.6, §2.4; Vite plugin): each
// scene's run, made here in Node by the engine's own code, cut to the
// scene's moments. Built: dist/snapshots/<scene>.json, and the build
// fails if a run's digest is not scenarios/<s>/digests.json's (the runs
// drifted: a changed build, scenario or EVM). Dev: the same files at
// <base>snapshots/<scene>.json, made on first ask.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";
import * as evm from "../src/engine/run/evm";
import { runScenario } from "../src/engine/run/run";
import { scenarioOf } from "../src/engine/run/scenario";
import type { BuildId, Run, Scenario } from "../src/engine/run/types";
import { load, type Runs } from "../src/engine/project";
import type { Io } from "../src/engine/io";
import { sceneSnapshot } from "../src/engine/snapshots";
import { snapshotJson } from "../src/engine/source";
import { sceneJson, sceneOf, type Scene } from "../src/engine/scene";
import { builds, page, scenes as all } from "../src/scenes";

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (...p: string[]) =>
  JSON.parse(fs.readFileSync(path.join(...p), "utf8"));

// A scenario with every build, from its files
export function scenarioFile(id: string): Scenario {
  const dir = path.join(app, "scenarios", id);
  return scenarioOf({ ...read(dir, "scenario.json"),
    builds: Object.fromEntries(Object.keys(builds[id]).map((b) =>
      [b, read(dir, "builds", b, "build.json")])) });
}

// The runs, made once each (one Map per call: a dev server's, a build's)
export function nodeRuns(): Runs {
  const scenarios = new Map<string, Scenario>();
  const ran = new Map<string, Promise<Run>>();
  return {
    scenario: async (id) => {
      if (!scenarios.has(id)) scenarios.set(id, scenarioFile(id));
      return scenarios.get(id)!;
    },
    run: (s: Scenario, b: BuildId) => {
      const k = `${s.id}|${b}`;
      if (!ran.has(k)) ran.set(k, runScenario(s, b, evm));
      return ran.get(k)!;
    },
  };
}

// (the demo's files)
const demoIo = (): Io => {
  const at = (p: string) => path.join(app, "..", "demos", "inspector", p);
  return {
    json: async (p) => read(at(p)),
    text: async (p) => fs.readFileSync(at(p), "utf8"),
    bytes: async (p) => new Uint8Array(fs.readFileSync(at(p))),
  };
};

// Each scene's snapshot file, as JSON text; `digests`: each scenario's
// runs' digests by build (a run whose digest differs throws)
export function snapshotter(o: { scenes?: Scene[];
  digests?: (scenario: string) => Record<string, string> } = {}) {
  const scenes = o.scenes ?? all;
  const digests = o.digests ??
    ((id: string) => read(app, "scenarios", id, "digests.json"));
  const project = load(demoIo(), { scenes, builds, page, runs: nodeRuns() });
  const files = new Map<string, Promise<string>>();
  return (id: string): Promise<string> => {
    if (!files.has(id)) {
      files.set(id, (async () => {
        const scene = scenes.find((s) => s.id === id);
        if (!scene) throw new Error(`no scene ${id}`);
        const file = await sceneSnapshot(await project, scene);
        const want = digests(scene.run.scenario)[scene.run.build];
        if (file.digest !== want) {
          throw new Error(`scene ${id}: the ${scene.run.build} run's ` +
            `digest is ${file.digest}, not digests.json's ${want}: the ` +
            "run changed (a build, the scenario, the EVM)");
        }
        return JSON.stringify(snapshotJson(file));
      })());
    }
    return files.get(id)!;
  };
}

// Authoring's write (addendum §3.1, dev server only): a scene's file,
// scenes/<id>.json, from its JSON; an id is lower-case letters, digits
// and dashes (no path); the JSON must be a scene of that id
export function writeScene(dir: string, id: string, json: unknown):
  string {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`no scene id ${id}`);
  const s = sceneOf(json);
  if (s.id !== id) throw new Error(`the scene's id is ${s.id}, not ${id}`);
  const file = path.join(dir, `${id}.json`);
  fs.writeFileSync(file, sceneJson(s));
  return file;
}

export function scenesPlugin(): Plugin {
  let file: ReturnType<typeof snapshotter> | undefined;
  return {
    name: "scenes",
    configureServer(server) {
      const re = new RegExp(`^${server.config.base}snapshots/([^/]+)\\.json$`);
      // (authoring: POST /__scene/<id>, a scene's file written)
      server.middlewares.use((req, res, next) => {
        const m = req.method === "POST" &&
          req.url?.split("?")[0].match(/^\/__scene\/([^?]*)$/);
        if (!m) return next();
        let body = "";
        req.on("data", (c) => void (body += c));
        req.on("end", () => {
          try {
            writeScene(path.join(app, "scenes"), decodeURIComponent(m[1]),
              JSON.parse(body));
            res.end("ok");
          } catch (e) {
            res.statusCode = 400;
            res.end(String((e as Error)?.message ?? e));
          }
        });
      });
      server.middlewares.use(async (req, res, next) => {
        const m = req.url?.split("?")[0].match(re);
        if (!m) return next();
        try {
          const text = await (file ??= snapshotter())(m[1]);
          res.setHeader("content-type", "application/json");
          res.end(text);
        } catch (e) {
          res.statusCode = all.some((s) => s.id === m[1]) ? 500 : 404;
          res.end(String((e as Error)?.message ?? e));
        }
      });
    },
    async generateBundle() {
      const make = snapshotter();
      for (const s of all) {
        this.emitFile({ type: "asset", fileName: `snapshots/${s.id}.json`,
          source: await make(s.id) });
      }
    },
  };
}
