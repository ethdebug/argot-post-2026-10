// Makes fixtures/memory.json for the memory section: compiles
// bug/rename.bug with bugc, runs it on anvil, and saves memory at a few
// handpicked points of the trace, with the `variables` context bugc
// emitted for each point's instruction.
//
// The program replaces one name in an array of three strings with a
// longer one. `names` is an array in memory: its word holds the address
// of a length word and three element words, and each element word holds
// the address of a string (a length word, then the bytes). The replace
// writes the new string at free memory and puts its address in the
// element's word; the old string stays where it was.
//
// bugc must come from ethdebug/format main (PR #343 or later), which
// compiles writes to memory array elements.
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

const rel = "bug/rename.bug";
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
const listed = (st) => "names[1]" in st.flat;

// --------------------------------------------------------------- points

// The steps for the new string's literal, with the array listed: the
// first (nothing of the new string in memory yet) and the last (its
// length and bytes written); then the step that writes the element's
// word, the first where names[1] reads the new string
const NEW = '"grace hopper"';
const literal = steps.filter((st) => listed(st) && st.code === NEW);
const replaced = steps.find((st) => st.flat["names[1]"] === NEW);
if (!literal.length || !replaced) {
  throw new Error(`want the literal's steps and the replace; got ${
    literal.length}, ${!!replaced}`);
}
const points = [
  {
    id: "built",
    title: "Array built",
    note: 'names holds three strings; "grace hopper" is next',
    step: literal[0],
  },
  {
    id: "written",
    title: "New string written",
    note: '"grace hopper" is in memory; names[1] still holds "grace"',
    step: literal[literal.length - 1],
  },
  {
    id: "replaced",
    title: "Name replaced",
    note: "names[1] = \"grace hopper\" ran; \"grace\" stays in memory",
    step: replaced,
  },
];

// What the program computed
const names = { "names": "length 3", "names[0]": '"ada"',
  "names[2]": '"alan"' };
const expected = {
  built: { ...names, "names[1]": '"grace"' },
  written: { ...names, "names[1]": '"grace"' },
  replaced: { ...names, "names[1]": NEW },
};

const sorted = (o) => JSON.stringify(Object.fromEntries(
  Object.entries(o).sort(([a], [b]) => a.localeCompare(b))));
const saved = [];
for (const p of points) {
  const { index, context, flat } = p.step;
  if (sorted(flat) !== sorted(expected[p.id])) {
    throw new Error(`${p.id}: ${JSON.stringify(flat)}`);
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

// The element's word changed, and the old string's bytes did not
const region = (p, path) => p.step.locals.find((n) => n.path === path)
  .value.region;
const [A, B] = [points[0], points[2]];
const old = region(A, "names[1]");
if (region(B, "names[1]").offset === old.offset) {
  throw new Error("names[1] did not move");
}
const at = (p, r) => {
  const o = Number(r.offset) * 2 + 2;
  return saved.find((x) => x.id === p.id).memory
    .slice(o, o + Number(r.length) * 2);
};
if (at(B, old) !== at(A, old) || at(A, old) !== "6772616365") {
  throw new Error("the old string's bytes changed");
}

const data = {
  program: { name: "Rename", file: rel, source },
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
