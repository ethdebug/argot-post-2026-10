// Setup: deploy Tally (BUG) on anvil (`anvil --steps-tracing --port
// 8547`), send one call, and save the node's three responses that
// soldb's Trace.fromTransaction takes.
// BUG's `code` block runs on every call, so the calldata is empty.
// Usage: node make-tx.mjs
import fs from "fs";
const rpc = async (method, params = []) => {
  const r = await (await fetch("http://127.0.0.1:8547", {
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
const init = "0x" + fs.readFileSync("out/Tally.bin", "utf8").trim();
const [, dep] = await send(undefined, init);
const code = await rpc("eth_getCode", [dep.contractAddress, "latest"]);
const runtime = fs.readFileSync("out/Tally.runtime.bin", "utf8").trim();
console.log("runtime matches out/Tally.runtime.bin:",
  code.slice(2) === runtime);
// Empty calldata: BUG has no selectors.
const calldata = "0x";
const [h, rc] = await send(dep.contractAddress, calldata);
console.log("tx", h, "status", rc.status, "storage after:",
  await rpc("eth_getStorageAt", [dep.contractAddress, "0x0", "latest"]),
  await rpc("eth_getStorageAt", [dep.contractAddress, "0x1", "latest"]));
fs.writeFileSync("tx.debug-trace.json",
  JSON.stringify(await rpc("debug_traceTransaction", [h])));
fs.writeFileSync("tx.transaction.json",
  JSON.stringify(await rpc("eth_getTransactionByHash", [h])));
fs.writeFileSync("tx.receipt.json", JSON.stringify(rc));
