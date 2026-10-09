// The debugger lens (addendum §3.1): a scene's run, every trace step a
// moment ("run:<scene>"); the code panel and everything in scope at the
// moment (the storage variables and the locals, one tree), a dump of
// every location, linked (storage's the storage inspector's own, its
// panel, its Rows toggle); the moves. Laid out by the raw lens's rules:
// the dumps in the inspector's dump column, the stack narrow beside
// them, the code and the variables in the tree's column; one column on
// a phone (debugger.css).
import { Children, type ReactNode } from "react";
import type { Filter, Location } from "../engine/types";
import { panel } from "../ui/Panel";
import type { LensSpec, ViewSpec } from "../ui/types";

// (storage: the storage inspector's own dump, in its own panel, the Rows
// toggle over it; the other locations under it)
const Storage = panel("dpanel", "dbg");
function Wide({ children }: { children: ReactNode }) {
  const [rows, storage, ...rest] = Children.toArray(children);
  return <>{rows}<Storage>{storage}</Storage>{rest}</>;
}

const NOW = { decoding: "$scene", moment: "current" } as const;
const all: Filter = { rows: "all" };
const dump = (location: Location, title: string, area: string,
  more: Partial<ViewSpec> = {}): ViewSpec => ({ id: location, kind: "dump",
  area, location, link: "dbg", data: NOW, filter: all, title,
  display: { ruler: false }, ...more } as ViewSpec);

export const debuggerLens: LensSpec = {
  id: "debugger", title: "Debugger", timelines: [], decodings: [],
  grid: "", layout: "dbg", links: ["dbg"], columns: 2,
  areas: { wide: "dump dbg-col", narrow: "dbg-col", side: "dbg-col" },
  wrap: { wide: Wide },
  views: [
    { id: "moves", kind: "moves", area: "moves", domId: "dmoves" },
    { id: "code", kind: "code", area: "side", data: NOW, domId: "dcode" },
    // (how the selection was found: the sections' walkthrough, over its
    // own pointer at the moment; over the variables, near the code)
    { id: "walk", kind: "walkthrough", area: "side", link: "dbg",
      domId: "ddetails", data: NOW },
    { id: "vars", kind: "variables", area: "side", data: NOW, link: "dbg",
      domId: "dvars" },
    // All | Related, and the storage dump: the inspector's, exactly
    { id: "rows", kind: "picker", of: "related", area: "wide", link: "dbg",
      domId: "drelated" },
    { id: "storage", kind: "dump", area: "wide", location: "storage",
      link: "dbg", data: NOW },
    dump("stack", "Stack", "narrow", { display: { ruler: false,
      abbreviate: 2 } }),
    dump("calldata", "Calldata", "wide"),
    dump("memory", "Memory", "wide"),
  ],
};
