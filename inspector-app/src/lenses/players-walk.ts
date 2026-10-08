// Phase 2's "players walkthrough" (spec §6a), with Phase 1 parts only:
// a walkthrough started at step 0, its dump; no tree (the rows it would
// light are just unlit)
import type { LensSpec } from "../ui/types";

const data = { decoding: "sol:arcade-mid", point: "arcade-mid:after" };

export const playersWalk: LensSpec = {
  id: "players-walk", title: "How players is found (a walkthrough)",
  timelines: ["arcade-mid"], decodings: ["sol:arcade-mid"],
  grid: '"bar" "dump"',
  links: ["s"],
  initial: { links: { s: { selection: "players", hover: null,
    walk: { step: 0 } } } },
  views: [
    { id: "walk", kind: "walkthrough", area: "bar", link: "s", data },
    { id: "dump", kind: "dump", area: "dump", location: "storage",
      link: "s", data },
  ],
  areas: { dump: "dump" },
};
