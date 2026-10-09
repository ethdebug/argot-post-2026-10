// The real debugger: soldb's own view of a transaction, a figure of its
// own (figures/RealDebugger.tsx), not the project's scenes and runs
import type { LensSpec } from "../ui/types";
import { RealDebugger } from "../figures/RealDebugger";

export const realDebugger: LensSpec = {
  id: "real-debugger", title: "A real debugger: soldb, in the browser",
  timelines: [], decodings: [], grid: "", links: [], views: [],
  columns: 2, page: RealDebugger,
};
