// The scene registry: every scene, in post order (the shell's list);
// and what the page knows of each scenario's builds
import { sceneOf, type BuildInfo, type Scene } from "../engine/scene";
import arcade from "../../scenarios/arcade/builds.json";
import rawHero from "../../scenes/raw-hero.json";
import reveal from "../../scenes/reveal.json";
import rawNamed from "../../scenes/raw-named.json";
import carolRecord from "../../scenes/pitfall-nesting.json";
import mid from "../../scenes/mid.json";
import alice from "../../scenes/alice.json";
import motd from "../../scenes/motd.json";
import vyper from "../../scenes/vyper.json";
import pointerWalkthrough from "../../scenes/pointer-walkthrough.json";
import alicePlays from "../../scenes/alice-plays.json";
import vyperRules from "../../scenes/pitfall-compiler.json";
import stepperO0 from "../../scenes/stepper-O0.json";
import stepperO2 from "../../scenes/optimized-locals.json";
import realDebugger from "../../scenes/real-debugger.json";

// (in Vite, every scene file, the ones authoring adds too, after these;
// Node, the snapshot build: these)
const listed = [rawHero, reveal, rawNamed, carolRecord, mid, alice,
  motd, vyper, pointerWalkthrough, alicePlays, vyperRules, stepperO0, stepperO2]
  .map(sceneOf);
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

// The reader page's scenes, in its order: the storage inspector's, and
// "Raw bytes", the raw lens's (its picker's buttons, index.html)
export const page: { id: string; title: string; lens: string }[] = [
  { id: "raw", title: "Raw bytes", lens: "raw" },
  ...["mid", "alice", "motd", "vyper"].map((id) => ({ id,
    title: listed.find((s) => s.id === id)!.title, lens: "inspector" }))];

// The figures: scenes whose lens brings its own data (real-debugger:
// soldb's), each its id, title, caption and lens; no run, no moments
export interface Figure { id: string; title: string; caption?: string;
  lens: string }
export const figures: Figure[] = [realDebugger as Figure,
  ...(globbed.filter(isFigure) as Figure[]).filter((f) =>
    f.id !== realDebugger.id)];
