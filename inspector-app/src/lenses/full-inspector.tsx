// The storage inspector as a lens (scenes pitfall-nesting and
// pointer-walkthrough): the dump at the moment (its bytes the moment
// before it changed, marked) and the tree, linked
import { panel } from "../ui/Panel";
import type { LensSpec } from "../ui/types";

const NOW = { decoding: "$scene", moment: "current" } as const;
const BEFORE = { decoding: "$scene", moment: "previous" } as const;

export const fullInspector: LensSpec = {
  id: "inspector", title: "Storage, by name",
  timelines: [], decodings: [], bookmarks: [],
  grid: '"contract contract" "pick pick" "time time" "bar bar" ' +
    '"rows rows" "dump tree"',
  links: ["storage"],
  views: [
    { id: "contract", kind: "contract", area: "contract", link: "storage",
      domId: "contract-box", data: NOW },
    // the scene's moments on the run (TimelineBar.tsx)
    { id: "time", kind: "timeline", area: "time", domId: "timeline" },
    { id: "walk", kind: "walkthrough", area: "bar", link: "storage",
      domId: "details", data: NOW, compare: BEFORE },
    // (the moment's own storage; the one before it is a step back on the
    // timeline: its changed bytes marked, compared with it)
    { id: "after", kind: "dump", area: "dump", location: "storage",
      link: "storage", data: NOW, compare: BEFORE },
    { id: "tree", kind: "tree", area: "tree", link: "storage",
      domId: "tree", data: NOW, compare: BEFORE },
  ],
  // (its grid's class: the embed lays its columns out by it, embed.css)
  layout: "inspector",
  wrap: { dump: panel("panel", "storage") },
  // (the grid cells: vanilla's dump box and tree box)
  areas: { dump: "dump", tree: "treebox" },
};
