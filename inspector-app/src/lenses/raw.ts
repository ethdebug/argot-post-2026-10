// The raw lens: the bytes with no names (the post's opening figure,
// "tools have always worked backwards"). Its scene's moment (raw-hero:
// inside carol's join, while her name is written to storage): storage,
// the stack and memory, with every high-level layer off: no names, no
// tints, no popovers, no tree, no hover meaning; the gutters only. It
// lays out by its class (raw.css), at the blog figure's width and at a
// phone's.
import type { Filter, Location } from "../engine/types";
import type { Display, LensSpec, ViewSpec } from "../ui/types";

const data = { decoding: "$scene", moment: "current" } as const;
const all: Filter = { rows: "all" };
const dump = (location: Location, title: string, display: Display):
  ViewSpec => ({ id: location, kind: "dump", area: location, location,
  data, filter: all, title, display: { bare: true, ...display } });

// The post's opening figure: storage, a word a row, at the storage
// inspector's own size (its dump column on a wide page: ui raw.css);
// the stack beside it, narrow, an item a row, its word abbreviated
// (0x…c248), in the same font and row height (the lens's --cell-fs);
// memory under storage, as wide; the moment in the stack's column, under
// it. No calldata: the figure is about storage.
const dump2 = (location: Location, title: string, display: Display = {}):
  ViewSpec => dump(location, title, { ruler: false, ...display });
const base = { timelines: [], decodings: [], links: [],
  initial: { scene: "raw-hero" }, grid: "",
  areas: { storage: "dump", memory: "dump", stack: "raw-col",
    moment: "raw-col" } };

// The composition: `moment`, a quiet line naming the moment in plain
// words; false: the panels alone
export const MOMENT = "while carol joins: her name is being saved, " +
  "half-written";
export const rawLens = (o: { moment?: string | false } = {}): LensSpec => ({
  ...base, id: "raw-hero", title: "Raw bytes", layout: "raw raw-hero",
  columns: 2,
  // (storage's all-zero rows folded into its gaps: a shorter figure;
  // never the stack's or memory's, whose places matter)
  views: [dump2("storage", "Storage", { foldZero: true }),
    dump2("stack", "Stack", { abbreviate: 2 }),
    dump2("memory", "Memory"),
    ...o.moment === false ? [] : [{ id: "moment", kind: "moment" as const,
      area: "moment", data, text: o.moment ?? MOMENT }]] });
export const rawHero = rawLens();

export const rawLenses = [rawHero];
