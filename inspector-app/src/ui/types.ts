// UI state and lens configuration (timeline-inspector spec §1.6-1.7)
import type { ComponentType, ReactNode } from "react";
import type { Project } from "../engine/project";
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
// While a selection rests (no walkthrough), a click (not a key) outside
// it only ends it: the one rule for the clicks and the cursor (the
// views' data-exits). Inside it: what it lights, and what it consulted
// (the related treatment: classes hl and rel; a click there selects it)
export const exiting = (s: LinkState) => !!s.selection && !s.walk;
export const outside = (s: LinkState, lit: boolean, consulted: boolean) =>
  exiting(s) && !lit && !consulted;
export interface ViewState {    // one view instance's own state
  collapsed: ReadonlySet<Path>; // Tree only; default empty (expanded)
  // (Tree, the related view: the selection's members the reader opened;
  // the others are shut there)
  open?: ReadonlySet<Path>;
}
export interface LensState {
  scene?: string;               // the scene shown (a bookmark: its id)
  moment: number;               // its moment shown: an index of its points
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
  // the byte ruler over the rows (default: shown, where rows are words)
  ruler?: boolean;
  // rows whose bytes are all zero folded into the gaps (⋯; gaps that
  // meet, one): a figure's storage, shorter
  foldZero?: boolean;
  // (with `bare`) the annotated layer: each top-level value a coloured
  // composite, a short label in unlit space beside its bytes, shown
  // while the figure is revealed (ui/reveal.ts); the bytes stay put
  annotate?: boolean;
}

// a view's data: a decoding (or "$scene", the scene's) at a moment of
// the scene: the one shown ("current"), the one before it ("previous";
// none at the first: the view is idle), or the n-th; or at a point
export type Moment = "current" | "previous" | number;
export type DataRef = { decoding: DecodingId; point: PointId }
  | { decoding: DecodingId; moment: Moment };
// … resolved by the Lens
export type DataAt = { decoding: DecodingId; point: PointId };

export type ViewSpec = { id: ViewId; area: string; link?: LinkId;
  domId?: string }
  & ({ kind: "dump"; location: Location; data: DataRef; filter?: Filter;
      title?: string;
      // its title in a scene of two moments ("moment": `title` and the
      // moment's label; default: `title`)
      title2?: string;
      // the moment (or decoding) it compares with: changed bytes, the
      // slots' facts, and the rows its transaction touched
      compare?: DataRef;
      // (with no point to show, e.g. "previous" at a scene's first
      // moment: no box at all, rather than an idle one)
      idle?: "hidden";
      // other decodings of the same point whose words it shows, owned
      // by none here, named "<who> keccak(…)" (Phase 1: Vyper's)
      others?: { decoding: DecodingId; who?: string }[];
      display?: Display }
    | { kind: "tree"; data: DataRef; filter?: Filter;
      variant?: "tree" | "table"; compare?: DataRef;
      // the dumps it lines up with (default: the lens's)
      align?: ViewId[]; plain?: boolean;
      // (a heading over it: the rule it reads by)
      title?: string;
      // (compared with no other point: one call's calldata)
      alone?: boolean;
      // (its rows also carry data-part: the calldata section's contract)
      partAttr?: boolean }
    | { kind: "picker";
      of: "bookmarks" | "points" | "level" | "related" }
    // the memory section's (Locals.tsx)
    | { kind: "source"; data: DataRef; part?: "legend" }
    // the contract's source, its selection's declaration marked
    | { kind: "contract"; data: DataRef }
    // a moment's source, its range marked; the locals in scope there
    // (Code.tsx, Variables.tsx: addendum §6)
    | { kind: "code"; data: DataRef }
    // the debugger's moves (Moves.tsx)
    | { kind: "moves" }
    // the annotated layer's toggle, Raw | Annotated (ui/reveal.ts), when
    // the figure stands alone
    | { kind: "reveal" }
    | { kind: "variables"; data: DataRef }
    | { kind: "note"; data: DataRef; part: "note" | "viewing" | "meta" }
    // the moment a point is, in a line, in plain words: `text`, or the
    // point's label
    | { kind: "moment"; data: DataRef; text?: string }
    // the calldata section's: what a part is, how the ABI finds it
    | { kind: "abi"; data: DataRef; part: "details" | "how" }
    | { kind: "walkthrough"; data: DataRef; compare?: DataRef;
      others?: { decoding: DecodingId; who?: string }[] });
export type ViewKind = ViewSpec["kind"];

export interface LensSpec {     // a composition for one post section
  id: string; title: string;
  // (a lens for the developers only: the shell lists it in "dev")
  dev?: boolean;
  // (a dev lens that makes its own data: the shell draws this in place
  // of a Lens of the spec, on the shell's project)
  page?: ComponentType<{ spec: LensSpec; project: Project }>;
  timelines: TimelineId[];
  // its decodings: the Project's (by id), or its own
  decodings: (DecodingId | Decoding)[];
  bookmarks?: string[];         // picker entries (Phase 1: the scenes)
  grid: string;                 // CSS grid-template-areas
  // (or "", and a class whose CSS lays the areas out, at every width)
  layout?: string;
  // how many columns it lays out side by side on a wide page (a host
  // sizes its figure by it); default: the most areas in a grid row
  columns?: 1 | 2;
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
