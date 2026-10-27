// The lens registry: the only list of lenses
import type { LensSpec } from "../ui/types";
import { fullInspector } from "./full-inspector";
import { vyper } from "./vyper";
import { stepper } from "./stepper";
import { realDebugger } from "./real-debugger";
import { programXray } from "./program-xray";
import { reveal } from "./raw";

export const lenses: LensSpec[] = [fullInspector, stepper, realDebugger,
  programXray, reveal, vyper];
