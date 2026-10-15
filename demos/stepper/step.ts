// Print the source lines a transaction ran, from an ethdebug program
// and an anvil debug_traceTransaction struct log.
//   node step.ts <program.json> <trace.json> <source-file>
import { readFileSync } from "node:fs";

type Code = {
  source: { id: number };
  range: { offset: number; length: number };
};
type Instruction = { offset: number; context?: { code?: Code } };
type Program = { environment: string; instructions: Instruction[] };
type Trace = { structLogs: { pc: number }[] };

const [programFile, traceFile, sourceFile] = process.argv.slice(2);
const read = (file: string) => readFileSync(file, "utf8");
const file: Program | { programs: Program[] } = JSON.parse(read(programFile));
const trace: Trace = JSON.parse(read(traceFile));
const source = read(sourceFile);
const lines = source.split("\n");

// solc's file is the program. Fe's file wraps its programs: pick "call".
const { instructions } = "programs" in file
  ? file.programs.find((p) => p.environment === "call")!
  : file;

// Core: pc -> source range, then print each new source line.
const range = new Map(instructions.map((i) => [i.offset, i.context?.code]));
let last;
for (const { pc } of trace.structLogs) {
  const code = range.get(pc);
  if (code?.source.id !== 0) continue; // not in this file (Fe: std library)
  if (code.range.length > source.length * 0.8) continue; // compiler glue
  const line = source.slice(0, code.range.offset).split("\n").length;
  if (line !== last) console.log(line + ": " + lines[line - 1].trim());
  last = line;
}
