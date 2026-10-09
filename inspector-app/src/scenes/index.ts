// The scene registry: every scene, in post order (the shell's list)
import { sceneOf, type Scene } from "../engine/scene";
import rawHero from "../../scenes/raw-hero.json";
import mid from "../../scenes/mid.json";
import alice from "../../scenes/alice.json";
import motd from "../../scenes/motd.json";
import vyper from "../../scenes/vyper.json";
import playersWalk from "../../scenes/players-walk.json";
import bugO0 from "../../scenes/bug-O0.json";
import bugO2 from "../../scenes/bug-O2.json";

export const scenes: Scene[] = [rawHero, mid, alice, motd, vyper,
  playersWalk, bugO0, bugO2].map(sceneOf);
