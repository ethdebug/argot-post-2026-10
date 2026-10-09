// The walkthrough's extensions (annotators): what a compiler's layout
// or a page's data add to the steps the fold makes from any pointer.
// The fold (fold.ts) walks every construct the pointer schema allows,
// in every location, in its own words; an annotator may name instances,
// say where an input comes from, offer a focus, stand a step on a row,
// word a step its own way (a layout's conventions: solc's strings, its
// packed fields), or add steps. Each hook is optional; the first
// annotator that answers one wins. Which annotators a walkthrough uses
// follows from its data: the compilation's language (ANNOTATORS), or
// the input's own list.
import type {
  Colour, Hex, Location, Path, ResolvedRegion, Snapshot, ValueNode,
} from "../types";
import type { Form, Rec, Step, Tok, WalkInput } from "./fold";

type Any = any;
// (where a step's facts come from: one form for every step)
export const COMPILER = "from: the compiler (ethdebug)";
export const READ = (l: Location) => `from: ${l} (a value read)`;
export const nWord = (n: number) => ["no", "one", "two", "three", "four",
  "five", "six", "seven", "eight"][n] ?? String(n);

// one place in the pointer, and its instances (the selection's entries)
export interface X { inst: string; s: Any; leaves: ValueNode[];
  regions: ResolvedRegion[] }
export interface Nd { k: string; kind: string; block: string;
  at: (string | number)[]; s: Any; by: Map<string, X>; line: number;
  seen: number; node: Any }
// (the pointer's declared base: its region, or its `slot`)
export interface Declared { context?: ResolvedRegion; region?: ResolvedRegion;
  slot?: Hex }

// What the fold knows, for the hooks: the input, the selection, its
// instances and focus, its colours, the nodes in order, the steps so
// far, and the fold's helpers
export interface Cx {
  x: WalkInput; snap?: Snapshot; path: Path; variable: string;
  node: ValueNode; varNode?: ValueNode; types: Record<string, Any>;
  pointers: Record<string, Any>; leaves: ValueNode[]; insts: string[];
  f: string; every: boolean; order: Nd[]; out: Step[];
  declared: Declared | null;
  M: ReadonlyMap<Path, Colour>;
  kOf(inst: string): Colour; srcOf(inst: string): Colour; kLeaf(y: X): Colour;
  who(inst: string): string; whoAt(inst: string): string;
  whoShort(inst: string): string; keyOf(inst: string): Hex | undefined;
  // (a path with its keys by name: players["alice"].score)
  pathName(p: string): string;
  // (a key as a value: 0x7099…79c8 ("alice"); `named` false: the key)
  keyText(inst: string, named?: boolean): string;
  // (a template's inputs for an instance, by the template's type kind)
  inputs: Map<string, Record<string, { hex: Hex }>>;
  kindOf(n?: ValueNode): string | undefined; tn(id: string): string;
  getAt(block: string, at: (string | number)[]): Any;
  opOf(e: Any): string | null;
  reads(block: string, name: string): boolean;
  entryPath(p: string): string | undefined; instOf(l: { path: string }): string;
  inTarget(q: string): boolean;
  w32(h: Hex | bigint): Hex; wordAt(h: Hex | bigint): Hex | undefined;
  tail(h: Hex | bigint): string; small(h: Hex | bigint): string;
  step(s: Partial<Step> & Pick<Step, "id" | "phase">): Step;
  text(...toks: Tok[]): Form;
  table(rows: [Tok[], Tok[], Colour][]): Form;
  strip(fields: Extract<Form, { kind: "strip" }>["fields"]): Form;
  pos(block: string, at: (string | number)[]): string;
  exact(block: string, at: (string | number)[]): string;
  defineBand(nd: Nd): string[]; instRows(nd: Nd): string[];
  regionsOf(nd: Nd): ResolvedRegion[];
}

export interface Annotator {
  id: string;
  // an instance's name, as people know it (on-chain names: "alice")
  name?(cx: Cx, inst: string): string | undefined;
  // steps before the pointer's: where its inputs come from (the key's
  // origin: a mapping's keys, from the contract's own list of them)
  inputs?(cx: Cx): void;
  // the instances the reader can focus, one at a time (per key)
  focus?(cx: Cx): Rec[] | null;
  // the rows a template's step stands on (its anchors: the slot it is
  // given)
  anchors?(cx: Cx, nd: Nd, xs: X[]): Hex[];
  // a step's words, the layout's own (null: the fold's)
  declared?(cx: Cx, d: Declared): Partial<Step> | null;
  handoff?(cx: Cx, nd: Nd, xs: X[], into: Any): Partial<Step> | null;
  read?(cx: Cx, nd: Nd, xs: X[]): Partial<Step> | null;
  // a value's own region: true when it made (or joined) the step itself
  // (inline value renderers: the packed fields' byte strip)
  value?(cx: Cx, nd: Nd, xs: X[], folded: Nd[], band: string[]): boolean;
  branch?(cx: Cx, st: Step, nd: Nd, xs: X[]): Partial<Step> | null;
  // the first and last steps' captions, another rule's reading
  goal?(cx: Cx, o: { when: string; up: (t: string) => string; n: number;
    noun: string }): string | null;
  found?(cx: Cx, o: { parts: string }): string | null;
  // after the pointer's steps: the words it kept for later
  finish?(cx: Cx): void;
  // after found: steps of its own (another compiler's reading)
  extra?(cx: Cx): void;
  // the labels' names for keys ("0x7099…79c8" → "alice")
  names?(cx: Cx): Map<string, string>;
}
