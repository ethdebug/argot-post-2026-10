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

// One cell size for the whole lens: every panel the same dump, a word a
// row (16 bytes a line in the figure's narrow columns), in the same
// font, which each column fits; the columns are equal, so each panel
// has the same font, row height and width: the stack's words whole too.
// Two columns, each its panels one under the other (an area each):
// storage over calldata, the stack over memory, which come out even
const dump2 = (location: Location, title: string, area: string):
  ViewSpec => ({ ...dump(location, title, { ruler: false }), area });
const base = { timelines: ["raw"], decodings: ["raw"], links: [],
  grid: "", areas: { left: "dump raw-col", right: "dump raw-col" } };

export const rawHero: LensSpec = { ...base, id: "raw-hero",
  title: "Raw bytes: two columns", layout: "raw raw-hero",
  views: [dump2("storage", "Storage", "left"),
    dump2("stack", "Stack", "right"), dump2("memory", "Memory", "right"),
    dump2("calldata", "Calldata", "left")] };

export const rawLenses = [rawHero];
