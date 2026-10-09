// The scene registry: every scene, in post order (the shell's list);
// and what the page knows of each scenario's builds
import { sceneOf, type BuildInfo, type Scene } from "../engine/scene";
import arcade from "../../scenarios/arcade/builds.json";
import rawHero from "../../scenes/raw-hero.json";
import rawAnnotated from "../../scenes/raw-annotated.json";
import rawNamed from "../../scenes/raw-named.json";
import mid from "../../scenes/mid.json";
import alice from "../../scenes/alice.json";
import motd from "../../scenes/motd.json";
import vyper from "../../scenes/vyper.json";
import playersWalk from "../../scenes/players-walk.json";
import alicePlays from "../../scenes/alice-plays.json";
import vyperRules from "../../scenes/vyper-rules.json";
import bugO0 from "../../scenes/bug-O0.json";
import bugO2 from "../../scenes/bug-O2.json";

// (in Vite, every scene file, the ones authoring adds too, after these;
// Node, the snapshot build: these)
const listed = [rawHero, rawAnnotated, rawNamed, mid, alice, motd, vyper, playersWalk,
  alicePlays, vyperRules, bugO0, bugO2].map(sceneOf);
const files = typeof import.meta.glob === "function"
  ? Object.values(import.meta.glob<unknown>("../../scenes/*.json",
    { eager: true, import: "default" })).map(sceneOf) : [];
export const scenes: Scene[] = [...listed.map((s) =>
  files.find((f) => f.id === s.id) ?? s),
...files.filter((f) => !listed.some((s) => s.id === f.id))];

export const builds: Record<string, Record<string, BuildInfo>> = { arcade };
