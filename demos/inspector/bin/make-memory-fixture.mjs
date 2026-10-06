// Makes fixtures/memory.json for the memory section: compiles
// bug/longest.bug with bugc, runs it on anvil, and saves memory at a few
// handpicked points of the trace, with the `variables` context bugc
// emitted for each point's instruction.
//
// The program finds the longest name in an array of three strings.
// `names` is an array in memory: its word holds the address of a length
// word and three element words, and each element word holds the address
// of a string (a length word, then the bytes). `longest` is a string
// local: its word holds the address of one of those strings.
//
// bugc must come from ethdebug/format main (PR #328 or later), which
// emits pointers for local variables.
//
// Needs anvil with steps tracing on RPC (default http://127.0.0.1:8547):
//   anvil --port 8547 --steps-tracing
// Usage: BUGC=<checkout>/packages/bugc node bin/make-memory-fixture.mjs
// (OPT=<0-3> sets bugc's optimization level; default 0)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decodeLocals } from "../decode.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8547";
const BUGC = process.env.BUGC;
const OPT = process.env.OPT ?? "0";
if (!BUGC) throw new Error("set BUGC to a built packages/bugc from main");

const rpc = async (method, params = []) => {
  const res = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const body = await res.json();
  if (body.error) throw new Error(`${method}: ${body.error.message}`);
  return body.result;
};

// ------------------------------------------------------------ compile

const rel = "bug/longest.bug";
const file = path.join(root, rel);
const source = fs.readFileSync(file, "utf8");
// bugc names the source by its full path; keep the relative one
const out = JSON.parse(execFileSync("node",
  [path.join(BUGC, "dist", "bin", "bugc.js"), "-O", OPT, "-f", "json",
    file], { encoding: "utf8" }).split(JSON.stringify(file).slice(1, -1))
  .join(rel));
const git = (...a) =>
  execFileSync("git", ["-C", BUGC, ...a], { encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");

// Instructions by byte offset. bugc lists instructions in order; each
// takes one byte plus its immediates.
const byPc = new Map();
{
  let pc = 0;
  for (const ins of out.runtime.instructions) {
    byPc.set(pc, ins);
    pc += 1 + (ins.immediates?.length ?? 0);
  }
}

// -------------------------------------------------------------- run it

const [from] = await rpc("eth_accounts");
async function send(tx) {
  const hash = await rpc("eth_sendTransaction",
    [{ from, gas: "0x2dc6c0", ...tx }]);
  for (let i = 0; i < 50; i++) {
    const r = await rpc("eth_getTransactionReceipt", [hash]);
    if (r) {
      if (r.status !== "0x1") throw new Error(`tx ${hash} failed`);
      return { hash, receipt: r };
    }
    await new Promise((x) => setTimeout(x, 100));
  }
  throw new Error(`no receipt for ${hash}`);
}
const { receipt } = await send({ data: out.create.bytecode });
const address = receipt.contractAddress;
const tx = await send({ to: address });
const trace = await rpc("debug_traceTransaction",
  [tx.hash, { enableMemory: true }]);
const logs = trace.structLogs;
if (!logs.length) throw new Error("empty trace: run anvil --steps-tracing");

// A context describes the state after its instruction runs, so each
// point shows memory after its step: the memory of the next step.
const memoryAfter = (index) =>
  "0x" + (logs[index + 1].memory ?? []).map((w) =>
    w.replace(/^0x/, "")).join("");

// Each step with its instruction's context and the values the library
// reads for its locals (path -> value text)
const text = (context) => {
  const r = context.code?.range;
  return r ? source.slice(r.offset, r.offset + r.length) : "";
};
const nodes = (ns) => ns.flatMap((n) => [n, ...nodes(n.children ?? [])]);
const steps = [];
for (let index = 0; index < logs.length - 1; index++) {
  const context = byPc.get(logs[index].pc)?.debug?.context ?? {};
  const locals = nodes(await decodeLocals(context.variables ?? [],
    memoryAfter(index)));
  const flat = Object.fromEntries(locals.map((n) => [n.path,
    n.value.text]));
  steps.push({ index, context, flat, locals, code: text(context) });
}
const all = (st) => ["names", "longest", "i"].every((n) => n in st.flat);

// --------------------------------------------------------------- points

// The loop test `i < names.length`: the last step of each run of steps
// for it (the comparison), with all three locals listed
const tests = steps.filter((st, k) => all(st) &&
  st.code === "i < names.length" &&
  steps[k + 1]?.code !== "i < names.length");
const found = steps.find((st) => all(st) && st.flat.longest === '"grace"');
if (tests.length !== 3 || !found) {
  throw new Error(`want 3 loop tests and longest = grace; got ${
    tests.length}, ${!!found}`);
}
const points = [
  {
    id: "start",
    title: "Loop starts",
    note: "i < names.length, with i = 1; longest is names[0]",
    step: tests[0],
  },
  {
    id: "found",
    title: "Longer name found",
    note: "longest = names[i] ran, with i = 1",
    step: found,
  },
  {
    id: "done",
    title: "Loop done",
    note: "i < names.length, with i = 3: false, so the loop ends",
    step: tests[2],
  },
];

// What the program computed, and which string longest shares
const names = { "names": "length 3", "names[0]": '"ada"',
  "names[1]": '"grace"', "names[2]": '"alan"' };
const expected = {
  start: { ...names, longest: '"ada"', i: "1", same: "names[0]" },
  found: { ...names, longest: '"grace"', i: "1", same: "names[1]" },
  done: { ...names, longest: '"grace"', i: "3", same: "names[1]" },
};

const sorted = (o) => JSON.stringify(Object.fromEntries(
  Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
const saved = [];
for (const p of points) {
  const { index, context, flat, locals } = p.step;
  const { same, ...want } = expected[p.id];
  if (sorted(flat) !== sorted(want)) {
    throw new Error(`${p.id}: ${JSON.stringify(flat)}`);
  }
  // longest's bytes are the element's bytes: no string was copied
  const region = (path) => {
    const { offset, length } = locals.find((n) => n.path === path)
      .value.region;
    return `${offset} ${length}`;
  };
  if (region("longest") !== region(same)) {
    throw new Error(`${p.id}: longest is not at ${same}`);
  }
  const s = logs[index];
  const memory = memoryAfter(index);
  saved.push({
    id: p.id, title: p.title, note: p.note,
    step: index, pc: s.pc, op: s.op, depth: s.depth,
    range: context.code?.range,
    variables: context.variables ?? [],
    memory,
  });
  console.log(p.id, `step ${index}`, `pc ${s.pc} ${s.op}`,
    `${(memory.length - 2) / 2} bytes of memory`,
    Object.entries(flat).map(([k, v]) => `${k}=${v}`).join(" "));
}

const data = {
  program: { name: "Longest", file: rel, source },
  compiler: { name: "bugc", branch: "main", commit,
    optimize: Number(OPT) },
  tx: { hash: tx.hash, from, to: address,
    block: Number(tx.receipt.blockNumber) },
  trace: { steps: logs.length },
  points: saved,
};
fs.writeFileSync(path.join(root, "fixtures", "memory.json"),
  JSON.stringify(data));
console.log("bugc", commit.slice(0, 9), `-O ${OPT}`,
  `${logs.length} steps`);
