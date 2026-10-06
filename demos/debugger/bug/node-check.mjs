// Quick check in Node: soldb (lean wasm) on the BUG transaction, fed as
// for Fe. Prints what soldb reports. Usage: node node-check.mjs [numeric]
// With "numeric", the source id "tally.bug" is rewritten to 0 first.
import fs from "fs";
import { initSync, Trace } from "../pkg-lean/soldb_wasm.js";
initSync({ module: fs.readFileSync(new URL("../pkg-lean/soldb_wasm_bg.wasm",
  import.meta.url)) });
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const numeric = process.argv[2] === "numeric";
const id = numeric ? 0 : "tally.bug";
let programText = rd("tally.program.json");
if (numeric) programText = programText.replaceAll('{"id":"tally.bug"}', "0")
  .replace(/"id": "tally\.bug"/g, '"id": 0');
const program = JSON.parse(programText);
const metadata = { compilation: { sources: [{ id, path: "tally.bug" }] } };
const trace = Trace.fromTransaction(rd("tx.debug-trace.json"),
  rd("tx.transaction.json"), rd("tx.receipt.json"));
trace.attachEthdebug(JSON.stringify({ name: "Tally", metadata, program,
  sources: numeric ? { 0: rd("tally.bug") } : {} }));
console.log(JSON.stringify(JSON.parse(trace.summary()).debugInfo));
const n = trace.stepCount();
let mapped = 0, fns = {}, vars = 0, depths = {}, sample = null;
for (let i = 0; i < n; i++) {
  const s = JSON.parse(trace.step(i));
  depths[s.depth] = (depths[s.depth] ?? 0) + 1;
  if (s.source) mapped++;
  const f = s.function?.name ?? "-";
  fns[f] = (fns[f] ?? 0) + 1;
  if (s.variables.length) { vars++; sample ??= [i, s.variables]; }
}
console.log({ n, mapped, fns, vars, depths });
console.log("first step with variables:", JSON.stringify(sample));
const shown = {};
for (let i = 0; i < n; i++) {
  for (const v of JSON.parse(trace.step(i)).variables) {
    const k = `${v.name} ${v.ty} ${v.location.kind}[${v.location.offset}] ` +
      v.value.status;
    shown[k] = (shown[k] ?? 0) + 1;
  }
}
console.log("variables as soldb reports them:", shown);
const s = JSON.parse(trace.step(300));
console.log("step 300:", JSON.stringify({ ...s, snapshot: undefined }));
