// Phase 2's "alice plays" (spec §6b), with Phase 1 parts only: two
// stacked dumps at two timeline points (her hit's before and after),
// compared, and the tree after, all cut to alice, totalScore and totalHits
import type { Filter } from "../engine/types";
import type { LensSpec } from "../ui/types";

const ALICE = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
const roots: Filter = { roots: [ALICE, "totalScore", "totalHits"],
  rows: "touched" };
const at = (point: string) => ({ decoding: "sol:arcade-alice", point });
const BEFORE = at("arcade-alice:before");
const AFTER = at("arcade-alice:after");

export const alicePlays: LensSpec = {
  id: "alice-plays", title: "Alice plays (two timeline points)",
  timelines: ["arcade-alice"], decodings: ["sol:arcade-alice"],
  grid: '"before tree" "after tree"',
  links: ["s"],
  views: [
    { id: "before", kind: "dump", area: "before", location: "storage",
      link: "s", data: BEFORE, compare: AFTER, filter: roots,
      title: "Before" },
    { id: "after", kind: "dump", area: "after", location: "storage",
      link: "s", data: AFTER, compare: BEFORE, filter: roots,
      title: "After" },
    { id: "tree", kind: "tree", area: "tree", link: "s", data: AFTER,
      compare: BEFORE, filter: roots },
  ],
  areas: { before: "dump", after: "dump", tree: "treebox" },
};
