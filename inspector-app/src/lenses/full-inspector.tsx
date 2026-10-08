// The Phase 1 page as a lens: the storage scenes (bookmarks), the
// dumps (before, after) and the tree, linked; Before | After
import { panel } from "../ui/Panel";
import type { LensSpec } from "../ui/types";

// (the Vyper scene's dump shows Vyper's own words: no value owns them)
const VYPER = [{ decoding: "vyRule", who: "Vyper's" }];

export const fullInspector: LensSpec = {
  id: "inspector", title: "Storage, by name",
  timelines: ["arcade-mid", "arcade-alice", "arcade-motd", "arcade-vyper"],
  decodings: ["sol:arcade-mid", "sol:arcade-alice", "sol:arcade-motd",
    "vyAsSol", "vyRule"],
  bookmarks: ["mid", "alice", "motd", "vyper"],
  grid: '"pick pick" "mode mode" "bar bar" "dump tree" "cd tree"',
  links: ["storage"],
  views: [
    { id: "pick", kind: "picker", of: "bookmarks", area: "pick",
      domId: "picker" },
    { id: "mode", kind: "picker", of: "side", area: "mode", domId: "mode" },
    { id: "walk", kind: "walkthrough", area: "bar", link: "storage",
      domId: "details", data: { decoding: "$bm", point: { slot: "$side" } },
      others: VYPER },
    { id: "before", kind: "dump", area: "dump", location: "storage",
      link: "storage", data: { decoding: "$bm", point: { slot: "a" } },
      side: "before", others: VYPER },
    { id: "after", kind: "dump", area: "dump", location: "storage",
      link: "storage", data: { decoding: "$bm", point: { slot: "b" } },
      side: "after", others: VYPER },
    { id: "cd", kind: "calldata", area: "cd",
      data: { decoding: "$bm", point: { slot: "b" } } },
    { id: "tree", kind: "tree", area: "tree", link: "storage",
      domId: "tree", data: { decoding: "$bm", point: { slot: "$side" } } },
  ],
  hash: { prefix: "", legacy: true },
  wrap: { dump: panel("panel", "storage") },
  // (the grid cells: vanilla's dump box and tree box)
  areas: { dump: "dump", tree: "treebox" },
};
