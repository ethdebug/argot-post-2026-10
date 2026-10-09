// Phase 2's "Vyper vs Solidity" (spec §6c), with Phase 1 parts only:
// the same storage read by solc's rule and by Vyper's own layout (a
// hand-written pointer, badged so), linked by path
import type { LensSpec } from "../ui/types";

const SOL = { decoding: "$scene", moment: "current" } as const;
const VY = { decoding: "$rule", moment: "current" } as const;
const players = { roots: ["players"], rows: "values" as const };

export const vyper: LensSpec = {
  id: "vyper", title: "Vyper vs Solidity",
  timelines: [], decodings: [], initial: { scene: "vyper-rules" },
  grid: '"t1 d1" "t2 d2"',
  links: ["v"],
  views: [
    { id: "t1", kind: "tree", area: "t1", link: "v", filter: players,
      align: ["d1"],
      data: SOL },
    { id: "d1", kind: "dump", area: "d1", link: "v", location: "storage",
      filter: players, title: "Solidity's rule",
      data: SOL },
    { id: "t2", kind: "tree", area: "t2", link: "v", filter: players,
      align: ["d2"],
      data: VY },
    { id: "d2", kind: "dump", area: "d2", link: "v", location: "storage",
      filter: players, title: "Vyper's layout",
      data: VY },
  ],
  areas: { t1: "treebox", t2: "treebox", d1: "dump", d2: "dump" },
};
