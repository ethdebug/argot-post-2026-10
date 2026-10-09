// The page's storage inspector as a lens: its scenes, the timeline of
// their moments, the dump at the moment (its bytes the moment before it
// changed, marked) and the tree, linked
import { panel } from "../ui/Panel";
import type { LensSpec } from "../ui/types";

const NOW = { decoding: "$scene", moment: "current" } as const;
const BEFORE = { decoding: "$scene", moment: "previous" } as const;
const ABI = { decoding: "$abi", moment: "current" } as const;
// The calldata section (setMotd's, by the ABI): ON HOLD until the bugc
// stepper; drawn only when the hash asks (calldata=1: its checks)
export const calldataShown = () => typeof location !== "undefined" &&
  new URLSearchParams(location.hash.slice(1)).get("calldata") === "1";
const CALLDATA = calldataShown();
// (the Vyper scene's dump shows Vyper's own words: no value owns them)
const VYPER = [{ decoding: "vyper/rule", who: "Vyper's" }];

export const fullInspector: LensSpec = {
  id: "inspector", title: "Storage, by name",
  timelines: ["scene:mid", "scene:alice", "scene:motd", "scene:vyper"],
  decodings: ["mid", "alice", "motd",
    "vyper", "vyper/rule"],
  bookmarks: ["mid", "alice", "motd", "vyper"],
  grid: '"contract contract" "pick pick" "time time" "bar bar" ' +
    '"rows rows" "dump tree" "cdump ctree" "cdetails chow"',
  links: ["storage", "calldata"],
  scopes: { cdump: "calldata", ctree: "calldata", cdetails: "calldata",
    chow: "calldata" },
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
    // the call's calldata (a bookmark that names its function): the same
    // dump and tree, of location calldata, its own link group (on hold)
    ...!CALLDATA ? [] : [
    { id: "cdump", kind: "dump", area: "cdump", location: "calldata",
      link: "calldata", data: ABI, title: "Calldata" },
    { id: "ctree", kind: "tree", area: "ctree", link: "calldata",
      domId: "ctree", data: ABI, plain: true, alone: true, align: [],
      partAttr: true },
    { id: "cdetails", kind: "abi", part: "details", area: "cdetails",
      link: "calldata", domId: "cdetails", data: ABI },
    { id: "chow", kind: "abi", part: "how", area: "chow", link: "calldata",
      domId: "chow", data: ABI }] as LensSpec["views"],
    { id: "tree", kind: "tree", area: "tree", link: "storage",
      domId: "tree", data: NOW, compare: BEFORE },
  ],
  hash: { prefix: "", legacy: true },
  wrap: { dump: panel("panel", "storage"),
    cdump: panel("cpanel", "calldata", "calldata") },
  // (the grid cells: vanilla's dump box and tree box)
  areas: { dump: "dump", tree: "treebox" },
};
