// Setup, not part of the snippet: deploy, send one tx, save struct log.
import fs from "fs";
const rpc = async (method, params = []) => {
  const r = await (await fetch("http://127.0.0.1:8547", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) })).json();
  if (r.error) throw new Error(method + ": " + JSON.stringify(r.error));
  return r.result;
};
const [from] = await rpc("eth_accounts");
const send = async (to, data) => {
  const h = await rpc("eth_sendTransaction", [{ from, to, data, gas: "0x1000000" }]);
  let rc = null;
  while (!rc) { rc = await rpc("eth_getTransactionReceipt", [h]); await new Promise((r) => setTimeout(r, 100)); }
  return [h, rc];
};
const word = (n) => n.toString(16).padStart(64, "0");
const [name, init, calldata, out] = process.argv.slice(2);
const [, dep] = await send(undefined, "0x" + fs.readFileSync(init, "utf8").trim().replace(/^0x/, ""));
const [h, rc] = await send(dep.contractAddress, calldata);
console.log(name, "status", rc.status);
const t = await rpc("debug_traceTransaction", [h]);
fs.writeFileSync(out, JSON.stringify(t));
