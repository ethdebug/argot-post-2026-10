// Makes fixtures/raw.json: one frozen moment of Arcade's story, for the
// raw lens (bytes with no names): inside carol's
// join("carol, the unstoppable combo queen"), while her name is being
// written to storage. Compiled as for the storage fixtures
// (bin/make-fixtures.mjs: Walnut's solc, viaIR, optimizer off,
// ethdebug), deployed on a fresh anvil; the story up to her join:
// deploy (the 50-byte motd), alice joins, bob joins, carol joins.
//
// The moment: the step just after the first SSTORE of her name's text
// (the name is 34 bytes, so its text takes two words, at
// keccak256(her name's slot) + 0 and + 1), before the second. The
// state there is the machine's as the node reports it for that step
// (debug_traceTransaction's structLogs: before the step's instruction
// runs): its stack and memory; the call's calldata; and the contract's
// whole storage then: every slot the deployment and the joins before
// wrote, as it was before her join, with her join's SSTOREs before the
// step applied.
//
// Needs anvil with steps tracing on RPC (default http://127.0.0.1:8556),
// `cast`, and the solc binary at SOLC (as make-fixtures.mjs).
//   anvil --port 8556 --steps-tracing --silent
// Usage: SOLC=<solc> node bin/make-raw-fixture.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8556";
const SOLC = process.env.SOLC ?? "solc";

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
const cast = (...a) => execFileSync("cast", a, { encoding: "utf8" }).trim();
const hex = (n) => "0x" + n.toString(16);
const hex32 = (h) => "0x" + BigInt(h).toString(16).padStart(64, "0");
const keccak = (...words) =>
  cast("keccak", "0x" + words.map((w) => hex32(w).slice(2)).join(""));

// ------------------------------------------------------------ compile

const file = "Arcade.sol";
const source = fs.readFileSync(path.join(root, "contracts", file), "utf8");
const solcVersion = execFileSync(SOLC, ["--version"], { encoding: "utf8" })
  .match(/Version: (\S+)/)[1];
const out = JSON.parse(execFileSync(SOLC, ["--standard-json"], {
  input: JSON.stringify({
    language: "Solidity",
    sources: { [file]: { content: source } },
    settings: { viaIR: true, optimizer: { enabled: false },
      experimental: true, debug: { debugInfo: ["ethdebug", "ast-id"] },
      outputSelection: { "*": { "*": ["evm.bytecode.object",
        "evm.deployedBytecode.ethdebug", "ethdebug.resources",
        "ethdebug.compilation"] } } },
  }), encoding: "utf8", maxBuffer: 1 << 28 }));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
const c = out.contracts[file].Arcade;
const program = c.evm.deployedBytecode.ethdebug;
// an instruction's source range, from its context (code, or the first
// in a gather or pick)
const rangeOf = (ctx) => {
  if (!ctx) return undefined;
  if (ctx.code?.range) return ctx.code.range;
  for (const x of [...(ctx.gather ?? []), ...(ctx.pick ?? [])]) {
    const r = rangeOf(x);
    if (r) return r;
  }
  return undefined;
};
const byPc = new Map(program.instructions.map((i) => [i.offset, i]));
// a byte offset's line (the source has multi-byte characters)
const bytes = Buffer.from(source, "utf8");
const lineOf = (offset) =>
  bytes.subarray(0, offset).toString("utf8").split("\n").length;

// -------------------------------------------------------------- chain

const [DEPLOYER, ALICE, BOB, CAROL] = await rpc("eth_accounts");
const NAMES = [[ALICE, "alice"], [BOB, "bob"],
  [CAROL, "carol, the unstoppable combo queen"]];
const MOTD = "season 2 starts friday, see you on the leaderboard";

