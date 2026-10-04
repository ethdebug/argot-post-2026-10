// Makes the page's fixtures: compiles the contracts with the solc PR
// #16990 build, deploys them on anvil, runs the transactions, and saves
// for each one the trace steps the page needs, the storage words the
// decoder reads (before and after), and the compiler output.
//
// Needs anvil on RPC (default http://127.0.0.1:8548) and `cast`.
// Usage: node bin/make-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import {
  storageState, mappingKeys, touchedSlots, decodeStorage,
} from "../decode.js";

const require = createRequire(import.meta.url);
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8548";
const TO = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

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
const cast = (...args) =>
  execFileSync("cast", args, { encoding: "utf8" }).trim();
const hex = (n) => "0x" + n.toString(16);

// ------------------------------------------------------------ compile

const soljson = require(path.join(root, ".solc/soljson.cjs"));
const solc = require("solc/wrapper")(soljson);

function compile(name) {
  const file = `${name}.sol`;
  const content = fs.readFileSync(path.join(root, "contracts", file), "utf8");
  const input = {
    language: "Solidity",
    sources: { [file]: { content } },
    settings: {
      viaIR: true,
      optimizer: { enabled: false },
      experimental: true,
      debug: { debugInfo: ["ethdebug", "ast-id"] },
      outputSelection: {
        "*": {
          // selecting ethdebug.resources for contracts gives the global
          // `ethdebug` output (resources.types, resources.pointers)
          "*": ["storageLayout", "evm.bytecode.object", "ethdebug.resources"],
          "": ["ast"],
        },
      },
    },
  };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  const errors = (out.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
  if (!out.ethdebug?.resources) throw new Error("no ethdebug.resources");
  const c = out.contracts[file][name];
  // state variable declarations, by name, from the AST
  const declarations = {};
  const visit = (n) => {
    if (!n || typeof n !== "object") return;
    if (n.nodeType === "VariableDeclaration" && n.stateVariable) {
      const [start, length] = n.src.split(":").map(Number);
      declarations[n.name] = { offset: start, length };
    }
    for (const v of Object.values(n)) {
      if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === "object") visit(v);
    }
  };
  visit(out.sources[file].ast);
  return {
    name,
    file,
    source: content,
    compiler: solc.version(),
    bytecode: "0x" + c.evm.bytecode.object,
    layout: c.storageLayout,
    types: out.ethdebug.resources.types,
    pointers: out.ethdebug.resources.pointers,
    declarations,
  };
}

// ------------------------------------------------------------- chain

const [from] = await rpc("eth_accounts");

async function send(tx) {
  const hash = await rpc("eth_sendTransaction", [{ from, gas: hex(3000000n),
    ...tx }]);
  let receipt;
  for (let i = 0; i < 50 && !receipt; i++) {
    receipt = await rpc("eth_getTransactionReceipt", [hash]);
    if (!receipt) await new Promise((r) => setTimeout(r, 100));
  }
  if (receipt.status !== "0x1") throw new Error(`tx ${hash} failed`);
  return { hash, receipt };
}

async function deploy(contract, args = "0x") {
  const { receipt } = await send({
    data: contract.bytecode + args.slice(2),
  });
  return receipt.contractAddress;
}

async function call(address, sig, ...args) {
  return send({ to: address, data: cast("calldata", sig, ...args) });
}

// Only the steps the page needs: KECCAK256 (with memory, for mapping
// keys), SLOAD (with the value it loaded) and SSTORE.
function trimTrace(structLogs) {
  const out = [];
  structLogs.forEach((s, i) => {
    if (!["KECCAK256", "SHA3", "SLOAD", "SSTORE"].includes(s.op)) return;
    const step = { index: i, pc: s.pc, op: s.op, depth: s.depth,
      stack: s.stack.slice(-2) };
    if (s.op === "KECCAK256" || s.op === "SHA3") step.memory = s.memory;
    if (s.op === "SLOAD") step.pushed = structLogs[i + 1].stack.at(-1);
    out.push(step);
  });
  return out;
}

// A state that reads the node at a block and records every word read
function recordingState(address, block, record) {
  return storageState(async (slot) => {
    const v = await rpc("eth_getStorageAt", [address, slot, hex(block)]);
    const w = "0x" + v.slice(2).padStart(64, "0");
    record.set(slot, w);
    return w;
  });
}

