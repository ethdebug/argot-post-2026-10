// The debugger lens (addendum §3.1): a scene's run, every trace step a
// moment ("run:<scene>"); the code panel and everything in scope at the
// moment (the storage variables and the locals, one tree), a dump of
// every location, linked; the moves. Laid out by the raw lens's rules:
// the dumps in the inspector's dump column, the stack narrow beside
// them, the code and the variables in the tree's column; one column on
// a phone (debugger.css).
import type { Filter, Location } from "../engine/types";
import type { LensSpec, ViewSpec } from "../ui/types";

const NOW = { decoding: "$scene", moment: "current" } as const;
const all: Filter = { rows: "all" };
const dump = (location: Location, title: string, area: string,
  more: Partial<ViewSpec> = {}): ViewSpec => ({ id: location, kind: "dump",
  area, location, link: "dbg", data: NOW, filter: all, title,
  display: { ruler: false }, ...more } as ViewSpec);

export const debuggerLens: LensSpec = {
  id: "debugger", title: "Debugger", timelines: [], decodings: [],
  grid: "", layout: "dbg", links: ["dbg"],
  areas: { wide: "dump dbg-col", narrow: "dbg-col", side: "dbg-col" },
  views: [
    { id: "moves", kind: "moves", area: "moves", domId: "dmoves" },
    { id: "code", kind: "code", area: "side", data: NOW, domId: "dcode" },
    { id: "vars", kind: "variables", area: "side", data: NOW, link: "dbg",
      domId: "dvars" },
    dump("storage", "Storage", "wide"),
    dump("stack", "Stack", "narrow", { display: { ruler: false,
      abbreviate: 2 } }),
    dump("calldata", "Calldata", "wide"),
    dump("memory", "Memory", "wide"),
  ],
};
