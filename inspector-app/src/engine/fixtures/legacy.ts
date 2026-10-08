// The vanilla fixtures (bin/make-fixtures.mjs output) and the scenes of
// fixtures/index.json, as domain data: one Timeline per fixture (points
// before and after its transaction), its contract as a Compilation, and
// each scene as a Bookmark of one or two points
import type {
  Bookmark, Compilation, Decoding, DecodingId, Hex, Path, PointId, Timeline,
  TimelineId, TimelinePoint, TxFacts, Variable,
} from "../types";
import { slotHex, toBig } from "../hex";

export interface LegacyScene {
  id: string; title: string; fixture: string;
  points: ("before" | "after")[];
  when: string | Record<string, string>;
  summary: string; select: Path; mode?: "before" | "after";
  calldata?: { signature: string; param: string };
}

interface Step { op: string; stack: string[]; memory?: string[] }
interface Fixture {
  id: string; summary: string;
  tx: { hash: Hex; from: Hex; to: Hex; input: Hex };
  contract: {
    name: string; file: string; source: string; compiler: string;
    address: Hex; variables: Variable[]; types: Compilation["types"];
    pointers: Compilation["templates"];
  };
  trace: { kept: Step[] };
  // mapping keys gathered from other traces: [base slot, [{ key }]]
  keys?: [Hex, { key: Hex }[]][];
  // Vyper's own records (the Vyper fixture): its slot, then each key
  vyper?: { base: string; entries: { key: Hex }[] };
  slots: Record<Hex, { before: Hex; after: Hex }>;
}

// a fixture's contract (solc's output, as the fixture holds it); the
// Vyper fixture's is another contract (only `players`, another address)
export const solOf = (fixtureId: string) => `sol@${fixtureId}`;
export const fixtureOf = (compilation: string) =>
  compilation.startsWith("sol@") ? compilation.slice(4) : undefined;
export const SIDES = ["before", "after"] as const;

const word = (h: string) => slotHex(toBig(h.startsWith("0x") ? h : "0x" + h));

// The slots the transaction read and wrote, and the mapping hashes'
// inputs (KECCAK256 of more than one word: key words, then the slot):
// the fixture's keys gathered from the story's traces, when it has them
// (as vanilla), else this transaction's
function facts(f: Fixture): TxFacts {
  const reads = new Set<Hex>();
  const writes = new Set<Hex>();
  const keccakInputs: Hex[][] = [];
  for (const s of f.trace.kept) {
    const top = (k: number) => s.stack[s.stack.length - 1 - k];
    if (s.op === "SLOAD") reads.add(word(top(0)));
    if (s.op === "SSTORE") writes.add(word(top(0)));
    if ((s.op === "KECCAK256" || s.op === "SHA3") && s.memory) {
      const at = Number(toBig(word(top(0))));
      const size = Number(toBig(word(top(1))));
      const mem = s.memory.map((w) => w.replace(/^0x/, "")).join("");
      const pre = mem.slice(at * 2, (at + size) * 2);
      if (size <= 32 || pre.length < size * 2) continue;
      keccakInputs.push(pre.match(/.{64}/g)!.map((w) => `0x${w}` as Hex));
    }
  }
  // (the Vyper fixture's keys as Solidity's rule reads them, key . slot,
  // and as Vyper hashed them, slot . key)
  const vy = f.vyper ? f.vyper.entries.map(({ key }) =>
    [slotHex(BigInt(f.vyper!.base)), word(key)]) : [];
  const gathered = [...(f.keys ?? []).flatMap(([base, ks]) =>
    ks.map(({ key }) => [key, base])), ...vy];
  return { ...f.tx, reads, writes,
    keccakInputs: f.keys ? gathered : keccakInputs };
}

// ethdebug/format writes a pointer expression's operator with "~"
// (`~keccak256`, `~wordsize`; #323), and the library takes no other.
// solc still writes "$" (ethdebug/format#324): its pointers and
// templates are rewritten here, where its output is read, and nowhere
// else (vanilla decode.js solcTilde). bugc writes "~".
export function solcTilde<T>(v: T): T {
  const re = (x: unknown): unknown => Array.isArray(x) ? x.map(re)
    : x && typeof x === "object" ? Object.fromEntries(Object.entries(x)
      .map(([k, y]) => [k.startsWith("$") ? `~${k.slice(1)}` : k, re(y)]))
    : typeof x === "string" && /^\$[a-z]/.test(x) ? `~${x.slice(1)}` : x;
  return re(v) as T;
}

export function fromFixture(json: unknown, fixtureId: string):
  { compilation: Compilation; timeline: Timeline } {
  const f = json as Fixture;
  const c = { ...f.contract, pointers: solcTilde(f.contract.pointers),
    variables: f.contract.variables.map((v) =>
      ({ ...v, pointer: solcTilde(v.pointer) })) };
  const compilation: Compilation = {
    id: solOf(fixtureId), language: "solidity", compiler: c.compiler,
    provenance: "compiler",
    sources: [{ id: "0", path: c.file, text: c.source }],
    types: c.types, templates: c.pointers, stateVariables: c.variables,
  };
  const transaction = facts(f);
  const points: TimelinePoint[] = SIDES.map((side) => ({
    id: `${fixtureId}:${side}`,
    label: `${side} the transaction`,
    at: { tx: f.tx.hash, side },
    // (and the call's input, its calldata)
    snapshot: { storage: new Map(Object.entries(f.slots).map(
      ([s, w]) => [s as Hex, w[side]])),
    calldata: Uint8Array.from((f.tx.input.slice(2).match(/../g) ?? [])
      .map((b) => parseInt(b, 16))) },
    transaction,
  }));
  return { compilation, timeline: { id: fixtureId,
    contract: { address: c.address,
      compilation: solOf(fixtureId) }, points,
    bookmarks: [] } };
}

// (Phase 1 parity: a scene's summary line, for the page)
export type ProjectBookmark = Bookmark &
  { timeline: TimelineId; decoding: DecodingId; summary?: string };

// The decoding a scene shows: solc's rule over its fixture's storage;
// over the Vyper fixture's, that is "vyAsSol" (Vyper's own rule,
// written by hand, is "vyRule")
export const decodingOf = (fixture: string): DecodingId =>
  fixture === "arcade-vyper" ? "vyAsSol" : `sol:${fixture}`;

export function bookmarkOf(scene: LegacyScene): ProjectBookmark {
  const points = scene.points.map((s) => `${scene.fixture}:${s}`) as
    [PointId] | [PointId, PointId];
  return {
    id: scene.id, title: scene.title, points, select: scene.select,
    ...(points.length === 2 ? { side: scene.mode ?? "after" } : {}),
    ...(scene.calldata ? { calldata: scene.calldata } : {}),
    timeline: scene.fixture, decoding: decodingOf(scene.fixture),
    summary: scene.summary,
  };
}

// Where a fixture's decoding finds mapping keys, as the fixture says:
// `keysIn: { players: "playerList" }` (the list's items); none (the Vyper
// fixture: its playerList is Vyper's own layout), the traces' keys
// (and who each key is: the fixture's `players`, address → name)
export const keySourceOf = (json: unknown): Decoding["keys"] => {
  const j = json as { keysIn?: Record<string, string>;
    players?: Record<string, string> };
  const list = Object.values(j.keysIn ?? {})[0];
  const names = j.players && Object.fromEntries(Object.entries(j.players)
    .map(([a, n]) => [a.toLowerCase().replace(/^0x/, ""), n]));
  return { ...(list ? { from: "list", path: list } as const
    : { from: "trace" } as const), ...(names ? { names } : {}) };
};
