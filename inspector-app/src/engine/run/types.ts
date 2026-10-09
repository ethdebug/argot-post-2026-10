// The runner's data (timeline spec addendum §1.1-1.4): a scenario, the
// builds of its contract, a run of one build, and moments in a run
import type { Pointer, Program, Type } from "../lib";
import type {
  CompilationId, Hex, Snapshot, SourceFile, SourceRange, TypeId,
} from "../types";

export declare namespace Format {
  type Program = import("../lib").Program;
  namespace Program {
    type Context = import("../lib").Program.Context;
  }
  // (@ethdebug/format has no type for ethdebug/format/info/resources
  // yet: this is the part a build uses)
  namespace Info {
    interface Resources {
      types: Record<TypeId, Type>;
      pointers: Pointer.Templates;
    }
  }
}
export type { Program };

// ------------------------------------------------- 1.1 Scenario

export type ScenarioId = string;          // "arcade"
export type AccountName = string;         // "alice"
export interface Scenario {
  id: ScenarioId;
  chain: { hardfork: "prague"; chainId: bigint };
  accounts: { name: AccountName; address: Hex; balance: bigint }[];
  builds: Record<BuildId, Build>;         // one per language / level
  genesis: { number: bigint; timestamp: bigint };
  transactions: TxSpec[];                 // in order; index = tx index
}
export interface TxSpec {
  label: string;                          // `join("bob")`, "deploy"
  from: AccountName;
  kind: "create" | "call";                // tx 0 is the create
  call?: { signature: string; args: unknown[] } | { input: Hex };
  value?: bigint;
  block: { prevrandao: Hex; numberDelta?: bigint;   // default 1
           secondsDelta?: bigint };                 // default 12
}

// ------------------------------------------------- 1.2 Build

export type BuildId = string;     // "sol", "vy", "bug-O0", "bug-O2"
export interface Build {
  language: "solidity" | "vyper" | "bug";
  compiler: string;               // "solc 0.8.38-develop… (walnut #10)"
  create: Hex;                            // creation bytecode (+ ctor args)
  programs?: { create?: Format.Program; runtime: Format.Program };
  resources?: Format.Info.Resources;      // types, pointer templates
  sources: SourceFile[];
  compilation: CompilationId;             // spec §1.1: what decodings use
}

// ------------------------------------------------- 1.3 Run

export interface Run {                    // made by the runner; NOT serialized
  scenario: ScenarioId; build: BuildId;
  address: Hex;                           // the contract (CREATE of tx 0)
  txs: TxRun[];
  stateAt(m: MomentRef): Snapshot;        // §2.3; the ONE way to get state
}
export interface TxRun {
  label: string; from: Hex; input: Hex;
  result: { success: boolean; returnData: Hex; gasUsed: bigint };
  steps: number;                          // trace step count
  pc: Int32Array; op: Uint8Array; depth: Uint8Array;
  frame: Uint16Array;                     // index into frames, per trace step
  frames: Frame[];                        // one per message (call/create)
  stack: bigint[][];                      // per trace step (small)
  memory: Uint8Array[];                   // per trace step; shared copies
  storage: Journal;                       // SSTOREs by trace step, frame-aware
  transient: Journal;                     // TSTOREs, cleared after the tx
  touched: ReadonlySet<Hex>;              // slots SLOADed or SSTOREd
  keccakInputs: Hex[][];                  // KECCAK256 inputs (key provenance)
}
export interface Frame {                  // from the EVM's message events
  depth: number; address: Hex; codeAddress: Hex; caller: Hex;
  calldata: Uint8Array; returnData?: Uint8Array;
  first: number; last: number;            // its trace steps
  reverted: boolean;                      // its journal writes are undone
}
// (a write at trace step `step`, by frame `frame`: the SSTORE or TSTORE
// instruction at that trace step)
export type Journal = { step: number; frame: number; slot: Hex;
  value: Hex }[];

// ------------------------------------------------- 1.4 Moment, timeline

export interface MomentRef { tx: number; step: number | "end" }
// step: a trace step index (state before that instruction);
// "end": after the transaction, committed (storage only, no frame)
export interface Moment extends MomentRef {
  label?: string;                         // "the middle of the game"
  // annotations: filled from the run (authoring) or the snapshot
  // (reader); never written by hand
  pc?: number; op?: string; depth?: number;
  range?: SourceRange;                    // the code panel's (§6)
  context?: Format.Program.Context;       // the instruction's (§6)
}
export type Timeline = Moment[];          // ordered by (tx, step); flat
