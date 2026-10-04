import { readFileSync as read } from "fs";
const [programFile, traceFile, sourceFile] = process.argv.slice(2);
const json = (f) => JSON.parse(read(f, "utf8"));
const source = read(sourceFile, "utf8");
const trace = json(traceFile).structLogs;

// Input step. solc: the file is the program. Fe's file wraps programs
// differently today: pick its "call" program.
let program = json(programFile);
if (program.programs) program = program.programs.find((p) => p.environment === "call");

// Core: pc -> source range, then print each new source line.
const range = new Map(program.instructions.map((i) => [i.offset, i.context?.code]));
let last;
for (const { pc } of trace) {
  const code = range.get(pc);
  if (code?.source.id !== 0) continue; // not in this file (Fe: std library)
  if (code.range.length > source.length * 0.8) continue; // compiler glue
  const line = source.slice(0, code.range.offset).split("\n").length;
  if (line !== last) console.log(line + ": " + source.split("\n")[line - 1].trim());
  last = line;
}
