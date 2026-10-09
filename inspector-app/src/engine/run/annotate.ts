// A moment's annotations from its run and build (addendum §1.4): the
// instruction's pc, op and depth at the trace step, and the context
// that holds there with its source range. Contexts are postconditions:
// at trace step i, instruction i - 1's context holds; at 0, the
// program's (@ethdebug/programs-react's rule, as the debugger demo).
import {
  effectiveContextForStep,
} from "@ethdebug/programs-react/dist/src/utils/effectiveContext.js";
import {
  extractVariablesFromInstruction,
} from "@ethdebug/programs-react/dist/src/utils/mockTrace.js";
import type { SourceRange } from "../types";
import type { Local } from "../types";
import type { Build, Format, Moment, MomentRef, Run } from "./types";
import { opName } from "./opcodes";

type Context = Format.Program.Context;
type Ctx = { code?: { source?: { id: unknown };
  range?: { offset: number; length: number } };
  gather?: Ctx[]; pick?: Ctx[] };

// a context's source range: its code's, or the first in a gather or
// pick (as make-raw-fixture.mjs)
function rangeOf(ctx: Ctx | undefined): SourceRange | undefined {
  if (!ctx) return undefined;
  if (ctx.code?.range && ctx.code.source) {
    return { source: String(ctx.code.source.id), ...ctx.code.range };
  }
  for (const x of [...(ctx.gather ?? []), ...(ctx.pick ?? [])]) {
    const r = rangeOf(x);
    if (r) return r;
  }
  return undefined;
}

// the variables a context lists (programs-react's reading: gather and
// pick joined), less the state variables the program context lists
export function locals(ctx: Context, build?: Build): Local[] {
  const state = new Set(((build?.programs?.runtime.context as
    { variables?: { identifier: string }[] })?.variables ?? [])
    .map((v) => v.identifier));
  const all = extractVariablesFromInstruction({ offset: 0,
    context: ctx } as never) as Local[];
  return all.filter((v) => !state.has(v.identifier));
}

// One run's annotator: each program's instructions by pc, made once
export function annotator(run: Run, build: Build):
  (ref: MomentRef | Moment) => Moment {
  const maps = new Map<Format.Program, Map<number,
    Format.Program.Instruction>>();
  const byPcOf = (p: Format.Program) => {
    if (!maps.has(p)) {
      maps.set(p, new Map(p.instructions.map((x) => [Number(x.offset), x])));
    }
    return maps.get(p)!;
  };
  return (ref) => {
    const t = run.txs[ref.tx];
    if (!t) throw new Error(`no transaction ${ref.tx}`);
    const { pc: _p, op: _o, depth: _d, range: _r, context: _c, ...m } =
      ref as Moment;
    if (ref.step === "end") return m;
    const i = ref.step;
    const frame = t.frames[t.frame[i]];
    const out: Moment = { ...m, pc: t.pc[i], op: opName(t.op[i]),
      depth: t.depth[i] };
    // the program the frame runs: the build's create program (the
    // creating transaction's first frame), or its runtime program
    const create = t.input === build.create && t.frame[i] === 0;
    const program = frame.codeAddress !== run.address && !create
      ? undefined : create ? build.programs?.create
        : build.programs?.runtime;
    if (!program) return out;
    const byPc = byPcOf(program);
    // (the trace before i, in this frame: the previous trace step of
    // the same frame, or none at the frame's first)
    const prev = i > frame.first ? i - 1 : -1;
    const context = effectiveContextForStep({
      programContext: program.context,
      contextAtPc: (pc) => byPc.get(pc)?.context,
      trace: prev >= 0 ? [{ pc: t.pc[prev] }] : [],
      stepIndex: prev >= 0 ? 1 : 0,
    });
    if (!context) return out;
    const range = rangeOf(context as Ctx);
    return { ...out, context, ...(range ? { range } : {}) };
  };
}

// (one moment: an annotator of its own)
export const annotate = (run: Run, build: Build, ref: MomentRef |
  Moment): Moment => annotator(run, build)(ref);
