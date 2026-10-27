// The lens registry: the only list of lenses
import type { LensSpec } from "../ui/types";
import { fullInspector } from "./full-inspector";
import { alicePlays } from "./alice-plays";
import { vyper } from "./vyper";
import { stepper } from "./stepper";
import { realDebugger } from "./real-debugger";
import { programXray } from "./program-xray";
import { reveal, rawLenses } from "./raw";

// (Phase 1's page first; then lenses made of Phase 1 parts only, which
// show the architecture fits Phase 2: spec §6b, §6c)
export const lenses: LensSpec[] = [fullInspector, stepper, realDebugger,
  programXray,
  ...rawLenses, reveal, alicePlays, vyper];
