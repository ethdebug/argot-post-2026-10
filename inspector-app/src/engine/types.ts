// The domain types (timeline-inspector spec §1.1-1.5), and the parts of
// §1.6-1.7 the engine computes with (Filter, Target, Colour, Light).
// Pure data: made by compilers, chains, fixtures and the engine.
import type { Pointer, Type } from "./lib";

export declare namespace Format {
  type Type = import("./lib").Type;
  type Pointer = import("./lib").Pointer;
  namespace Pointer {
    type Templates = import("./lib").Pointer.Templates;
  }
}
export type { Pointer, Type };

// ------------------------------------------------- 1.1 Program

export type Hex = `0x${string}`;
export type TypeId = string;            // "t_struct$_Player_$16_storage"
export type CompilationId = string;     // "arcade-sol", "arcade-vy-rule"

export interface Compilation {          // one compiler's output, one contract
  id: CompilationId;
  language: "solidity" | "vyper" | "bug" | "fe";
  compiler: string;                     // "solc 0.8.38-develop… (walnut #10)"
  provenance: "compiler" | "hand-written";
  sources: SourceFile[];
  types: Record<TypeId, Format.Type>;   // ethdebug resources
  templates: Format.Pointer.Templates;  // ethdebug resources
  stateVariables: Variable[];           // program-level context `variables`
}
// ethdebug/format/program/context/variables
export interface Variable {
  identifier: string;
  type: { id: TypeId } | Format.Type;
  pointer: Format.Pointer;
  declaration?: SourceRange;
}
export interface SourceFile { id: string; path: string; text: string }
export interface SourceRange { source: string; offset: number; length: number }

// ------------------------------------------------- 1.2 Timeline

export type TimelineId = string;        // one deployment's history
export type PointId = string;

export interface Timeline {
  id: TimelineId;
  contract: { address: Hex; compilation: CompilationId };
  points: TimelinePoint[];              // execution order
  bookmarks: Bookmark[];                // was: scenes
  trace?: TraceRef;                     // Phase 2+: points at any trace step
}
export interface TimelinePoint {
  id: PointId;
  label: string;                        // "in the middle of the game"
  at: { tx: Hex; side: "before" | "after" }   // a fixture's (legacy)
    | { tx: Hex; step: number }               // a fixture's paused step
    | { tx: number; step: number | "end" };   // a moment (run/types)
  snapshot: Snapshot;
  transaction?: TxFacts;                // the tx this point is before/after
  locals?: Local[];                     // instruction context here (BUG memory)
  // (the port's, for a paused step: the trace step, its instruction and
  // source range; the function whose frame the locals are in, if not
  // the body's; a storage slot the page reads by its own rule)
  // (`last`: the range is the last one before this trace step, which
  // has none of its own: shown muted; engine/moment.ts)
  paused?: { step: number; op: string; of?: number;
    range?: { source: string; offset: number; length: number };
    last?: true };
  scope?: string;
  record?: { path: Path; key: Hex; base: number; slot: Hex;
    members: [name: string, bytes: number][] };
}
// a local variable, as an instruction's context lists it: one with no
// pointer has no location there
export type Local = Omit<Variable, "pointer"> &
  { pointer?: Format.Pointer };
export interface Snapshot {             // known state only; unknown = absent
  storage: ReadonlyMap<Hex, Hex>;       // slot -> word
  memory?: Uint8Array;
  stack?: Hex[];                        // top last
  calldata?: Uint8Array;
  transient?: ReadonlyMap<Hex, Hex>;
}
export interface TxFacts {             // (no hash: a run has none)
  from: Hex; to: Hex; input: Hex;
  reads: ReadonlySet<Hex>; writes: ReadonlySet<Hex>;   // SLOAD/SSTORE
  keccakInputs: Hex[][];                // mapping keys seen (trace provenance)
}
export interface Bookmark {             // a handpicked view of 1 or 2 points
  id: string; title: string;
  points: [PointId] | [PointId, PointId];   // 2 = compare
  select?: Path;                        // selected first
  side?: "before" | "after";            // shown first (2 points)
  calldata?: { signature: string; param: string };
  walk?: { step: number };              // its selection's, started
}
export interface TraceRef { url: string; steps: number;
  engine: "ref" | "soldb" }

// ------------------------------------------------- 1.3 Decoding and values

export type Path = string;              // "players[0x7099…79c8].name"
export type DecodingId = string;

