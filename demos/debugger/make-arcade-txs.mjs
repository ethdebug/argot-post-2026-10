// Setup for every tab: deploy each build of the contract on anvil, send
// the same calls to each (arcade-story.json: setup calls, then the traced
// transaction), and save what the tabs load for the traced one.
// Run by make-arcade.sh, after the compilers.
//   sol/   solc (ethdebug, optimizer off): tx hash and address, for
//          soldb's saved trace (make-arcade.sh)
//   old/   solc (--via-ir --optimize): play.trace.json, only pc, op and
//          depth of each step
//   fe/    Fe: the node's three responses (soldb's Trace.fromTransaction)
//   bug/arcade-O0, bug/arcade-O2: the node's responses, each step's
//          memory, and the storage the pointers read, as it was before
// BUG has no selectors; its code block reads msg.data itself, so it gets
// the same calldata as the others. Its create block sets motd, so it
// gets no constructor arguments.
//
// The roll depends on the block (prevrandao; block.number in BUG), and
// anvil cannot set prevrandao. So each call with `hit` runs inside an
// evm_snapshot: if it does not roll the outcome the story needs, the
// script reverts, mines one empty block and sends it again. A hit
// changes `total` (its slot, per build, below); a miss does not.
// The node: PORT (default 8556) on localhost.
// Usage: node make-arcade-txs.mjs > txs.json
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
const plan = JSON.parse(fs.readFileSync("arcade-story.json", "utf8"));
const cast = (...a) => execFileSync("cast", a).toString().trim();
const calldata = (c) => cast("calldata", c.call, ...c.args);
const ctorArgs = cast("abi-encode", plan.deploy.sig, ...plan.deploy.args)
  .slice(2);
const word = (to, slot) => rpc("eth_getStorageAt",
  [to, "0x" + slot.toString(16), "latest"]);
// Send a call; with `hit`, until it rolls that outcome.
const play = async (to, c, totalSlot) => {
  for (let tries = 0; tries < 60; tries++) {
    const snap = await rpc("evm_snapshot");
    const before = await word(to, totalSlot);
    const [h, rc] = await send(to, calldata(c), accounts[c.from]);
    const hit = (await word(to, totalSlot)) !== before;
    if (c.hit === undefined || hit === c.hit) return [h, rc];
    await rpc("evm_revert", [snap]);
    await rpc("anvil_mine", ["0x1"]);
  }
  throw new Error("no roll gave the outcome");
};

const hex = (f) => fs.readFileSync(f, "utf8").trim().replace(/^0x/, "");
// total's slot: Solidity packs it with rounds in slot 3; Fe's store
// puts it in slot 12; BUG declares it at slot 3.
const targets = {
  sol: { create: hex("sol/ethdebug/Arcade.bin") + ctorArgs, total: 3 },
  old: { create: JSON.parse(fs.readFileSync("old/combined.json", "utf8"))
    .contracts["Arcade.sol:Arcade"].bin + ctorArgs, total: 3 },
  fe: { create: hex("fe/out/Arcade.bin") + ctorArgs,
    runtime: hex("fe/out/Arcade.runtime.bin"), total: 12 },
  "bug/arcade-O0": { create: hex("bug/arcade-O0/out/Arcade.bin"),
    runtime: hex("bug/arcade-O0/out/Arcade.runtime.bin"), total: 3 },
  "bug/arcade-O2": { create: hex("bug/arcade-O2/out/Arcade.bin"),
    runtime: hex("bug/arcade-O2/out/Arcade.runtime.bin"), total: 3 },
};
const out = {};
const write = (f, v) => fs.writeFileSync(f, JSON.stringify(v));
// Only pc, op and depth: all the source-map stepper reads.
const lean = (r) => ({ ...r, structLogs: r.structLogs
  .map(({ pc, op, depth }) => ({ pc, op, depth })) });
for (const [dir, t] of Object.entries(targets)) {
  const [hd, dep] = await send(undefined, "0x" + t.create);
  const to = dep.contractAddress;
  if (t.runtime) {
    const code = await rpc("eth_getCode", [to, "latest"]);
    if (code.slice(2) !== t.runtime) {
      throw new Error(`${dir}: deployed code differs from the file`);
    }
  }
  const setup = [hd];
  for (const c of plan.setup) setup.push((await play(to, c, t.total))[0]);
  const [h, rc] = await play(to, plan.tx, t.total);
  out[dir] = { address: to, tx: h };
  if (dir === "sol") continue;
  if (dir === "old") {
    write("old/play.trace.json", lean(await rpc("debug_traceTransaction",
      [h, { disableStack: true, disableStorage: true,
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
  // The storage before the transaction, for the slots the pointers read:
  // every slot that the deployment, a setup call or the transaction reads
  // or writes, and the slots the program names.
  const program = fs.readFileSync(`${dir}/arcade.program.json`, "utf8");
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
