// UI state and lens configuration (timeline-inspector spec §1.6-1.7)
import type { ComponentType, ReactNode } from "react";
import type {
  Decoding, DecodingId, Filter, Location, Path, PointId, Target, TimelineId,
} from "../engine/types";

export type LinkId = string;
export type ViewId = string;

export interface LinkState {    // shared by the views of one link group
  selection: Path | null;
  hover: Target | null;
  // a walkthrough (null: none): the step shown, the instance in focus
  // ("*": all; a path: one entry), and how many steps it has
  // (`busy`: the details are unfolding or folding, no step meanwhile;
  // `exit`: asked to end, the panel folds the details first)
  walk: { step: number; focus?: string; n?: number; busy?: boolean;
    exit?: boolean } | null;
}
// While a selection rests (no walkthrough), a click (not a key) on what
// it does not light only ends it: the one rule for the clicks and the
// cursor (the views' data-exits)
export const exiting = (s: LinkState) => !!s.selection && !s.walk;
export interface ViewState {    // one view instance's own state
  collapsed: ReadonlySet<Path>; // Tree only; default empty (expanded)
  // (Tree, the related view: the selection's members the reader opened;
  // the others are shut there)
  open?: ReadonlySet<Path>;
}
export interface LensState {
  bookmark?: string;
  points: Record<string, PointId>;   // named point slots: "a", "b"
  side?: "before" | "after";    // which of a pair is shown (Phase 1)
  insets: boolean;              // Phase 1 parity; fate open
  links: Record<LinkId, LinkState>;
  views: Record<ViewId, ViewState>;
  // (a bookmark whose data did not load: the error, until it does)
  error?: string;
  // (each show of a bookmark, counted: the views start from the top)
  shows?: number;
  // (a click or Escape that cleared a selection from outside it: no
  // hover until the pointer moves past 3px from here: ui/hooks.ts hush)
  hush?: { x: number; y: number };
  // the "Related" view (absent: off): the dumps show only the rows
  // related to the selection, with `context` rows around each; the tree
  // only the selection's path, its members and the related values
  related?: { context: number };
}

// How a dump draws its rows: parameters of the one Dump, for any
// location (none: a word a row, as ever)
export interface Display {
  // "strip": a tall, narrow column (a word's four groups of eight one
  // under another; with `abbreviate`, a line a word)
  shape?: "rows" | "strip";
  // a word as its last `abbreviate` bytes after "0x…" (its leading zero
  // bytes dropped; a word that short whole: 0x22)
  abbreviate?: number;
  // "flow": the rows' bytes as one run, `perLine` bytes a line (default
  // 16), words going on one into the next: no gap rows, tighter type
  density?: "rows" | "flow";
  perLine?: number;
  scale?: number;               // the type's size, times this
  // the bytes only: no names, no tints, no popovers, no hover or click
  bare?: boolean;
}

// a view's data: a decoding (or "$bm", the current bookmark's) at a
// point (or a named point slot: "a", "b", or "$side", the shown one)
export type DataRef = { decoding: DecodingId;
  point: PointId | { slot: string } };
// … resolved by the Lens
export type DataAt = { decoding: DecodingId; point: PointId };

export type ViewSpec = { id: ViewId; area: string; link?: LinkId;
  domId?: string }
  & ({ kind: "dump"; location: Location; data: DataRef; filter?: Filter;
      // Phase 1's pair: the side of it this dump is (shown when the lens
      // shows that side; titled Before/After); else its own title
      side?: "before" | "after"; title?: string;
      // the point (or decoding) it compares with: changed bytes, the
      // slots' facts (Phase 1's pair: the other side)
      compare?: DataRef;
      // other decodings of the same point whose words it shows, owned
      // by none here, named "<who> keccak(…)" (Phase 1: Vyper's)
      others?: { decoding: DecodingId; who?: string }[];
      // (its points are paused steps of a trace, not a transaction's
      // before and after)
      steps?: boolean;
      display?: Display }
    | { kind: "tree"; data: DataRef; filter?: Filter;
      variant?: "tree" | "table"; compare?: DataRef;
      // the dumps it lines up with (default: the lens's)
      align?: ViewId[]; plain?: boolean;
      // (compared with no other point: one call's calldata)
      alone?: boolean;
      // (its rows also carry data-part: the calldata section's contract)
      partAttr?: boolean }
    | { kind: "picker";
      of: "bookmarks" | "points" | "side" | "level" | "related";
      // (a side picker in a row of its own, hidden at one point)
      row?: string }
    // the memory section's (Locals.tsx)
    | { kind: "details" | "derivation"; data: DataRef }
    | { kind: "source"; data: DataRef; part?: "legend" }
    // the contract's source, its selection's declaration marked
    | { kind: "contract"; data: DataRef }
    | { kind: "note"; data: DataRef; part: "note" | "viewing" | "meta" }
    // the calldata section's: what a part is, how the ABI finds it
    | { kind: "abi"; data: DataRef; part: "details" | "how" }
    | { kind: "walkthrough"; data: DataRef; compare?: DataRef;
      others?: { decoding: DecodingId; who?: string }[] });
export type ViewKind = ViewSpec["kind"];

export interface LensSpec {     // a composition for one post section
  id: string; title: string;
  timelines: TimelineId[];
  // its decodings: the Project's (by id), or its own
  decodings: (DecodingId | Decoding)[];
  bookmarks?: string[];         // picker entries (Phase 1: the scenes)
  grid: string;                 // CSS grid-template-areas
  // (or "", and a class whose CSS lays the areas out, at every width)
  layout?: string;
  views: ViewSpec[];
  links: LinkId[];
  initial?: Partial<LensState>; // incl. a started walkthrough
  hash?: { prefix: string; legacy?: boolean; levels?: boolean };
  // Phase 1 parity: an area's own wrapper (the dumps' #panel, in the
  // run.mjs contract), and its grid cell's class (vanilla's box)
  wrap?: Record<string, ComponentType<{ children: ReactNode }>>;
  areas?: Record<string, string>;
  // a link group whose selection is its own part of the page: its
  // areas (Escape and a click on empty space there are its alone)
  scopes?: Record<string, LinkId>;
}
