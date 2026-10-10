// The program x-ray: a compiler's ethdebug program, an instruction at a
// time, from solc and from Fe; a figure of its own
// (figures/ProgramXray.tsx), not the project's scenes and runs
import type { LensSpec } from "../ui/types";
import { ProgramXray } from "../figures/ProgramXray";

export const programXray: LensSpec = {
  id: "program-xray", title: "The program: each instruction, and what " +
    "it means",
  timelines: [], decodings: [], grid: "", links: [], views: [],
  columns: 2, page: ProgramXray,
};
