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
export interface ViewState {    // one view instance's own state
  collapsed: ReadonlySet<Path>; // Tree only; default empty (expanded)
}
export interface LensState {
  bookmark?: string;
  points: Record<string, PointId>;   // named point slots: "a", "b"
  side?: "before" | "after";    // which of a pair is shown (Phase 1)
  insets: boolean;              // Phase 1 parity; fate open
  links: Record<LinkId, LinkState>;
  views: Record<ViewId, ViewState>;
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
      others?: { decoding: DecodingId; who?: string }[] }
    | { kind: "tree"; data: DataRef; filter?: Filter;
      variant?: "tree" | "table"; compare?: DataRef;
      // the dumps it lines up with (default: the lens's)
      align?: ViewId[] }
    | { kind: "picker"; of: "bookmarks" | "points" | "side" | "level" }
    // the bookmark's call's calldata, by the ABI (its own selection)
    | { kind: "calldata"; data: DataRef }
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
  views: ViewSpec[];
  links: LinkId[];
  initial?: Partial<LensState>; // incl. a started walkthrough
  hash?: { prefix: string; legacy?: boolean };  // URL keys
  // Phase 1 parity: an area's own wrapper (the dumps' #panel, in the
  // run.mjs contract), and its grid cell's class (vanilla's box)
  wrap?: Record<string, ComponentType<{ children: ReactNode }>>;
  areas?: Record<string, string>;
}
