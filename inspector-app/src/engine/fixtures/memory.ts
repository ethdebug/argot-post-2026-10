// fixtures/memory.json (vanilla's "Inside one play"): Arcade's BUG port,
// compiled by bugc at O0 and at O2, paused at three points of alice's
// third hit. Each level is a Compilation (its locals come with each
// point: an instruction's context) and a Timeline of the paused steps,
// with memory at each; each pause is a Bookmark of one step, or two
// (before and after a step). At the last pause, alice's record slot,
// which the page reads by BUG's rule (bugc's pointer for `players`
// gives only its base slot).
import type {
  Compilation, Decoding, DecodingId, Hex, Local, Timeline, TimelinePoint,
} from "../types";
import type { ProjectBookmark } from "./legacy";

interface Step { step: number; op: string; memory: Hex;
  range?: { offset: number; length: number }; variables: Local[] }
interface MemoryJson {
  program: { name: string; file: string; source: string };
  compiler: { name: string; branch: string; commit: string };
  player: Hex;
  levels: { optimize: number; tx: { hash: Hex; to: Hex };
    trace: { steps: number };
    points: { id: string; title: string; steps: Step[];
      record?: { key: Hex; base: number; slot: Hex; word: Hex } }[] }[];
}

// the function the locals of a pause are in, if not play()'s body; the
// selection each pause opens with (vanilla mem.js GROUP, DEFAULT)
const SCOPE: Record<string, string> = { mult: "_applyCombo" };
const SELECT: Record<string, string> = { roll: "hit", mult: "_applyCombo",
  writes: "gained" };
// Player's members, from the low end of the slot (BUG's rule, Solidity's)
const MEMBERS: [string, number][] = [["score", 8], ["combo", 4],
  ["bestCombo", 4], ["plays", 4], ["hits", 4], ["lastBlock", 8]];

const bytesOf = (h: Hex) => Uint8Array.from((h.slice(2).match(/../g) ?? [])
  .map((b) => parseInt(b, 16)));

export function fromMemory(json: unknown): { compilations: Compilation[];
  timelines: Timeline[]; bookmarks: ProjectBookmark[];
  decodings: Record<DecodingId, Decoding> } {
  const m = json as MemoryJson;
  const c = m.compiler;
  const out = { compilations: [] as Compilation[],
    timelines: [] as Timeline[], bookmarks: [] as ProjectBookmark[],
    decodings: {} as Record<DecodingId, Decoding> };
  for (const L of m.levels) {
    const o = `O${L.optimize}`;
    const compilation = `bug-${o}`;
    const timeline = `mem-${o}`;
    const decoding = `mem:${o}`;
    out.compilations.push({ id: compilation, language: "bug",
      compiler: `bugc -O ${L.optimize} (ethdebug/format ${c.branch}, ${
        c.commit.slice(0, 9)})`, provenance: "compiler",
      sources: [{ id: m.program.file, path: m.program.file,
        text: m.program.source }],
      types: {}, templates: {}, stateVariables: [] });
    const points: TimelinePoint[] = [];
    for (const p of L.points) {
      const ids = p.steps.map((_, k) => p.steps.length === 1 ? `${o}/${p.id}`
        : `${o}/${p.id}:${k}`);
      p.steps.forEach((s, k) => points.push({
        id: ids[k], label: p.title,
        at: { tx: L.tx.hash, step: s.step },
        snapshot: { memory: bytesOf(s.memory),
          storage: new Map(p.record ? [[p.record.slot, p.record.word]] : []) },
        locals: s.variables,
        paused: { step: s.step, op: s.op, of: L.trace.steps,
          ...(s.range ? { range: { source: m.program.file, ...s.range } }
            : {}) },
        ...(SCOPE[p.id] ? { scope: SCOPE[p.id] } : {}),
        ...(p.record ? { record: { path: "players[msg.sender]",
          key: p.record.key, base: p.record.base, slot: p.record.slot,
          members: MEMBERS } } : {}),
      }));
      out.bookmarks.push({ id: `${o}/${p.id}`, title: p.title,
        points: ids as [string] | [string, string],
        ...(SELECT[p.id] ? { select: SELECT[p.id] } : {}),
        ...(ids.length === 2 ? { side: "after" as const } : {}),
        timeline, decoding });
    }
    out.timelines.push({ id: timeline, contract: { address: L.tx.to,
      compilation }, points, bookmarks: [] });
    out.decodings[decoding] = { id: decoding, compilation, timeline,
      variables: "locals", keys: { from: "trace" } };
  }
  for (const t of out.timelines) {
    t.bookmarks = out.bookmarks.filter((b) => b.timeline === t.id);
  }
  return out;
}
