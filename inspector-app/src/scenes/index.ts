// The scene registry: every scene, in post order;
// and what the embed knows of each scenario's builds
import { sceneOf, type BuildInfo, type Scene } from "../engine/scene";
import arcade from "../../scenarios/arcade/builds.json";
import reveal from "../../scenes/reveal.json";
import carolRecord from "../../scenes/pitfall-nesting.json";
import pointerWalkthrough from "../../scenes/pointer-walkthrough.json";
import vyperRules from "../../scenes/pitfall-compiler.json";
import stepperO2 from "../../scenes/optimized-locals.json";
import realDebugger from "../../scenes/real-debugger.json";
import programXray from "../../scenes/program-xray.json";

// (in Vite, every scene file, after these; Node, the snapshot build:
// these)
const listed = [reveal, carolRecord, pointerWalkthrough, vyperRules,
  stepperO2].map(sceneOf);
const globbed = typeof import.meta.glob === "function"
  ? Object.values(import.meta.glob<unknown>("../../scenes/*.json",
    { eager: true, import: "default" })) : [];
// (a figure's file: a scene whose lens brings its own data, no run)
const isFigure = (j: unknown) => !(j as { run?: unknown }).run;
const files = globbed.filter((j) => !isFigure(j)).map(sceneOf);
export const scenes: Scene[] = [...listed.map((s) =>
  files.find((f) => f.id === s.id) ?? s),
...files.filter((f) => !listed.some((s) => s.id === f.id))];

export const builds: Record<string, Record<string, BuildInfo>> = { arcade };

// The figures: scenes whose lens brings its own data (real-debugger:
// soldb's), each its id, title, caption and lens; no run, no moments
export interface Figure { id: string; title: string; caption?: string;
  lens: string }
const named = [realDebugger, programXray] as Figure[];
export const figures: Figure[] = [...named,
  ...(globbed.filter(isFigure) as Figure[]).filter((f) =>
    !named.some((n) => n.id === f.id))];
