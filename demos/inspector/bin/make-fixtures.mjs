// Makes the page's fixtures: compiles Scores (contracts/Scores.sol) with
// a native solc built from Walnut's fork (walnuthq/solidity PR #10) and
// the Vyper version (contracts/Scores.vy) with vyper, deploys them on
// anvil, runs the transactions, and saves for each fixture the trace
// steps the page needs, the storage words the decoder reads (before and
// after), and the compiler output.
//
// Needs anvil on RPC (default http://127.0.0.1:8555), `cast`, the solc
// binary at SOLC (default: `solc` on PATH) and the vyper binary at VYPER
// (default: `vyper` on PATH; see README.md).
// Usage: SOLC=<solc> VYPER=<vyper> node bin/make-fixtures.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  storageState, mappingKeys, touchedSlots, decodeStorage,
} from "../decode.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8555";

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

const SOLC = process.env.SOLC ?? "solc";
const solcVersion = execFileSync(SOLC, ["--version"], { encoding: "utf8" })
  .match(/Version: (\S+)/)[1];

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
          // selecting ethdebug.resources and ethdebug.compilation for
          // contracts gives the global `ethdebug` output
          // (resources.types, resources.pointers); the program for the
          // deployed code has the program-level context (`variables`)
          "*": ["evm.bytecode.object", "evm.deployedBytecode.ethdebug",
            "ethdebug.resources", "ethdebug.compilation"],
          "": ["ast"],
        },
      },
    },
  };
  const out = JSON.parse(execFileSync(SOLC, ["--standard-json"], {
    input: JSON.stringify(input), encoding: "utf8",
    maxBuffer: 1 << 28,
  }));
  const errors = (out.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
  if (!out.ethdebug?.resources) throw new Error("no ethdebug.resources");
  const c = out.contracts[file][name];
  const variables = c.evm.deployedBytecode.ethdebug?.context?.variables;
  if (!variables) throw new Error(`${name}: no program-level variables`);
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
    compiler: solcVersion,
    bytecode: "0x" + c.evm.bytecode.object,
    // state variables: base slot, offset, type (program-level context)
    variables,
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

// One fixture: a transaction's trace steps, and every storage word the
// decoder reads before and after it. `keys`: mapping keys to use instead
// of the transaction's own KECCAK256 inputs (Map, as mappingKeys()
// returns). `keep`: the slots of the trace to keep (all by default).
async function fixture({ id, summary, contract, address, tx, keys, keep,
  extra = {} }) {
  const block = BigInt(tx.receipt.blockNumber);
  const full = await rpc("debug_traceTransaction", [tx.hash,
    { enableMemory: true }]);
  let trace = trimTrace(full.structLogs);
  keys ??= mappingKeys(trace);
  if (keep) {
    trace = trace.filter((s) => !["SLOAD", "SSTORE"].includes(s.op) ||
      keep.includes(hex32(s.stack.at(-1))));
  }
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
    id, summary,
    tx: { hash: tx.hash, from: t.from, to: t.to, input: t.input,
      block: Number(block) },
    contract: { ...contract, address, bytecode: undefined },
    trace: { steps: full.structLogs.length, kept: trace },
    ...(keys !== undefined && extra.keysFrom
      ? { keys: [...keys].map(([b, ks]) => [b, ks]) } : {}),
    ...extra,
    slots,
  };
  fs.writeFileSync(path.join(root, "fixtures", `${id}.json`),
    JSON.stringify(data));
  console.log(id, tx.hash, `${trace.length}/${full.structLogs.length} steps`,
    `${Object.keys(slots).length} slots`);
  return { slots, after };
}

const hex32 = (h) => "0x" + BigInt(h).toString(16).padStart(64, "0");
const keccak = (...words) =>
  cast("keccak", "0x" + words.map((w) => hex32(w).slice(2)).join(""));
const add = (h, n) => hex32(BigInt(h) + BigInt(n));
const word = async (address, slot) => hex32(await rpc("eth_getStorageAt",
  [address, slot, "latest"]));

// ------------------------------------------------------------ run it

// Alice is anvil's first account, the sender of every transaction
const ALICE = from;
const MOTTO = ["play fair",
  "play fair, keep score, and write the scores down"];
