// Makes fixtures/memory.json for the memory section: compiles
// bug/gcd.bug with bugc, runs it on anvil, and saves memory at a few
// handpicked points of the trace, with the `variables` context bugc
// emitted for each point's instruction.
//
// The program is Euclid's GCD, recursive: gcd(1071, 462) calls
// gcd(462, 147), gcd(147, 21) and gcd(21, 0), and stores 21. Each call
// has its own frame in memory, and a and b of each call are at fixed
// offsets from the frame pointer at 0x80. Each frame keeps the caller's
// frame pointer in its first word.
//
// bugc must come from ethdebug/format PR #270 (branch
// ui-local-value-reduce): bugc on main emits no memory pointers.
//
// Needs anvil on RPC (default http://127.0.0.1:8547).
// Usage: BUGC=<checkout>/packages/bugc node bin/make-memory-fixture.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decodeLocals } from "../decode.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8547";
const BUGC = process.env.BUGC;
if (!BUGC) throw new Error("set BUGC to a built packages/bugc of PR #270");

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

const file = path.join(root, "bug", "gcd.bug");
const source = fs.readFileSync(file, "utf8");
const out = JSON.parse(execFileSync("node",
  [path.join(BUGC, "dist", "bin", "bugc.js"), "-f", "json", file],
  { encoding: "utf8" }));
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

// Each step with its instruction's context
const steps = logs.map((s, index) => {
  const context = byPc.get(s.pc)?.debug?.context ?? {};
  const inMemory = new Set((context.variables ?? [])
    .filter((v) => JSON.stringify(v.pointer ?? {}).includes('"memory"'))
    .map((v) => v.identifier));
  return { index, s, context, inMemory, invoke: !!context.invoke };
});
const has = (st, ...names) => names.every((n) => st.inMemory.has(n));

// --------------------------------------------------------------- points
// A context describes the state after its instruction runs, so each
// point shows memory after its step: the memory of the next step.

// The last step of the run of steps that starts at `first` and keeps the
// same variables
const runEnd = (first) => {
  let k = first;
  const key = (st) => [...st.inMemory].join();
  while (steps[k + 1] && key(steps[k + 1]) === key(steps[first])) k++;
  return steps[k];
};
const text = (st) => {
  const r = st.context.code?.range;
  return r ? source.slice(r.offset, r.offset + r.length) : "";
};
// Each call tests b == 0 once; the first test is in the first call, the
// last in the deepest call
const tests = steps.filter((st) => st.s.op === "EQ" && text(st) === "b == 0" &&
  has(st, "a", "b"));
// Steps just after a return: from gcd(21, 0) back into gcd(147, 21), then
// into gcd(462, 147), into gcd(1071, 462), and into the main code
const returns = steps.filter((st) => st.context.return);
const sstore = steps.find((st) => st.s.op === "SSTORE");
if (tests.length !== 4 || returns.length !== 4 || !sstore) {
  throw new Error(`want 4 calls, 4 returns and a store; got ${
    tests.length}, ${returns.length}, ${!!sstore}`);
}
// Point ids are the ones the page knows (mem.js picks "before" for A and
// "loop" for B at first); the titles say what each point is.
const points = [
  {
    id: "before",
    title: "First call: gcd(1071, 462)",
    note: "at b == 0; one frame, at 0x0100",
    step: tests[0],
  },
  {
    id: "loop",
    title: "Deepest call: gcd(21, 0)",
    note: "at b == 0, which is true; four frames, the last at 0x0340",
    step: tests[3],
  },
  {
    id: "inside",
    title: "Unwinding: back in gcd(462, 147)",
    note: "gcd(147, 21) returned 21; the frame pointer is 0x01c0 again",
    step: runEnd(returns[1].index + 1),
  },
  {
    id: "after",
    title: "Result stored: 21",
    note: "result = 21 in storage slot 0; no value is in memory now",
    step: sstore,
  },
];

const memoryAfter = (st) =>
  "0x" + (logs[st.index + 1].memory ?? []).map((w) =>
    w.replace(/^0x/, "")).join("");
const wordAt = (memory, at) =>
  BigInt("0x" + memory.slice(2 + at * 2, 2 + (at + 32) * 2));

// Values, and where the library finds them: [value, word]
const expected = {
  before: { a: ["1071", "0x0160"], b: ["462", "0x0180"] },
  loop: { a: ["21", "0x03a0"], b: ["0", "0x03c0"] },
  inside: { a: ["462", "0x0220"], b: ["147", "0x0240"] },
  after: {},
};
// The frame pointer at 0x80, then the chain of saved frame pointers: the
// first word of each frame holds the caller's frame pointer (0 for the
// main code)
const chains = {
  before: [0x100, 0],
  loop: [0x340, 0x280, 0x1c0, 0x100, 0],
  inside: [0x1c0, 0x100, 0],
  after: [0],
};
const slot0 = {
  before: await rpc("eth_getStorageAt",
    [address, "0x0", "0x" + (BigInt(tx.receipt.blockNumber) - 1n)
      .toString(16)]),
  after: await rpc("eth_getStorageAt",
    [address, "0x0", tx.receipt.blockNumber]),
};
if (BigInt(slot0.after) !== 21n) throw new Error(`result is ${slot0.after}`);

const saved = [];
for (const p of points) {
  const { index, s, context } = p.step;
  const memory = memoryAfter(p.step);
  const variables = context.variables ?? [];
  // check: the library reads what the program computed
  const values = await decodeLocals(variables, memory);
  const want = expected[p.id];
  if (values.length !== Object.keys(want).length) {
    throw new Error(`${p.id}: ${values.map((v) => v.name)} in memory`);
  }
  for (const [name, [text, at]] of Object.entries(want)) {
    const v = values.find((x) => x.name === name);
    const got = `${v?.text} at ${v?.region.offset}`;
    if (got !== `${text} at ${at}`) {
      throw new Error(`${p.id}: ${name} is ${got}, want ${text} at ${at}`);
    }
  }
  const chain = [Number(wordAt(memory, 0x80))];
  while (chain.at(-1) !== 0) chain.push(Number(wordAt(memory, chain.at(-1))));
  if (chain.join() !== chains[p.id].join()) {
    throw new Error(`${p.id}: frame pointers ${chain}, want ${chains[p.id]}`);
  }
  // storage slot 0 (result), as it is after the step
  const storage = { "0x0": index >= sstore.index ? slot0.after : slot0.before };
  saved.push({
    id: p.id, title: p.title, note: p.note,
    step: index, pc: s.pc, op: s.op, depth: s.depth,
    range: context.code?.range,
    variables,
    memory,
    storage,
  });
  console.log(p.id, `step ${index}`, `pc ${s.pc} ${s.op}`,
    `${(memory.length - 2) / 2} bytes of memory`,
    values.map((v) => `${v.name}=${v.text}`).join(" "),
    `frames ${chain.map((n) => n.toString(16)).join(" -> ")}`,
    `result=${BigInt(storage["0x0"])}`);
}

const data = {
  program: { name: "Gcd", file: "bug/gcd.bug", source },
  compiler: { name: "bugc", pr: 270, branch: "ui-local-value-reduce",
    commit },
  tx: { hash: tx.hash, from, to: address,
    block: Number(tx.receipt.blockNumber) },
  trace: { steps: logs.length },
  points: saved,
};
fs.writeFileSync(path.join(root, "fixtures", "memory.json"),
  JSON.stringify(data));
console.log("bugc", commit.slice(0, 9), `${logs.length} steps`);
