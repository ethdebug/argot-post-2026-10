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
// (memory, as an option, under storage, as wide); the moment in the
// stack's column, under it. No calldata: the figure is about storage.
const dump2 = (location: Location, title: string, display: Display = {}):
  ViewSpec => dump(location, title, { ruler: false, ...display });
const base = { timelines: [], decodings: [], links: [],
  initial: { scene: "raw-hero" }, grid: "",
  areas: { storage: "dump", memory: "dump", stack: "raw-col",
    moment: "raw-col" } };

// The composition: `moment`, a quiet line naming the moment in plain
// words (false: the panels alone); `memory`, its dump under storage (the
// post's figure has none: storage and the stack)
export const MOMENT = "while carol plays: right after her combo resets";
export const rawLens = (o: { moment?: string | false; memory?: boolean } =
  {}): LensSpec => ({
  ...base, id: "raw-hero", title: "Raw bytes",
  layout: `raw raw-hero${o.memory ? "" : " no-memory"}`, columns: 2,
  // (storage's all-zero rows folded into its gaps: a shorter figure;
  // never the stack's or memory's, whose places matter)
  views: [dump2("storage", "Storage", { foldZero: true }),
    dump2("stack", "Stack", { abbreviate: 2 }),
    ...o.memory ? [dump2("memory", "Memory")] : [],
    ...o.moment === false ? [] : [{ id: "moment", kind: "moment" as const,
      area: "moment", data, text: o.moment ?? MOMENT }]] });
export const rawHero = rawLens();

// The same figure, annotated in place (scene raw-annotated, the post's
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
  layout: `${l.layout} raw-annotated`, initial: { scene: "raw-annotated" },
  views: [...l.views.map((v): ViewSpec => v.kind === "dump"
    ? { ...v, display: { ...v.display, annotate: true },
      ...v.location === "storage" ? {} : { data: hand } }
    : v.kind === "moment" ? { ...v, text: undefined } : v),
  { id: "reveal", kind: "reveal", area: "moment" }] });
export const rawAnnotated = annotated(rawHero);

export const rawLenses = [rawHero];
