// Setup for every tab: deploy each build of the contract on anvil, send
// the same calls to each (scores-txs.json: setup calls, then the traced
// transaction), and save what the tabs load for the traced one.
// Run by make-scores.sh, after the compilers.
//   sol/   solc (ethdebug, optimizer off): tx hash and address, for
//          soldb's saved trace (make-scores.sh)
//   old/   solc (--via-ir --optimize): record.trace.json, and
//          history.trace.json, the plan's view call after the
//          transaction (debug_traceCall); only pc, op and depth of each
//          step
//   fe/    Fe: the node's three responses (soldb's Trace.fromTransaction)
//   bug/scores-O0, bug/scores-O2: the node's responses, each step's
//          memory, and the storage the pointers read, as it was before
// BUG has no selectors; its code block reads its arguments from
// msg.data, so it gets the same calldata as the others.
// The node: PORT (default 8556) on localhost.
// Usage: node make-scores-txs.mjs > txs.json
import fs from "fs";
import { execFileSync } from "child_process";

const NODE = `http://127.0.0.1:${process.env.PORT ?? 8556}`;
const rpc = async (method, params = []) => {
  const r = await (await fetch(NODE, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })).json();
  if (r.error) throw new Error(method + ": " + JSON.stringify(r.error));
  return r.result;
};
const accounts = await rpc("eth_accounts");
const send = async (to, data, from = accounts[0]) => {
  const h = await rpc("eth_sendTransaction",
    [{ from, to, data, gas: "0x1000000" }]);
  let rc = null;
  while (!rc) {
    rc = await rpc("eth_getTransactionReceipt", [h]);
    if (!rc) await new Promise((r) => setTimeout(r, 50));
  }
  if (rc.status !== "0x1") throw new Error(`${h} failed`);
  return [h, rc];
};
const plan = JSON.parse(fs.readFileSync("scores-txs.json", "utf8"));
const calldata = (c) => execFileSync("cast",
  ["calldata", c.call, ...c.args]).toString().trim();

const hex = (f) => fs.readFileSync(f, "utf8").trim().replace(/^0x/, "");
const targets = {
  sol: { create: hex("sol/ethdebug/Scores.bin") },
  old: { create: JSON.parse(fs.readFileSync("old/combined.json", "utf8"))
    .contracts["Scores.sol:Scores"].bin },
  fe: { create: hex("fe/out/Scores.bin"),
    runtime: hex("fe/out/Scores.runtime.bin") },
  "bug/scores-O0": { create: hex("bug/scores-O0/out/Scores.bin"),
    runtime: hex("bug/scores-O0/out/Scores.runtime.bin") },
  "bug/scores-O2": { create: hex("bug/scores-O2/out/Scores.bin"),
    runtime: hex("bug/scores-O2/out/Scores.runtime.bin") },
};
const out = {};
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v));
// Only pc, op and depth: all the source-map stepper reads.
const lean = (r) => ({ ...r, structLogs: r.structLogs
  .map(({ pc, op, depth }) => ({ pc, op, depth })) });
for (const [dir, t] of Object.entries(targets)) {
  const [, dep] = await send(undefined, "0x" + t.create);
  const to = dep.contractAddress;
  if (t.runtime) {
    const code = await rpc("eth_getCode", [to, "latest"]);
    if (code.slice(2) !== t.runtime) {
      throw new Error(`${dir}: deployed code differs from the file`);
    }
  }
  const setup = [];
  for (const c of plan.setup) {
    setup.push((await send(to, calldata(c), accounts[c.from]))[0]);
  }
  const [h, rc] = await send(to, calldata(plan.tx),
    accounts[plan.tx.from]);
  out[dir] = { address: to, tx: h };
  if (dir === "sol") continue;
  if (dir === "old") {
    write("old/record.trace.json", lean(await rpc("debug_traceTransaction",
      [h, { disableStack: true, disableStorage: true,
        enableMemory: false }])));
    const call = { from: accounts[plan.view.from], to,
      data: calldata(plan.view) };
    out[dir].history = await rpc("eth_call", [call, rc.blockNumber]);
    write("old/history.trace.json", lean(await rpc("debug_traceCall",
      [call, rc.blockNumber, { disableStack: true, disableStorage: true,
        enableMemory: false }])));
    continue;
  }
  const bug = dir.startsWith("bug/");
  const trace = await rpc("debug_traceTransaction",
    [h, ...bug ? [{ enableMemory: true }] : []]);
  write(`${dir}/tx.debug-trace.json`, trace);
  write(`${dir}/tx.transaction.json`,
    await rpc("eth_getTransactionByHash", [h]));
  write(`${dir}/tx.receipt.json`, rc);
  if (!bug) continue;
  // The storage before record(30), for the slots the pointers read:
  // every slot that a setup call or the transaction reads or writes (the
  // contract writes no storage when it is deployed), and the slots the
  // program names.
  const program = fs.readFileSync(`${dir}/scores.program.json`, "utf8");
  const slots = new Set([...program.matchAll(
    /"location": "storage",\s*"slot": (\d+)/g)].map((m) => BigInt(m[1])));
  const logs = [...trace.structLogs];
  for (const s of setup) {
    logs.push(...(await rpc("debug_traceTransaction", [s])).structLogs);
  }
  for (const l of logs) {
    if (l.op === "SLOAD" || l.op === "SSTORE") {
      slots.add(BigInt(l.stack[l.stack.length - 1]));
    }
  }
  const before = "0x" + (+rc.blockNumber - 1).toString(16);
  const at = (s) => rpc("eth_getStorageAt",
    [to, "0x" + s.toString(16), before]);
  const storage = {};
  for (const s of [...slots].sort((a, b) => (a < b ? -1 : 1))) {
    storage["0x" + s.toString(16)] = await at(s);
  }
  write(`${dir}/tx.storage-before.json`, storage);
}
console.log(JSON.stringify(out, null, 1));
