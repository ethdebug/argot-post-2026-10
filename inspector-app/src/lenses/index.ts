// The lens registry: the only list of lenses (the shell's picker)
import type { LensSpec } from "../ui/types";
import { fullInspector } from "./full-inspector";

export const lenses: LensSpec[] = [fullInspector];
