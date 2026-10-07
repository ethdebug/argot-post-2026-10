// Quick check in Node: soldb (lean wasm) on the Fe transaction.
import fs from "fs";
import { initSync, Trace } from "../pkg-lean/soldb_wasm.js";
initSync({ module: fs.readFileSync(new URL("../pkg-lean/soldb_wasm_bg.wasm",
  import.meta.url)) });
const rd = (p) => fs.readFileSync(new URL(p, import.meta.url), "utf8");
const fe = JSON.parse(rd("scores.ethdebug.json"));
// Each source's text: the user file, or a std-library copy (src/).
const STD = { "builtin-core:/src/": "src/core/", "builtin-std:/src/": "src/std/" };
const files = Object.fromEntries(fe.compilation.sources.map((s) => {
  const pre = Object.keys(STD).find((p) => s.uri.startsWith(p));
  return [s.id, pre ? STD[pre] + s.uri.slice(pre.length) : "scores.fe"];
}));
const trace = Trace.fromTransaction(rd("tx.debug-trace.json"),
  rd("tx.transaction.json"), rd("tx.receipt.json"));
const program = fe.programs.find((p) => p.environment === "call");
const sources = Object.fromEntries(Object.entries(files)
  .map(([id, f]) => [id, rd(f)]));
trace.attachEthdebug(JSON.stringify({ name: "Scores", metadata: fe, program,
  sources }));
console.log(JSON.stringify(JSON.parse(trace.summary()).debugInfo));
const n = trace.stepCount();
let last = "", mapped = 0, fns = 0, vars = 0;
const ids = {};
for (let i = 0; i < n; i++) {
  const s = JSON.parse(trace.step(i));
  if (s.function) fns++;
  if (s.variables.length) vars++;
  if (!s.source) continue;
  mapped++;
  ids[s.source.source_id] = (ids[s.source.source_id] ?? 0) + 1;
  const key = `${s.source.source_id}:${s.source.line}`;
  if (s.source.source_id === 0 && key !== last) {
    const t = Buffer.from(sources[0]).subarray(s.source.offset,
      s.source.offset + s.source.length).toString();
    console.log(`${i} pc=${s.pc} ${s.op} ${s.source.path.split("/").pop()}:` +
      `${s.source.line}:${s.source.column} [${t.replace(/\n/g, "\\n")
        .slice(0, 60)}]`);
  }
  last = key;
}
console.log({ n, mapped, fns, vars, ids });
const multi = {};
for (let i = 0; i < n; i++) {
  const s = JSON.parse(trace.step(i)).source;
  if (!s) continue;
  const t = Buffer.from(sources[s.source_id]).subarray(s.offset,
    s.offset + s.length).toString();
  if (t.includes("\n")) multi[`${s.source_id}:${s.offset}:${s.length}`] ??=
    [i, t.slice(0, 120)];
}
console.log("multi-line spans", multi);