export interface Decoding {             // "this rule over that storage"
  id: DecodingId;
  compilation: CompilationId;           // whose variables + templates
  timeline: TimelineId;                 // whose snapshots
  variables: "state" | "locals" | "abi" | "scope";
  keys: KeySource;                      // where mapping keys come from
  // ("abi": a call's calldata by the ABI encoding, for this function and
  // its one string parameter)
  abi?: { signature: string; param: string };
  // (one compiler's rule over another compiler's storage: the Vyper
  // scene's, solc's pointers over Vyper's storage; `rule`: the decoding
  // of that storage by its own compiler's layout, for the contrast)
  foreign?: { language: string; rule: DecodingId };
  // (variables "locals": these, not the point's context's: pointers a
  // scene writes by hand for its moment, where the compiler names no
  // locals (`provenance`: "hand-written"; a dotted identifier is a
  // member of a group, "keccak scratch.key")
  locals?: Local[];
  provenance?: "hand-written";
}
// (from: "list": a list in storage, e.g. playerList; its provenance)
// (from: "trace": keys hashed with the variable's base slot, or with
// `slot`: another compiler's slot for it, read by this rule)
export type KeySource = { from: "list"; path: Path }   // roster (provenance)
  | { from: "trace"; slot?: Hex };
export type Provenance = "compiler" | "storage" | "trace" | "abi"
  | "hand-written" | { list: Path };

export interface Decoded {              // a Decoding at one point
  decoding: DecodingId; point: PointId;
  tree: ValueNode[]; byPath: ReadonlyMap<Path, ValueNode>;
  graphs: ReadonlyMap<string, DerefGraph>;     // per root variable
  layouts: Partial<Record<Location, Layout>>;
}
export interface ValueNode {
  path: Path; label: string; root: string;     // root = variable
  type: TypeId; typeText: string;              // "mapping(address => Player)"
  value?: { text: string; hex: Hex };
  regions: ResolvedRegion[];    // the bytes it owns (incl. length parts)
  children?: ValueNode[];
  summary?: string;             // "length 3", "3 entries", "7 fields"
  // (memory: a local listed with no location; the regions read to find
  // the value, e.g. a frame pointer; what the node is, if not a value of
  // a variable: a function's locals, a slot read by the page's own rule)
  none?: true;
  // (not in this moment's tree, but in another moment's of its scene:
  // its row kept, muted, "not yet": engine/union.ts)
  absent?: true;
  reads?: ResolvedRegion[];
  kind?: "group" | "record";
  // (a calldata part's ABI id: "m-length", vanilla's data-part)
  part?: string;
  note?: string;                // "no ethdebug type …"
}
export type Location = "storage" | "memory" | "stack" | "calldata"
  | "transient" | "returndata" | "code";
export interface ResolvedRegion {       // a Cursor.Region, plain
  location: Location; name?: string;
  slot?: bigint; offset: number; length: number;
  role: "value" | "length";
  instance: InstanceId;                 // which dereference instance made it
}

// ------------------------------------------------- 1.4 Layout

export type ByteKey = string;           // `${location}|${row}|${byte}`
export interface Layout {
  location: Location; point: PointId;
  rows: Row[];                          // strict address order; gaps marked
  // owners by id: a value's path, or `${path}#length` for the regions
  // a string reads to find its length (vanilla's owner ids)
  cover: ReadonlyMap<ByteKey, Path[]>;  // byte -> owners
  owned: ReadonlyMap<Path, ReadonlySet<ByteKey>>;
  // (rows go on past the last one shown: a "⋯" after it)
  more: boolean;
}
export interface Row {
  address: Hex;                         // slot, or word offset
  how: string;                // "slot 0", "keccak(0x7099…79c8, slot 3) + 1"
  what: { path: Path; name: string }[]; // byte order: "totalHits · totalScore"
  role?: "own-slot";          // a variable's slot with none of its data
  gapBefore?: boolean;
}

// ------------------------------------------------- 1.5 Dereference graph

export type NodeId = string;            // "<template or variable>#<AST path>"
export type InstanceId = string;
export type NodeKind = "declared" | "template" | "define" | "region"
  | "group" | "list" | "conditional";

