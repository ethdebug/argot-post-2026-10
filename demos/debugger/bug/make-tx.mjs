// Setup: deploy a BUG contract on anvil (`anvil --steps-tracing --port
// $PORT`), send one call, and save the node's three responses that
// soldb's Trace.fromTransaction takes.
// BUG's `code` block runs on every call, so the calldata is empty.
// Usage: node make-tx.mjs [Name] [dir] [memory]
// Defaults: Tally, in ".". With "memory", the trace also has each
// step's memory and storage, for the BUG tab's pointers.
import fs from "fs";
const [name = "Tally", dir = ".", memory] = process.argv.slice(2);
// The node: PORT (default 8547) on localhost.
const NODE = `http://127.0.0.1:${process.env.PORT ?? 8547}`;
const rpc = async (method, params = []) => {
  const r = await (await fetch(NODE, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })).json();
  if (r.error) throw new Error(method + ": " + JSON.stringify(r.error));
  return r.result;
};
const [from] = await rpc("eth_accounts");
const send = async (to, data) => {
  const h = await rpc("eth_sendTransaction",
    [{ from, to, data, gas: "0x1000000" }]);
  let rc = null;
  while (!rc) {
    rc = await rpc("eth_getTransactionReceipt", [h]);
    await new Promise((r) => setTimeout(r, 100));
  }
  return [h, rc];
};
const bin = (ext) => fs.readFileSync(`${dir}/out/${name}${ext}`, "utf8")
  .trim();
const [, dep] = await send(undefined, "0x" + bin(".bin"));
const code = await rpc("eth_getCode", [dep.contractAddress, "latest"]);
console.log(`runtime matches ${dir}/out/${name}.runtime.bin:`,
  code.slice(2) === bin(".runtime.bin"));
// Empty calldata: BUG has no selectors.
const calldata = "0x";
const [h, rc] = await send(dep.contractAddress, calldata);
console.log("tx", h, "status", rc.status, "storage after:",
  await rpc("eth_getStorageAt", [dep.contractAddress, "0x0", "latest"]),
  await rpc("eth_getStorageAt", [dep.contractAddress, "0x1", "latest"]));
const opts = memory ? [{ enableMemory: true }] : [];
// The trace has no storage. With "memory", also save the storage the
// program's pointers name, as it was before the transaction.
if (memory) {
  const program = fs.readFileSync(fs.readdirSync(dir)
    .map((f) => `${dir}/${f}`).find((f) => f.endsWith(".program.json")),
  "utf8");
  const slots = [...new Set([...program.matchAll(
    /"location": "storage",\s*"slot": (\d+)/g)].map((m) => +m[1]))];
  const before = "0x" + (+rc.blockNumber - 1).toString(16);
  const storage = {};
  for (const s of slots) {
    storage["0x" + s.toString(16)] = await rpc("eth_getStorageAt",
      [dep.contractAddress, "0x" + s.toString(16), before]);
  }
  fs.writeFileSync(`${dir}/tx.storage-before.json`,
    JSON.stringify(storage));
}
fs.writeFileSync(`${dir}/tx.debug-trace.json`,
  JSON.stringify(await rpc("debug_traceTransaction", [h, ...opts])));
fs.writeFileSync(`${dir}/tx.transaction.json`,
  JSON.stringify(await rpc("eth_getTransactionByHash", [h])));
fs.writeFileSync(`${dir}/tx.receipt.json`, JSON.stringify(rc));
