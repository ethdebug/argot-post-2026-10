// The raw lens: the bytes with no names (the post's opening figure,
// "tools have always worked backwards"). One frozen moment
// (fixtures/raw.json: inside carol's join, while her name is written
// to storage): storage, the stack, memory and calldata, with every
// high-level layer off: no names, no tints, no popovers, no tree, no
// hover meaning; the gutters only. Three compositions of the same four
// dumps, to pick from; each lays out by its class (raw.css, which the
// shell loads), at the blog figure's width and at a phone's.
import type { Filter, Location } from "../engine/types";
import type { Display, LensSpec, ViewSpec } from "../ui/types";

const data = { decoding: "raw", point: "raw" };
const all: Filter = { rows: "all" };
const dump = (location: Location, title: string, display: Display):
  ViewSpec => ({ id: location, kind: "dump", area: location, location,
  data, filter: all, title, display: { bare: true, ...display } });

// storage the hero; the stack a strip of short words, the top first;
// memory and calldata dense, one run of bytes each
const views = (o: { memory?: Display; calldata?: Display } = {}) => [
  dump("storage", "Storage", {}),
  dump("stack", "Stack", { shape: "strip", abbreviate: 2 }),
  dump("memory", "Memory", { density: "flow", perLine: 16, scale: 0.86,
    ...o.memory }),
  dump("calldata", "Calldata", { density: "flow", perLine: 16, scale: 0.86,
    ...o.calldata }),
];
const base = { timelines: ["raw"], decodings: ["raw"], links: [],
  grid: "", areas: { storage: "dump raw-storage", stack: "raw-box",
    memory: "raw-box", calldata: "raw-box" } };

// V1: storage top left, the stack a full-height strip on the right,
// memory tucked under storage, the corner left for a caption
export const rawHero: LensSpec = { ...base, id: "raw-hero",
  title: "Raw bytes, V1: storage hero, stack strip",
  layout: "raw raw-hero", views: views() };

// V2: the stack as a spine on the left, storage in the middle, memory
// and calldata stacked in a narrow column on the right
export const rawSpine: LensSpec = { ...base, id: "raw-spine",
  title: "Raw bytes, V2: stack spine, side column",
  layout: "raw raw-spine",
  views: views({ memory: { perLine: 8 }, calldata: { perLine: 8 } }) };

// V3: sheets on a desk: storage large, the stack strip laid over its
// right edge, memory and calldata as small cards overlapping its foot
export const rawSheets: LensSpec = { ...base, id: "raw-sheets",
  title: "Raw bytes, V3: overlapping sheets",
  layout: "raw raw-sheets", views: views() };

export const rawLenses = [rawHero, rawSpine, rawSheets];
