// Setup: deploy Tally on anvil (port 8547), send Add{n}, and save the
// node's three responses that soldb's Trace.fromTransaction takes.
// Usage: node make-tx.mjs <n>
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
const n = BigInt(process.argv[2] ?? 4);
const init = "0x" + fs.readFileSync("out/Tally.bin", "utf8").trim();
const [, dep] = await send(undefined, init);
const code = await rpc("eth_getCode", [dep.contractAddress, "latest"]);
const runtime = fs.readFileSync("out/Tally.runtime.bin", "utf8").trim();
console.log("runtime matches out/Tally.runtime.bin:",
  code.slice(2) === runtime);
// Selector 0x00000001 (Fe #[selector = 0x01]) + one u256 word.
const calldata = "0x00000001" + n.toString(16).padStart(64, "0");
const [h, rc] = await send(dep.contractAddress, calldata);
const total = await rpc("eth_call",
  [{ to: dep.contractAddress, data: calldata }, "latest"]);
console.log("tx", h, "status", rc.status, "eth_call after:", total);
fs.writeFileSync("tx.debug-trace.json",
  JSON.stringify(await rpc("debug_traceTransaction", [h])));
fs.writeFileSync("tx.transaction.json",
  JSON.stringify(await rpc("eth_getTransactionByHash", [h])));
fs.writeFileSync("tx.receipt.json", JSON.stringify(rc));