async function fixture({
  id, title, summary, contract, address, tx, hidden,
}) {
  const block = BigInt(tx.receipt.blockNumber);
  const full = await rpc("debug_traceTransaction", [tx.hash,
    { enableMemory: true }]);
  const trace = trimTrace(full.structLogs);
  const keys = mappingKeys(trace);
  const before = new Map();
  const after = new Map();
  await decodeStorage(contract, recordingState(address, block - 1n, before),
    keys).catch((e) => console.error(`${id} (before): ${e.message}`));
  await decodeStorage(contract, recordingState(address, block, after), keys)
    .catch((e) => console.error(`${id} (after): ${e.message}`));
  // also record every slot the trace touched, and check the trace agrees
  // with the node
  for (const [slot, t] of touchedSlots(trace)) {
    for (const [m, b] of [[before, block - 1n], [after, block]]) {
      if (!m.has(slot)) {
        const v = await rpc("eth_getStorageAt", [address, slot, hex(b)]);
        m.set(slot, "0x" + v.slice(2).padStart(64, "0"));
      }
    }
    if (t.loaded !== undefined && t.loaded !== before.get(slot)) {
      throw new Error(`${id}: SLOAD ${slot} disagrees with the node`);
    }
    if (t.stored !== undefined && t.stored !== after.get(slot)) {
      throw new Error(`${id}: SSTORE ${slot} disagrees with the node`);
    }
  }
  const slots = {};
  for (const slot of new Set([...before.keys(), ...after.keys()])) {
    slots[slot] = { before: before.get(slot), after: after.get(slot) };
  }
  const t = await rpc("eth_getTransactionByHash", [tx.hash]);
  const data = {
    id, title, summary,
    tx: { hash: tx.hash, from: t.from, to: t.to, input: t.input,
      block: Number(block) },
    contract: { ...contract, address, bytecode: undefined },
    trace: { steps: full.structLogs.length, kept: trace },
    slots,
  };
  fs.writeFileSync(path.join(root, "fixtures", `${id}.json`),
    JSON.stringify(data));
  console.log(id, tx.hash, `${trace.length}/${full.structLogs.length} steps`,
    `${Object.keys(slots).length} slots`);
  return { id, title, summary, contract: contract.name, hidden };
}

// ------------------------------------------------------------ run it

const token = compile("Token");
const shop = compile("Shop");
const packed = compile("Packed");
const strings = compile("Strings");
console.log("solc", token.compiler);

const index = [];
{
  const address = await deploy(token, cast("abi-encode", "f(uint256)", "1000"));
  const tx = await call(address, "transfer(address,uint256)", TO, "25");
  index.push(await fixture({
    id: "token-transfer", contract: token, address, tx,
    title: "Token: transfer 25",
    summary: `transfer(${TO}, 25) from the deployer, who holds 1000`,
  }));
}
{
  const address = await deploy(shop);
  const tx = await call(address, "place(string,uint128,uint256)", "widget",
    "5", "3");
  index.push(await fixture({
    id: "shop-place", contract: shop, address, tx,
    title: "Shop: place an order",
    summary: 'place("widget", 5, 3): a struct with a string, pushed array',
    // @ethdebug/pointers (main) lets a `define` leak into later members of
    // a group, so Order.price and Order.quantities come out one slot off.

  }));
}
{
  const address = await deploy(packed);
  const set = await call(address, "set(uint8,uint16,uint128)", "7", "300",
    "123456789");
  index.push(await fixture({
    id: "packed-set", contract: packed, address, tx: set,
    title: "Packed: set packed values",
    summary: "set(7, 300, 123456789): small values share one slot",
  }));
}
{
  // Two strings change layout in one transaction: one grows from short
  // to long, one shrinks from long to short. Two more sit at the
  // boundary: 31 bytes (the longest short string) and 32 bytes (the
  // shortest long string). A setup transaction, not shown, sets them.
  const address = await deploy(strings);
  const S = {
    grows: ["short", "a string longer than thirty-one bytes, stored long"],
    shrinks: ["this one starts long, then becomes a short one", "now short"],
    most: "exactly thirty-one bytes, short",
    least: "thirty-two bytes, the least long",
  };
  if (S.most.length !== 31 || S.least.length !== 32) {
    throw new Error("boundary strings are the wrong length");
  }
  await call(address, "setAll(string,string,string,string)", S.grows[0],
    S.shrinks[0], S.most, S.least);
  const tx = await call(address, "update(string,string)", S.grows[1],
    S.shrinks[1]);
  index.push(await fixture({
    id: "strings-update", contract: strings, address, tx,
    title: "Strings: one grows long, one shrinks short",
    summary: `update("${S.grows[1]}", "${S.shrinks[1]}")`,
  }));
}
fs.writeFileSync(path.join(root, "fixtures", "index.json"),
  JSON.stringify(index, null, 2));
