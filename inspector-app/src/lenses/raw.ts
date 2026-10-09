// The raw lens: the bytes with no names (the post's opening figure,
// "tools have always worked backwards"). Its scene's moment (raw-hero:
// inside carol's join, while her name is written to storage): storage,
// the stack, memory and calldata, with every
// high-level layer off: no names, no tints, no popovers, no tree, no
// hover meaning; the gutters only. Three compositions of the same four
// dumps, to pick from; each lays out by its class (raw.css, which the
// shell loads), at the blog figure's width and at a phone's.
import type { Filter, Location } from "../engine/types";
import type { Display, LensSpec, ViewSpec } from "../ui/types";

const data = { decoding: "$scene", moment: "current" } as const;
const all: Filter = { rows: "all" };
const dump = (location: Location, title: string, display: Display):
  ViewSpec => ({ id: location, kind: "dump", area: location, location,
  data, filter: all, title, display: { bare: true, ...display } });

// One cell size for the whole lens: storage, memory and calldata are
// the same dump, a word a row, in one wide column whose width fits their
// font; the stack beside them, narrow, each item one row, its word
// abbreviated (0x…c248), at the same font (the lens's --cell-fs) and
// row height
const dump2 = (location: Location, title: string, area: string,
  display: Display = {}): ViewSpec =>
  ({ ...dump(location, title, { ruler: false, ...display }), area });
const base = { timelines: [], decodings: [], links: [],
  initial: { scene: "raw-hero" },
  grid: "", areas: { wide: "dump raw-col", narrow: "raw-col" } };

// The composition: `moment`, a quiet line under the stack naming the
// moment in plain words; false: the panels alone
export const MOMENT = "while carol joins: her name is being saved, " +
  "half-written";
export const rawLens = (o: { moment?: string | false } = {}): LensSpec => ({
  ...base, id: "raw-hero", title: "Raw bytes", layout: "raw raw-hero",
  columns: 2,
  views: [dump2("storage", "Storage", "wide"),
    dump2("stack", "Stack", "narrow", { abbreviate: 2 }),
    ...o.moment === false ? [] : [{ id: "moment", kind: "moment" as const,
      area: "narrow", data, text: o.moment ?? MOMENT }],
    dump2("calldata", "Calldata", "wide"),
    dump2("memory", "Memory", "wide")] });
export const rawHero = rawLens();

export const rawLenses = [rawHero];
