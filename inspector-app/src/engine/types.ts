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
  at: { tx: Hex; side: "before" | "after" }   // handpicked (Phase 1)
    | { tx: Hex; step: number };              // a trace step (later)
  snapshot: Snapshot;
  transaction?: TxFacts;                // the tx this point is before/after
  locals?: Variable[];                  // instruction context here (BUG memory)
}
export interface Snapshot {             // known state only; unknown = absent
  storage: ReadonlyMap<Hex, Hex>;       // slot -> word
  memory?: Uint8Array;
  stack?: Hex[];                        // top last
  calldata?: Uint8Array;
  transient?: ReadonlyMap<Hex, Hex>;
}
export interface TxFacts {
  hash: Hex; from: Hex; to: Hex; input: Hex;
  reads: ReadonlySet<Hex>; writes: ReadonlySet<Hex>;   // SLOAD/SSTORE
  keccakInputs: Hex[][];                // mapping keys seen (trace provenance)
}
export interface Bookmark {             // a handpicked view of 1 or 2 points
  id: string; title: string;
  points: [PointId] | [PointId, PointId];   // 2 = compare
  select?: Path;                        // selected first
  side?: "before" | "after";            // shown first (2 points)
  calldata?: { signature: string; param: string };
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
  variables: "state" | "locals";
  keys: KeySource;                      // where mapping keys come from
}
export type KeySource = { from: "list"; path: Path }   // roster (provenance)
  | { from: "trace" };
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
  note?: string;                // "no ethdebug type …"
}
export type Location = "storage" | "memory" | "stack" | "calldata"
  | "transient";
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
  cover: ReadonlyMap<ByteKey, Path[]>;  // byte -> owners
  owned: ReadonlyMap<Path, ReadonlySet<ByteKey>>;
}
export interface Row {
  address: Hex;                         // slot, or word offset
  how: string;                // "slot 0", "keccak(0x7099…79c8, slot 3) + 1"
  what: { path: Path; name: string }[]; // byte order: "rounds · total"
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
}
export type InputId = string;
export interface InputNode {            // a fact the pointer expects
  id: InputId; name: string;            // "key", "slot"
  provenance: Provenance;     // ‹roster› ‹trace› ‹storage› ‹ABI›
  values: { value: Hex; source?: Path }[];     // source: roster[i]
}

// ------------------------------------------------- 1.6-1.7 (engine part)

export type Colour = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | "src";

export interface Target {               // what the pointer (or finger) is on
  path?: Path;
  bytes?: { row: Hex; from: number; to: number; location: Location };
  row?: Hex;                            // a gutter address
}
export interface Light {                // DERIVED per view, never stored
  bytes: ReadonlySet<ByteKey>; rows: ReadonlySet<Path>;
  colours: ReadonlyMap<Path, Colour>;
  focus?: Colour;                       // a pointed child of the selection
  cap: ReadonlySet<Path | ByteKey>;     // brown edge = the selection only
  at?: Target["bytes"]; gutters: ReadonlySet<Hex>;
  muted: boolean;                       // the rest mutes
}
export interface Filter {               // truncation, per view
  roots?: Path[];                       // only these subtrees
  rows?: "values" | "all" | Hex[];      // dump rows: owned-only, all known
  maxRows?: number;
}
