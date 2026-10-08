// The lens registry: the only list of lenses (the shell's picker)
import type { LensSpec } from "../ui/types";
import { fullInspector } from "./full-inspector";
import { alicePlays } from "./alice-plays";
import { vyper } from "./vyper";
import { playersWalk } from "./players-walk";
import { insideOnePlay } from "./inside-one-play";

// (Phase 1's page first; then lenses made of Phase 1 parts only, which
// show the architecture fits Phase 2: spec §6b, §6c)
export const lenses: LensSpec[] = [fullInspector, insideOnePlay,
  playersWalk, alicePlays, vyper];