async function send(tx) {
  const hash = await rpc("eth_sendTransaction",
    [{ from: DEPLOYER, gas: hex(10000000n), ...tx }]);
  let receipt;
  for (let i = 0; i < 50 && !receipt; i++) {
    receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (!receipt) await new Promise((r) => setTimeout(r, 100));
  }
  if (receipt?.status !== "0x1") throw new Error(`tx ${hash} failed`);
  return { hash, receipt };
}
const trace = async (h) => (await rpc("debug_traceTransaction",
  [h, { enableMemory: true }])).structLogs;
const sstores = (logs) => logs.filter((l) => l.op === "SSTORE")
  .map((l) => [hex32(l.stack.at(-1)), hex32(l.stack.at(-2))]);

const deploy = await send({ data: "0x" + c.evm.bytecode.object +
  cast("abi-encode", "f(string)", MOTD).slice(2) });
const address = deploy.receipt.contractAddress;
const txs = [deploy];
for (const [who, name] of NAMES) {
  txs.push(await send({ from: who, to: address,
    data: cast("calldata", "join(string)", name) }));
}
const join = txs.at(-1);
const block = Number(join.receipt.blockNumber);

// every slot written before her join, as it was then
const storage = new Map();
for (const tx of txs.slice(0, -1)) {
  for (const [slot] of sstores(await trace(tx.hash))) storage.set(slot, 0);
}
for (const slot of storage.keys()) {
  storage.set(slot, hex32(await rpc("eth_getStorageAt",
    [address, slot, hex(block - 1)])));
}

// her name's slot and its text's two words
const nameSlot = hex32(BigInt(keccak(CAROL, 3)) + 1n);
const text = [0n, 1n].map((k) => hex32(BigInt(keccak(nameSlot)) + k));
const logs = await trace(join.hash);
const firstText = logs.findIndex((l) => l.op === "SSTORE" &&
  hex32(l.stack.at(-1)) === text[0]);
const secondText = logs.findIndex((l) => l.op === "SSTORE" &&
  hex32(l.stack.at(-1)) === text[1]);
if (firstText < 0 || secondText < firstText) {
  throw new Error(`her name's SSTOREs: ${firstText}, ${secondText}`);
}
// the moment: the step after the first text word's SSTORE
const at = firstText + 1;
for (const l of logs.slice(0, at)) {
  if (l.op === "SSTORE") storage.set(hex32(l.stack.at(-1)),
    hex32(l.stack.at(-2)));
}
const s = logs[at];
const ins = byPc.get(s.pc);
const range = rangeOf(ins?.context);
const t = await rpc("eth_getTransactionByHash", [join.hash]);
const sorted = [...storage].sort(([a], [b]) => BigInt(a) < BigInt(b) ? -1
  : 1).filter(([, v]) => BigInt(v) !== 0n);
const data = {
  id: "raw",
  summary: "inside carol's join, between the two SSTOREs of her name's text",
  contract: { name: "Arcade", file, compiler: solcVersion, address },
  tx: { hash: join.hash, from: t.from, to: t.to, input: t.input, block },
  step: { index: at, of: logs.length, pc: s.pc, op: s.op, depth: s.depth,
    ...(range ? { range, line: lineOf(range.offset),
      text: bytes.subarray(range.offset, range.offset + range.length)
        .toString("utf8") } : {}) },
  why: "the step after the first SSTORE of her name's text (step " +
    `${firstText}, slot keccak256(name slot) + 0), before the second ` +
    `(step ${secondText}, + 1): her name is half in storage`,
  // (top of the stack last, as the node gives it)
  stack: s.stack.map(hex32),
  memory: "0x" + (s.memory ?? []).map((w) => w.replace(/^0x/, "")).join(""),
  calldata: t.input,
  storage: Object.fromEntries(sorted),
};
fs.writeFileSync(path.join(root, "fixtures", "raw.json"),
  JSON.stringify(data, null, 1) + "\n");
console.log("raw", join.hash, `step ${at}/${logs.length}`, `pc ${s.pc}`,
  s.op, range ? `line ${data.step.line}: ${data.step.text}` : "(no range)",
  `${sorted.length} slots, ${s.stack.length} stack items, ${
    (data.memory.length - 2) / 2} memory bytes`);
