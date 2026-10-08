// The Phase 1 page as a lens: the storage scenes (bookmarks), the
// dumps (before, after) and the tree, linked; Before | After
import { panel } from "../ui/Panel";
import type { LensSpec } from "../ui/types";

const ABI = { decoding: "$abi", point: { slot: "b" } };
// (the Vyper scene's dump shows Vyper's own words: no value owns them)
const VYPER = [{ decoding: "vyRule", who: "Vyper's" }];

export const fullInspector: LensSpec = {
  id: "inspector", title: "Storage, by name",
  timelines: ["arcade-mid", "arcade-alice", "arcade-motd", "arcade-vyper"],
  decodings: ["sol:arcade-mid", "sol:arcade-alice", "sol:arcade-motd",
    "vyAsSol", "vyRule"],
  bookmarks: ["mid", "alice", "motd", "vyper"],
  grid: '"contract contract" "pick pick" "mode mode" "bar bar" ' +
    '"dump tree" "cdump ctree" "cdetails chow"',
  links: ["storage", "calldata"],
  scopes: { cdump: "calldata", ctree: "calldata", cdetails: "calldata",
    chow: "calldata" },
  views: [
    { id: "contract", kind: "contract", area: "contract", link: "storage",
      domId: "contract-box", data: { decoding: "$bm", point: { slot: "b" } } },
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
    // the call's calldata (a bookmark that names its function): the same
    // dump and tree, of location calldata, its own link group
    { id: "cdump", kind: "dump", area: "cdump", location: "calldata",
      link: "calldata", data: ABI, title: "Calldata" },
    { id: "ctree", kind: "tree", area: "ctree", link: "calldata",
      domId: "ctree", data: ABI, plain: true, align: [], partAttr: true },
    { id: "cdetails", kind: "abi", part: "details", area: "cdetails",
      link: "calldata", domId: "cdetails", data: ABI },
    { id: "chow", kind: "abi", part: "how", area: "chow", link: "calldata",
      domId: "chow", data: ABI },
    { id: "tree", kind: "tree", area: "tree", link: "storage",
      domId: "tree", data: { decoding: "$bm", point: { slot: "$side" } } },
  ],
  hash: { prefix: "", legacy: true },
  wrap: { dump: panel("panel", "storage"),
    cdump: panel("cpanel", "calldata") },
  // (the grid cells: vanilla's dump box and tree box)
  areas: { dump: "dump", tree: "treebox" },
};
