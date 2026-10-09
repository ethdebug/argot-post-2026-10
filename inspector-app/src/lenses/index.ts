// The lens registry: the only list of lenses (the shell's picker)
import type { LensSpec } from "../ui/types";
import { fullInspector } from "./full-inspector";
import { alicePlays } from "./alice-plays";
import { vyper } from "./vyper";
import { pointerWalkthrough } from "./pointer-walkthrough";
import { stepper } from "./stepper";
import { realDebugger } from "./real-debugger";
import { reveal, rawLenses } from "./raw";

// (Phase 1's page first; then lenses made of Phase 1 parts only, which
// show the architecture fits Phase 2: spec §6b, §6c)
// (what the maintainer reviews first; the shell's "dev" adds the rest)
const dev = (l: LensSpec): LensSpec => ({ ...l, dev: true });
export const lenses: LensSpec[] = [fullInspector, stepper, realDebugger,
  ...rawLenses, reveal, dev(pointerWalkthrough), dev(alicePlays), dev(vyper)];
