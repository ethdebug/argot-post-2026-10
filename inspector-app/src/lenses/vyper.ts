// The compilers' pitfall (the post's figure; scene pitfall-compiler):
// ONE storage, the Vyper contract's, read two ways: by solc's rule and
// by Vyper's own layout (a hand-written pointer, badged so). The two
// readings side by side, each in a colour of its own, over the one dump:
// Vyper's reading lit where it lands, Solidity's outlined where it
// lands (an empty slot); linked by path
import type { LensSpec } from "../ui/types";

const SOL = { decoding: "$scene", moment: "current" } as const;
const VY = { decoding: "$rule", moment: "current" } as const;
const players = { roots: ["players"], rows: "values" as const };
// (each reading's colour: neither the selection's yellow, nor the hash
// arguments' badges' (pk3, the key; pk6, the slot))
const SOLC = 1, VYC = 2;

export const vyper: LensSpec = {
  id: "vyper", title: "Vyper vs Solidity",
  timelines: [], decodings: [], initial: { scene: "pitfall-compiler" },
  grid: '"t1 t2" "d d"', columns: 2, layout: "vyper",
  links: ["v"],
  views: [
    { id: "t1", kind: "tree", area: "t1", link: "v", filter: players,
      align: [], title: "Solidity's rule", tint: SOLC, names: VY,
      data: SOL },
    { id: "t2", kind: "tree", area: "t2", link: "v", filter: players,
      align: [], title: "Vyper's layout", tint: VYC,
      data: VY },
    { id: "d", kind: "dump", area: "d", link: "v", location: "storage",
      filter: players, title: "Storage",
      display: { ruler: false, facts: true, tint: VYC, ends: false,
        second: { data: SOL, tint: SOLC } },
      data: VY },
  ],
  areas: { t1: "treebox", t2: "treebox", d: "dump" },
};
