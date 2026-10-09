// The page's storage inspector as a lens: its scenes, the timeline of
// their moments, the dump at the moment (its bytes the moment before it
// changed, marked) and the tree, linked
import { panel } from "../ui/Panel";
import type { LensSpec } from "../ui/types";

const NOW = { decoding: "$scene", moment: "current" } as const;
const BEFORE = { decoding: "$scene", moment: "previous" } as const;
// (the Vyper scene's dump shows Vyper's own words: no value owns them)
const VYPER = [{ decoding: "vyper/rule", who: "Vyper's" }];

export const fullInspector: LensSpec = {
  id: "inspector", title: "Storage, by name",
  timelines: ["scene:mid", "scene:alice", "scene:motd", "scene:vyper"],
  decodings: ["mid", "alice", "motd",
    "vyper", "vyper/rule"],
  bookmarks: ["mid", "alice", "motd", "vyper"],
  grid: '"contract contract" "pick pick" "time time" "bar bar" ' +
    '"rows rows" "dump tree"',
  links: ["storage"],
  views: [
    { id: "contract", kind: "contract", area: "contract", link: "storage",
      domId: "contract-box", data: NOW },
    { id: "pick", kind: "picker", of: "bookmarks", area: "pick",
      domId: "picker" },
    // the scene's moments on the run (TimelineBar.tsx)
    { id: "time", kind: "timeline", area: "time", domId: "timeline" },
    // All | Related: the rows shown (the related view: the selection's)
    { id: "rows", kind: "picker", of: "related", area: "rows",
      link: "storage", domId: "related" },
    { id: "walk", kind: "walkthrough", area: "bar", link: "storage",
      domId: "details", data: NOW, compare: BEFORE, others: VYPER },
    // (the moment's own storage; the one before it is a step back on the
    // timeline: its changed bytes marked, compared with it)
    { id: "after", kind: "dump", area: "dump", location: "storage",
      link: "storage", data: NOW, compare: BEFORE, others: VYPER },
    { id: "tree", kind: "tree", area: "tree", link: "storage",
      domId: "tree", data: NOW, compare: BEFORE },
  ],
  hash: { prefix: "", legacy: true },
  // (its grid's class: the embed lays its columns out by it, embed.css)
  layout: "inspector",
  wrap: { dump: panel("panel", "storage") },
  // (the grid cells: vanilla's dump box and tree box)
  areas: { dump: "dump", tree: "treebox" },
};
