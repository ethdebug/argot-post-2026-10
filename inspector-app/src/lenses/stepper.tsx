// The bugc stepper (addendum §8, T8.1): a scene's moments inside one
// transaction, stepped on its timeline; at each, the code panel and
// everything in scope (the storage variables and the locals, one
// tree), how a selection was found, and a dump of storage (the storage
// inspector's own), calldata and memory, linked. A local whose pointer
// reads calldata (join's `name`) lights the call's bytes. The
// debugger's layout (debugger.css), the timeline where its moves are.
import { Children, type ReactNode } from "react";
import type { Filter, Location } from "../engine/types";
import { panel } from "../ui/Panel";
import type { LensSpec, ViewSpec } from "../ui/types";

const Storage = panel("spanel", "st");
function Wide({ children }: { children: ReactNode }) {
  const [rows, storage, ...rest] = Children.toArray(children);
  return <>{rows}<Storage>{storage}</Storage>{rest}</>;
}

const NOW = { decoding: "$scene", moment: "current" } as const;
const all: Filter = { rows: "all" };
const dump = (location: Location, title: string): ViewSpec => ({
  id: location, kind: "dump", area: "wide", location, link: "st",
  data: NOW, filter: all, title, display: { ruler: false } } as ViewSpec);

export const stepper: LensSpec = {
  id: "stepper", title: "Stepping through bugc's code", timelines: [],
  decodings: [], grid: "", layout: "dbg stepper", links: ["st"],
  columns: 2,
  areas: { wide: "dump dbg-col", side: "dbg-col" },
  wrap: { wide: Wide },
  views: [
    { id: "time", kind: "timeline", area: "moves", domId: "stime" },
    { id: "code", kind: "code", area: "side", data: NOW, domId: "scode" },
    { id: "walk", kind: "walkthrough", area: "side", link: "st",
      domId: "sdetails", data: NOW },
    { id: "vars", kind: "variables", area: "side", data: NOW, link: "st",
      domId: "svars" },
    { id: "rows", kind: "picker", of: "related", area: "wide", link: "st",
      domId: "srelated" },
    { id: "storage", kind: "dump", area: "wide", location: "storage",
      link: "st", data: NOW },
    dump("calldata", "Calldata"),
    dump("memory", "Memory"),
  ],
};