export interface DerefGraph {
  root: string;                         // variable identifier
  pointer?: Format.Pointer;             // the pointer walked
  nodes: ReadonlyMap<NodeId, RuleNode>; // deduped by AST node
  inputs: InputNode[];
  order: NodeId[];                      // AST pre-order = library order
}
export interface RuleNode {
  id: NodeId; kind: NodeKind; parent?: NodeId;
  ast: Format.Pointer;                  // the construct (YAML band source)
  template?: string;                    // the template it is inside
  instances: Instance[];                // one per evaluation
}
export interface Instance {
  id: InstanceId; node: NodeId;
  entry?: Hex;                          // the root binding it belongs to
  bindings: Record<string, Hex>;        // variables in scope, as used
  value?: Hex;                          // a define's value
  region?: ResolvedRegion;              // a region's result
  branch?: "then" | "else";             // a conditional's choice
  uses: InstanceId[];                   // EDGES: data it read
  inputs: InputId[];                    // EDGES from outside the pointer
  // (the port's: the instances the walk was inside when it made this
  // one, outermost first: templates, defines, lists, conditionals)
  within?: InstanceId[];
  // (a region's: each field's expression and value, and an operation's
  // operands that are expressions, with theirs)
  fields?: { field: "slot" | "offset" | "length"; expr: unknown; value: Hex;
    args?: { expr: unknown; value: Hex }[] }[];
}
export type InputId = string;
export interface InputNode {            // a fact the pointer expects
  id: InputId; name: string;            // "key", "slot"
  provenance: Provenance;   // ‹playerList› ‹trace› ‹storage›
                            // ‹ABI›
  values: { value: Hex; source?: Path }[];     // source: playerList[i]
}

// ------------------------------------------------- 1.6-1.7 (engine part)

// ("nt": neutral, a walkthrough's row or slot that is not the selection
// and has no colour of its own; never the selection's yellow)
export type Colour = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "src" | "nt";

export interface Target {               // what the pointer (or finger) is on
  path?: Path;
  bytes?: { row: Hex; from: number; to: number; location: Location };
  row?: Hex;                            // a gutter address
  // (the row's location: a row is a location's row; storage slot 3 is
  // not the stack's row 3)
  location?: Location;
  // (the port's: a region named elsewhere, e.g. Vyper's word in the
  // walkthrough's contrast list: its bytes, owned or not)
  region?: ResolvedRegion;
  // (and the side of a pair it was found at: a derivation's step)
  side?: "before" | "after";
}
export interface Light {                // DERIVED per view, never stored
  bytes: ReadonlySet<ByteKey>; rows: ReadonlySet<Path>;
  colours: ReadonlyMap<Path, Colour>;
  // a pointed child of the selection; "none": something it consulted is
  // pointed at, every child colour steps back
  focus?: Colour | "none";
  cap: ReadonlySet<Path | ByteKey>;     // brown edge = the selection only
  at?: Target["bytes"]; gutters: ReadonlySet<Hex>;
  muted: boolean;                       // the rest mutes
  // (a walkthrough step's: bytes and rows that echo the focus, muted;
  // the rows the steps so far have found, which keep their labels; the
  // word whose byte positions show; no labels at all: step 0)
  dim?: ReadonlySet<ByteKey>; dimRows?: ReadonlySet<Path>;
  known?: ReadonlySet<Hex>; ruler?: Hex; quiet?: boolean;
  // (a walkthrough's last step, found: the resting view, both sides)
  rest?: boolean;
  // (a walkthrough's: bytes in a colour of their own, whatever owns them
  // (another rule's words); whole slots outlined in a colour (a computed
  // slot, not yet read); the slots the walkthrough touches, which make
  // one run for its labels; its names for the keys in labels)
  walk?: boolean; byteColours?: ReadonlyMap<ByteKey, Colour>;
  wholes?: ReadonlyMap<Hex, Colour>; span?: ReadonlySet<Hex>;
  names?: ReadonlyMap<string, string>;
  // (pointed at: bytes no value owns, `at`)
  unmapped?: boolean;
  // (a selection's consulted rows, engine/related.ts withRelated: the
  // related rows it does not light; the bytes of the related values
  // outside it, and their tree rows with the colour each leads to (0:
  // neutral); the related rows that are a variable's empty own slot,
  // its anchor, by its path)
  related?: ReadonlySet<Hex>; relBytes?: ReadonlySet<ByteKey>;
  relColours?: ReadonlyMap<Path, Colour>;
  anchors?: ReadonlyMap<Hex, Path>; relReads?: ReadonlySet<Hex>;
}
export interface Filter {               // truncation, per view
  roots?: Path[];                       // only these subtrees
  // dump rows: the values' (and own slots); also the slots the point's
  // transaction read or wrote; or the values' and these; or every row
  // the point has of the location (its whole storage, memory, stack)
  rows?: "values" | "touched" | "all" | Hex[];
  // only these rows, and `context` adjacent rows on each side of each
  // (the "Related" view: a selection's related rows, engine/related.ts)
  only?: { rows: Hex[]; context?: number };
  maxRows?: number;
}
