// A moment's annotations from its run and build (addendum §1.4): the
// instruction's pc, op and depth at the trace step, and the context
// that holds there with its source range. Contexts are postconditions:
// at trace step i, instruction i - 1's context holds; at 0, the
// program's (@ethdebug/programs-react's rule, as the debugger demo).
import {
  effectiveContextForStep,
} from "@ethdebug/programs-react/dist/src/utils/effectiveContext.js";
import {
  buildCallStack, extractVariablesFromInstruction,
} from "@ethdebug/programs-react/dist/src/utils/mockTrace.js";
import type { SourceRange } from "../types";
import type { Local } from "../types";
import type {
  Build, Call, Format, Moment, MomentRef, Run,
} from "./types";
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

type CallCtx = Ctx & { invoke?: { identifier?: string };
  transform?: string[]; gather?: CallCtx[]; pick?: CallCtx[] };
// a context's code ranges, each marked when it sits in an inlined body
// (transform "inline"); and its invoke marks (demos/debugger/
// ref-worker.js codes, invokes)
function codes(ctx: CallCtx | undefined, inline = false,
  out: (SourceRange & { inline: boolean })[] = []) {
  if (!ctx) return out;
  const here = inline || (ctx.transform ?? []).includes("inline");
  if (ctx.code?.range && ctx.code.source) {
    out.push({ source: String(ctx.code.source.id), ...ctx.code.range,
      inline: here });
  }
  for (const c of [...ctx.gather ?? [], ...ctx.pick ?? []]) {
    codes(c, false, out);
  }
  return out;
}
function invokes(ctx: CallCtx | undefined, out: string[] = []): string[] {
  if (!ctx) return out;
  if (ctx.invoke?.identifier) out.push(ctx.invoke.identifier);
  for (const c of [...ctx.gather ?? [], ...ctx.pick ?? []]) invokes(c, out);
  return out;
}

// The call stack at trace step i of a frame, outermost first, from the
// program's invoke and return marks (programs-react's buildCallStack:
// postconditions; a real call's invoke on its JUMP and JUMPDEST, one
// frame; an inlined one's, marked; an inline mark with no invoke, none);
// each frame's call site, the unmarked range of the instruction that
// carries its invoke, just before it opens (ref-worker.js siteOf)
function callsAt(trace: { pc: number }[], byPc: Map<number,
  Format.Program.Instruction>, i: number, program: Format.Program): Call[] {
  const frames = buildCallStack(trace as never, byPc, i,
    program.context) as { identifier?: string; stepIndex: number;
    isInline?: boolean }[];
  return frames.map((f) => {
    let site: SourceRange | undefined;
    for (let j = f.stepIndex - 1; j >= Math.max(0, f.stepIndex - 4) &&
      !site; j--) {
      const ctx = byPc.get(trace[j].pc)?.context as CallCtx | undefined;
      if (f.identifier && invokes(ctx).includes(f.identifier)) {
        const c = codes(ctx).find((x) => !x.inline);
        if (c) site = { source: c.source, offset: c.offset,
          length: c.length };
      }
    }
    return { name: f.identifier ?? "?", ...f.isInline ? { inline: true }
      : {}, ...site ? { site } : {} } as Call;
  });
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
  // (each frame's trace, its own steps, by transaction and frame)
  const traces = new Map<string, { pc: number }[]>();
  const traceOf = (tx: number, f: number) => {
    const k = `${tx}:${f}`;
    if (!traces.has(k)) {
      const t = run.txs[tx];
      const out: { pc: number }[] = [];
      for (let j = t.frames[f].first; j <= t.frames[f].last; j++) {
        if (t.frame[j] === f) out.push({ pc: t.pc[j] });
      }
      traces.set(k, out);
    }
    return traces.get(k)!;
  };
  return (ref) => {
    const t = run.txs[ref.tx];
    if (!t) throw new Error(`no transaction ${ref.tx}`);
    const { pc: _p, op: _o, depth: _d, range: _r, context: _c, calls: _k,
      ...m } = ref as Moment;
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
    // (the call stack there: the frame's trace to this step)
    const trace = traceOf(ref.tx, t.frame[i]);
    let k = 0;
    for (let j = frame.first; j < i; j++) if (t.frame[j] === t.frame[i]) k++;
    const calls = callsAt(trace, byPc, k, program);
    return { ...out, context, ...(range ? { range } : {}),
      ...calls.length ? { calls } : {} };
  };
}

// (one moment: an annotator of its own)
export const annotate = (run: Run, build: Build, ref: MomentRef |
  Moment): Moment => annotator(run, build)(ref);
