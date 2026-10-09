// The raw lens: the bytes with no names (the post's opening figure,
// "tools have always worked backwards"). Its scene's moment (raw-hero:
// while carol plays, right after her combo resets; every player has a
// score, carol's name is complete): storage,
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
// memory under the stack, in its column: one run of bytes, 16 a line,
// each line its offset (the Dump's flow), in the same cell size; the
// moment under memory. No calldata: the figure is about storage.
const dump2 = (location: Location, title: string, display: Display = {}):
  ViewSpec => dump(location, title, { ruler: false, ...display });
const base = { timelines: [], decodings: [], links: [],
  initial: { scene: "raw-hero" }, grid: "",
  // (storage fits its column; the stack and memory hug their content,
  // in its cell size)
  areas: { storage: "dump", memory: "raw-col", stack: "raw-col",
    moment: "raw-col" } };

// The composition: `moment`, a quiet line naming the moment in plain
// words (default: none, the post's prose gives it); `memory` (default:
// shown), its dump under the stack
export const MOMENT = "while carol plays: right after her combo resets";
// the annotated figure's disclaimer: its stack and memory pointers are
// the scene's, not solc's
export const HAND = "Stack and memory: ethdebug data written by hand, " +
  "not from solc";
export const rawLens = (o: { moment?: string | false; memory?: boolean } =
  {}): LensSpec => ({
  ...base, id: "raw-hero", title: "Raw bytes",
  layout: `raw raw-hero${o.memory === false ? " no-memory" : ""}`,
  columns: 2,
  // (storage's all-zero rows folded into its gaps: a shorter figure;
  // never the stack's or memory's, whose places matter)
  views: [dump2("storage", "Storage", { foldZero: true }),
    dump2("stack", "Stack", { abbreviate: 2 }),
    ...o.memory === false ? [] : [dump2("memory", "Memory",
      { density: "flow", perLine: 16 })],
    ...!o.moment ? [] : [{ id: "moment", kind: "moment" as const,
      area: "moment", data, text: o.moment }]] });
export const rawHero = rawLens();

// The same figure, annotated in place (scene reveal, the post's
// first before/after): raw until revealed (ui/reveal.ts: the host's
// scroll, or the toggle when it stands alone), then each top-level value
// a coloured composite with a short label in unlit space (Display
// `annotate`); the stack's and memory's from the scene's hand-written
// pointers ("$hand"), said so. Its stack column keeps room on its right
// for the stack's labels (raw.css): no layout change when they appear.
// (raw-hero's composition, whatever it holds: each dump annotated, the
// stack's and memory's by the hand-written pointers; the moment by the
// scene's own words; the toggle under it)
const hand = { decoding: "$hand", moment: "current" } as const;
export const annotated = (l: LensSpec): LensSpec => ({ ...l,
  id: "raw-annotated", title: "Raw bytes, annotated",
  layout: `${l.layout} raw-annotated`, initial: { scene: "reveal" },
  views: [...l.views.filter((v) => v.kind !== "moment").map((v): ViewSpec =>
    v.kind === "dump" ? { ...v, display: { ...v.display, annotate: true },
      ...v.location === "storage" ? {} : { data: hand } } : v),
  // (where the moment was: what is written by hand, said in the
  // hand-written badge's style; shown with the stack's values)
  { id: "hand", kind: "moment", area: "moment", data, badge: true,
    text: HAND },
  { id: "reveal", kind: "reveal", area: "moment" }] });
export const rawAnnotated = annotated(rawHero);

export const rawLenses = [rawHero];