if (MOTTO[0].length > 31 || MOTTO[1].length <= 31) {
  throw new Error("the mottos must be short, then long");
}

const scores = compile("Scores");
console.log("solc", scores.compiler);
{
  const address = await deploy(scores);
  const first = await call(address, "record(uint256)", "7");
  const second = await call(address, "record(uint256)", "30");
  // the record fixture: the second record(), so the state before it is
  // the state after the first
  await fixture({
    id: "scores-record", contract: scores, address, tx: second,
    extra: { keysFrom: "the trace of Alice's record(30)" },
    summary: "record(7), then record(30), from Alice",
  });
  await call(address, "setMotto(string)", MOTTO[0]);
  const motto = await call(address, "setMotto(string)", MOTTO[1]);
  // setMotto hashes no mapping key: Alice's key comes from the trace of
  // her first record()
  const trace = await rpc("debug_traceTransaction", [first.hash,
    { enableMemory: true }]);
  await fixture({
    id: "scores-motto", contract: scores, address, tx: motto,
    keys: mappingKeys(trimTrace(trace.structLogs)),
    extra: { keysFrom: "the trace of Alice's record(7)" },
    summary: `setMotto("${MOTTO[0]}"), then setMotto("${MOTTO[1]}")`,
  });
}

// Vyper: the same program, the same calls. Vyper emits no ethdebug, so
// the fixture applies solc's rule for players (from Scores.sol's ethdebug
// output) to the Vyper contract's storage, and keeps the slots Vyper
// itself wrote for Alice, from its trace.
{
  const VYPER = process.env.VYPER ?? "vyper";
  const vyVersion = execFileSync(VYPER, ["--version"], { encoding: "utf8" })
    .trim();
  const bytecode = execFileSync(VYPER, ["-f", "bytecode",
    path.join(root, "contracts", "Scores.vy")], { encoding: "utf8" }).trim();
  const { receipt } = await send({ data: bytecode });
  const address = receipt.contractAddress;
  await call(address, "record(uint256)", "7");
  const tx = await call(address, "record(uint256)", "30");
  // Solidity's rule: keccak256(key . slot); Vyper's: keccak256(slot . key),
  // and the struct unpacked, one member per slot
  const sol = keccak(ALICE, 0);
  const vy = keccak(0, ALICE);
  const members = [0, 1, 2].map((k) => add(vy, k));
  const got = await Promise.all(members.map((s) => word(address, s)));
  const want = [67n, 2n, 1n];
  if (got.some((w, k) => BigInt(w) !== want[k]) ||
    BigInt(await word(address, sol)) !== 0n) {
    throw new Error(`vyper: unexpected storage ${got}`);
  }
  // the getter agrees: (score, streak, active)
  console.log("vyper players(alice):", cast("call", "--rpc-url", RPC,
    address, "players(address)(uint64,uint32,bool)", ALICE)
    .replace(/\s+/g, " "));
  const players = scores.variables.find((v) => v.identifier === "players");
  const { after } = await fixture({
    id: "scores-vyper", address, tx,
    contract: { ...scores, variables: [players] },
    keys: new Map([[hex32(0), [{ key: hex32(ALICE) }]]]),
    keep: members,
    extra: {
      keysFrom: "the KECCAK256 inputs in the trace of Vyper's record(30)" +
        " (there the slot comes first, then the key)",
      vyper: { compiler: vyVersion, slot: vy, members,
        names: ["score", "streak", "active"] },
    },
    summary: "Vyper: record(7), then record(30), from Alice",
  });
  if (BigInt(after.get(sol)) !== 0n) throw new Error("solc rule read");
  console.log("vyper", vyVersion, "solidity rule", sol, "vyper rule", vy);
}

// The contract at the top of the page: contracts/Scores.sol, as is, and
// its file name in the summary line
{
  const html = path.join(root, "index.html");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  fs.writeFileSync(html, fs.readFileSync(html, "utf8").replace(
    /(<pre id="contract-src" class="src">)[\s\S]*?(<\/pre>)/,
    (_, a, b) => a + esc(scores.source) + b).replace(
    /(<span class="srcfile">)[^<]*(<\/span>)/, `$1${scores.file}$2`));
}
// then: node bin/sizes.mjs
