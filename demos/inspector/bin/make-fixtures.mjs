// Makes the page's fixtures: compiles Arcade (contracts/Arcade.sol) with
// a native solc built from Walnut's fork (walnuthq/solidity PR #10) and
// the Vyper version (contracts/Arcade.vy) with vyper, deploys them on
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
  storageState, mappingKeys, touchedSlots, decodeStorage, baseSlot,
  solcTilde,
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
  const hash = await rpc("eth_sendTransaction", [{ from, gas: hex(10000000n),
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
  // (solc writes "$"; the library takes "~": decode.js solcTilde)
  await decodeStorage(solcTilde(contract), recordingState(address,
    block - 1n, before),
    keys).catch((e) => console.error(`${id} (before): ${e.message}`));
  await decodeStorage(solcTilde(contract), recordingState(address, block,
    after), keys)
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
  // and the slots to keep, read or not, and each variable's own slot (a
  // mapping's holds nothing, but the page shows it)
  const bases = contract.variables.filter((v) => v.pointer.location !==
    "code").map((v) => hex32(baseSlot(v)));
  for (const slot of [...(keep ?? []), ...bases]) {
    for (const [m, b] of [[before, block - 1n], [after, block]]) {
      if (!m.has(slot)) {
        const v = await rpc("eth_getStorageAt", [address, slot, hex(b)]);
        m.set(slot, "0x" + v.slice(2).padStart(64, "0"));
      }
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

// The story (as private/arcade/tools/story.py plays it): the deployer is
// anvil's account 0; alice, bob and carol are accounts 1, 2 and 3
const [, ALICE, BOB, CAROL] = await rpc("eth_accounts");
const PLAYERS = { [ALICE]: "alice", [BOB]: "bob", [CAROL]: "carol" };
const NAMES = { [ALICE]: "alice", [BOB]: "bob",
  [CAROL]: "carol, the unstoppable combo queen" };
// the motd starts long (its bytes at keccak(its slot)), then shrinks
const MOTD = ["season 2 starts friday, see you on the leaderboard", "gl hf"];
if (MOTD[0].length <= 31 || MOTD[1].length > 31 ||
  NAMES[CAROL].length <= 31) {
  throw new Error("the motds must be long, then short; carol's name long");
}
// the plays up to the middle of the game, then alice's third hit:
// carol hits four times (best combo 4), then misses (combo 0)
const STORY = [[ALICE, true], [ALICE, true], [BOB, true], [CAROL, true],
  [CAROL, true], [CAROL, true], [CAROL, true], [CAROL, false]];
const ctor = (m) => cast("abi-encode", "f(string)", m);
const joinAll = async (address) => {
  const txs = [];
  for (const who of [ALICE, BOB, CAROL]) {
    txs.push(await send({ from: who, to: address,
      data: cast("calldata", "join(string)", NAMES[who]) }));
  }
  return txs;
};

// A play rolls a hit or a miss from prevrandao, which anvil draws at
// random for each block and cannot be told. So each play is sent inside
// a snapshot: on the wrong outcome, revert, mine an empty block (a new
// prevrandao) and send again. `combo(who)` reads the player's combo.
async function play(address, who, hit, combo) {
  for (let k = 0; k < 60; k++) {
    const snap = await rpc("evm_snapshot");
    const c0 = await combo(who);
    const tx = await send({ from: who, to: address,
      data: cast("calldata", "play()") });
    const c1 = await combo(who);
    if ((c1 === c0 + 1n) === hit) return tx;
    await rpc("evm_revert", [snap]);
    await rpc("anvil_mine", ["0x1"]);
  }
  throw new Error("no roll gave the outcome");
}
const keysOf = async (txs) => {
  const keys = new Map();
  for (const tx of txs) {
    const t = await rpc("debug_traceTransaction", [tx.hash,
      { enableMemory: true }]);
    for (const [b, ks] of mappingKeys(trimTrace(t.structLogs))) {
      const list = keys.get(b) ?? [];
      for (const x of ks) if (!list.some((y) => y.key === x.key)) list.push(x);
      keys.set(b, list);
    }
  }
  return keys;
};
const field = (w, from, n) =>
  (BigInt(w) >> BigInt(8 * (32 - from - n))) & ((1n << BigInt(8 * n)) - 1n);

const arcade = compile("Arcade");
console.log("solc", arcade.compiler);
// players' slot, from the program context (solc), and from vyper's layout
const SOL_SLOT = BigInt(baseSlot(arcade.variables.find((v) =>
  v.identifier === "players")));
{
  const address = await deploy(arcade, ctor(MOTD[0]));
  // combo: bytes 20-23 of the player's slot, counted from the most
  // significant byte (bytes 8-11 from the low end)
  const combo = async (who) => field(await word(address,
    keccak(who, SOL_SLOT)),
    20, 4);
  const joins = await joinAll(address);
  const plays = [];
  for (const [who, hit] of STORY) plays.push(await play(address, who, hit, combo));
  const keys = await keysOf([...joins, ...plays]);
  // the page takes players' keys from playerList (decoded from storage);
  // the trace's keys are kept to check that they agree
  const extra = { keysFrom: "the traces of the joins and plays",
    keysIn: { players: "playerList" }, players: PLAYERS };
  // the middle of the game: after carol's miss
  await fixture({
    id: "arcade-mid", contract: arcade, address, tx: plays.at(-1), keys,
    extra, summary: "the middle of the game",
  });
  // alice plays: her third hit (combo 3, +30)
  const third = await play(address, ALICE, true, combo);
  await fixture({
    id: "arcade-alice", contract: arcade, address, tx: third, keys, extra,
    summary: "alice's third hit",
  });
  const motd = await send({ to: address,
    data: cast("calldata", "setMotd(string)", MOTD[1]) });
  await fixture({
    id: "arcade-motd", contract: arcade, address, tx: motd, keys, extra,
    summary: `setMotd("${MOTD[1]}")`,
  });
}

// Vyper: the same program, the same story up to the middle of the game.
// Vyper emits no ethdebug, so the fixture applies solc's rule for players
// (from Arcade.sol's ethdebug output) to the Vyper contract's storage,
// and keeps the slots Vyper itself uses for each player.
{
  const VYPER = process.env.VYPER ?? "vyper";
  const vyVersion = execFileSync(VYPER, ["--version"], { encoding: "utf8" })
    .trim();
  const bytecode = execFileSync(VYPER, ["-f", "bytecode",
    path.join(root, "contracts", "Arcade.vy")], { encoding: "utf8" }).trim();
  const { receipt } = await send({ data: bytecode + ctor(MOTD[0]).slice(2) });
  const address = receipt.contractAddress;
  const VY_SLOT = BigInt(JSON.parse(execFileSync(VYPER, ["-f", "layout",
    path.join(root, "contracts", "Arcade.vy")], { encoding: "utf8" }))
    .storage_layout.players.slot);
  const combo = async (who) => BigInt(await word(address,
    add(keccak(VY_SLOT, who), 1)));
  await joinAll(address);
  let last;
  for (const [who, hit] of STORY) last = await play(address, who, hit, combo);
  // Solidity's rule: keccak256(key . slot); Vyper's: keccak256(slot . key),
  // the struct unpacked: six counters in s … s+5, the name's length at
  // s+6 and its bytes from s+7. For each player (score, combo, bestCombo,
  // plays, hits):
  const want = { [ALICE]: [30n, 2n, 2n, 2n, 2n], [BOB]: [10n, 1n, 1n, 1n, 1n],
    [CAROL]: [100n, 0n, 4n, 5n, 4n] };
  const FIELDS = ["score", "combo", "bestCombo", "plays", "hits",
    "lastBlock"];
  const entries = [];
  for (const [who, w] of Object.entries(want)) {
    const sol = keccak(who, SOL_SLOT);
    const vy = keccak(VY_SLOT, who);
    const name = NAMES[who];
    const words = 7 + Math.ceil(name.length / 32);
    const members = [];
    for (let k = 0; k < words; k++) {
      const s = add(vy, k);
      const v = BigInt(await word(address, s));
      const what = k < 6 ? FIELDS[k] : k === 6 ? "name (length)"
        : "name (bytes)";
      const text = k < 6 || k === 6 ? String(v)
        : JSON.stringify(Buffer.from(v.toString(16).padStart(64, "0"), "hex")
          .toString("utf8").replace(/\0+$/, ""));
      members.push({ slot: s, name: what, text });
    }
    const got = members.slice(0, 5).map((m) => BigInt(m.text));
    if (got.some((x, k) => x !== w[k]) || members[6].text !==
      String(name.length) || BigInt(await word(address, sol)) !== 0n) {
      throw new Error(`vyper: unexpected storage ${got}`);
    }
    // the getter agrees
    console.log(`vyper players(${PLAYERS[who]}):`, cast("call", "--rpc-url",
      RPC, address, "players(address)((uint64,uint32,uint32,uint32,uint32," +
      "uint64,string))", who).replace(/\s+/g, " "), "solidity rule", sol,
      "vyper rule", vy);
    entries.push({ key: who, slot: vy, members });
  }
  const players = arcade.variables.find((v) => v.identifier === "players");
  const { after } = await fixture({
    id: "arcade-vyper", address, tx: last,
    contract: { ...arcade, variables: [players] },
    keys: new Map([[hex32(SOL_SLOT), Object.keys(want).map((who) =>
      ({ key: hex32(who) }))]]),
    keep: entries.flatMap((e) => e.members.map((m) => m.slot)),
    extra: {
      keysFrom: "the KECCAK256 inputs in the traces of Vyper's joins and" +
        " plays (there the slot comes first, then the key)",
      players: PLAYERS,
      vyper: { compiler: vyVersion, base: String(VY_SLOT), entries },
    },
    summary: "Vyper: the middle of the game",
  });
  for (const who of Object.keys(want)) {
    if (BigInt(after.get(keccak(who, SOL_SLOT))) !== 0n) {
      throw new Error("solc rule read");
    }
  }
  console.log("vyper", vyVersion);
}

// The contract at the top of the page (the app's index.html):
// contracts/Arcade.sol, as is, and its file name in the summary line
{
  const html = path.join(root, "..", "..", "inspector-app", "index.html");
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  fs.writeFileSync(html, fs.readFileSync(html, "utf8").replace(
    /(<pre id="contract-src" class="src">)[\s\S]*?(<\/pre>)/,
    (_, a, b) => a + esc(arcade.source) + b).replace(
    /(<span class="srcfile">)[^<]*(<\/span>)/, `$1${arcade.file}$2`));
}
// (the app's build writes the loader's sizes)
