// Makes fixtures/memory.json for the lower section, "Inside one play":
// alice's combo-3 play() of Arcade's BUG port (bug/arcade.bug), compiled
// by bugc at -O 0 and at -O 2, paused at three points, with memory and
// the `variables` context bugc emitted for each paused instruction.
//
// The points are picked by how many locals have a location there (bugc
// gives them a pointer), not by line:
//   - "roll": after the roll, the first step where `hit` has one;
//   - "mult": inside _applyCombo, two steps with all of points, combo
//     and mult located: the last with mult = 5 and the first with
//     mult = 3 (the assignment `mult = combo`);
//   - "writes": just before the storage writes, the last step before
//     the first SSTORE after `gained` has a location, with alice's
//     record slot as it is then (from the trace's SSTOREs).
//
// bugc must come from ethdebug/format main at 1d45fea4c (#368) or
// later: Arcade needs `!`, block.prevrandao, keccak256 over words,
// strings to storage and push.
//
// Needs anvil with steps tracing on RPC (default http://127.0.0.1:8558)
// and `cast`:
//   anvil --port 8558 --steps-tracing --silent
// Usage: BUGC=<checkout>/packages/bugc node bin/make-memory-fixture.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { decodeLocals } from "../decode.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RPC = process.env.RPC_URL ?? "http://127.0.0.1:8558";
const BUGC = process.env.BUGC;
if (!BUGC) throw new Error("set BUGC to a built packages/bugc");

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
const word = (n) => "0x" + BigInt(n).toString(16).padStart(64, "0");

const rel = "bug/arcade.bug";
const file = path.join(root, rel);
const source = fs.readFileSync(file, "utf8");
const git = (...a) =>
  execFileSync("git", ["-C", BUGC, ...a], { encoding: "utf8" }).trim();
const commit = git("rev-parse", "HEAD");
const STORAGE = new Set(["playerList", "motd", "totalScore", "totalHits",
  "players"]);

function compile(opt) {
  // bugc names the source by its full path; keep the relative one
  const out = JSON.parse(execFileSync("node",
    [path.join(BUGC, "dist", "bin", "bugc.js"), "-O", String(opt), "-f",
      "json", file], { encoding: "utf8", maxBuffer: 1 << 30 })
    .split(JSON.stringify(file).slice(1, -1)).join(rel));
  // Instructions by byte offset: one byte each, plus immediates
  const byPc = new Map();
  let pc = 0;
  for (const ins of out.runtime.instructions) {
    byPc.set(pc, ins);
    pc += 1 + (ins.immediates?.length ?? 0);
  }
  const players = out.runtime.instructions.flatMap((i) =>
    i.debug?.context?.variables ?? []).find((v) =>
    v.identifier === "players");
  return { bytecode: out.create.bytecode, byPc, players };
}

// -------------------------------------------------------------- chain

const [DEPLOYER, ALICE, BOB, CAROL] = await rpc("eth_accounts");
const NAMES = { [ALICE]: "alice", [BOB]: "bob",
  [CAROL]: "carol, the unstoppable combo queen" };

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

// players[a] is at keccak256(a . base), base = players' slot from bugc
// (4). Its first slot packs the counters as Solidity does, the first
// member in the low-order bytes. (BUG's rules: bugc's pointer for
// players gives only its base slot.)
const recordSlot = (who, base) =>
  cast("keccak", cast("abi-encode", "f(address,uint256)", who, base));
const MEMBERS = [["score", 8], ["combo", 4], ["bestCombo", 4],
  ["plays", 4], ["hits", 4], ["lastBlock", 8]];
function members(w) {
  const out = {};
  let low = 0;
  for (const [name, n] of MEMBERS) {
    out[name] = { offset: 32 - low - n, length: n,
      value: (BigInt(w) >> BigInt(8 * low)) & ((1n << BigInt(8 * n)) - 1n) };
    low += n;
  }
  return out;
}

// The story up to alice's third hit. A play rolls from prevrandao,
// which anvil draws at random: each play is sent in a snapshot, and on
// the wrong outcome the script reverts, mines an empty block and sends
// again.
async function story(c) {
  const { receipt } = await send({ data: c.bytecode });
  const address = receipt.contractAddress;
  // (bugc from #369 on wraps players' region in its templates: `in`)
  const base = BigInt((c.players.pointer.in ?? c.players.pointer).slot);
  const combo = async (who) => members(await rpc("eth_getStorageAt",
    [address, recordSlot(who, base), "latest"])).combo.value;
  for (const who of [ALICE, BOB, CAROL]) {
    await send({ from: who, to: address,
      data: cast("calldata", "join(string)", NAMES[who]) });
  }
  async function play(who, hit) {
    for (let k = 0; k < 60; k++) {
      const snap = await rpc("evm_snapshot");
      const c0 = await combo(who);
      const tx = await send({ from: who, to: address,
        data: cast("calldata", "play()") });
      if ((await combo(who) === c0 + 1n) === hit) return tx;
      await rpc("evm_revert", [snap]);
      await rpc("anvil_mine", ["0x1"]);
    }
    throw new Error("no roll gave the outcome");
  }
  // carol hits four times (best combo 4), then misses
  for (const [who, hit] of [[ALICE, true], [ALICE, true], [BOB, true],
    [CAROL, true], [CAROL, true], [CAROL, true], [CAROL, true],
    [CAROL, false]]) await play(who, hit);
  const tx = await play(ALICE, true);
  // playerList has its three players, by push
  const len = BigInt(await rpc("eth_getStorageAt", [address, "0x0",
    "latest"]));
  if (len !== 3n) throw new Error(`playerList length ${len}`);
  return { address, base, tx };
}

// ------------------------------------------------------------ a level

async function level(opt) {
  const c = compile(opt);
  const { address, base, tx } = await story(c);
  const block = Number(tx.receipt.blockNumber);
  const trace = await rpc("debug_traceTransaction",
    [tx.hash, { enableMemory: true }]);
  const logs = trace.structLogs;
  if (!logs.length) throw new Error("empty trace: run anvil --steps-tracing");
  // A context describes the state after its instruction: each point
  // shows memory after its step, the memory of the next step
  const memoryAfter = (i) => "0x" + (logs[i + 1].memory ?? [])
    .map((w) => w.replace(/^0x/, "")).join("");
  const steps = [];
  for (let i = 0; i < logs.length - 1; i++) {
    const context = c.byPc.get(logs[i].pc)?.debug?.context ?? {};
    const locals = (context.variables ?? [])
      .filter((v) => !STORAGE.has(v.identifier));
    const decoded = await decodeLocals(locals, memoryAfter(i));
    const value = Object.fromEntries(decoded.map((n) =>
      [n.path, n.value.text]));
    steps.push({ i, context, locals, value,
      live: decoded.length, listed: locals.map((v) => v.identifier) });
  }
  // the earliest step with the most locals located, of those that pass
  const best = (ok) => steps.filter(ok).reduce((a, s) =>
    !a || s.live > a.live ? s : a, null);
  const has = (s, ...ns) => ns.every((n) => n in s.value);

  const roll = best((s) => has(s, "hit"));
  const inMult = (s) => has(s, "points", "combo", "mult");
  const most = Math.max(...steps.filter(inMult).map((s) => s.live));
  const m5 = steps.filter((s) => inMult(s) && s.live === most &&
    s.value.mult === "5").at(-1);
  const m3 = steps.find((s) => inMult(s) && s.live === most &&
    s.value.mult === "3");
  // the last step before the first SSTORE after gained has a location,
  // of those with the most locals located
  const g = steps.find((s) => has(s, "gained"));
  const store = logs.findIndex((l, i) => i > g.i && l.op === "SSTORE");
  const writes = steps.filter((s) => s.i >= g.i && s.i < store &&
    has(s, "gained")).reduce((a, s) => !a || s.live >= a.live ? s : a,
    null);
  if (!roll || !m5 || !m3 || !writes) {
    throw new Error(`-O ${opt}: points ${!!roll} ${!!m5} ${!!m3} ${
      !!writes}`);
  }

  // alice's record slot at the writes point: before the transaction,
  // then each SSTORE to it up to that step
  const slot = recordSlot(ALICE, base);
  let record = word(await rpc("eth_getStorageAt", [address, slot,
    hex(block - 1)]));
  for (let i = 0; i <= writes.i; i++) {
    const l = logs[i];
    if (l.op !== "SSTORE") continue;
    const [v, k] = l.stack.slice(-2);
    if (BigInt(k) === BigInt(slot)) record = word(v);
  }

  // What the source computes, by hand: alice's third hit, so combo 3,
  // and _applyCombo(10, 3): mult = 5, then mult = combo = 3; gained = 30.
  // Before the writes her record has every counter but score updated:
  // score 30, combo 3, bestCombo 3, plays 3, hits 3, lastBlock this
  // block.
  const want = {
    roll: [{ hit: "true" }],
    mult: [{ points: "10", combo: "3", mult: "5" },
      { points: "10", combo: "3", mult: "3" }],
    writes: [{ gained: "30" }],
  };
  const fields = members(record);
  const wantRecord = { score: 30n, combo: 3n, bestCombo: 3n, plays: 3n,
    hits: 3n, lastBlock: BigInt(block) };
  for (const [k, v] of Object.entries(wantRecord)) {
    if (fields[k].value !== v) {
      throw new Error(`-O ${opt}: record ${k} = ${fields[k].value}`);
    }
  }
  const snap = (s) => {
    const l = logs[s.i];
    return { step: s.i, pc: l.pc, op: l.op, depth: l.depth,
      range: s.context.code?.range, variables: s.locals,
      memory: memoryAfter(s.i) };
  };
  const sorted = (o) => JSON.stringify(Object.fromEntries(
    Object.entries(o).sort()));
  const points = [
    { id: "roll", title: "After the roll", steps: [roll] },
    { id: "mult", title: "Inside _applyCombo", steps: [m5, m3] },
    { id: "writes", title: "Before the writes", steps: [writes] },
  ].map((p) => {
    p.steps.forEach((s, k) => {
      if (sorted(s.value) !== sorted(want[p.id][k])) {
        throw new Error(`-O ${opt} ${p.id}: ${JSON.stringify(s.value)}`);
      }
      console.log(`-O ${opt}`, p.id, `step ${s.i}`, logs[s.i].op,
        `live ${s.live}:`, JSON.stringify(s.value), "listed:",
        s.listed.join(" "));
    });
    return { id: p.id, title: p.title, steps: p.steps.map(snap),
      ...(p.id === "writes" ? { record: { key: ALICE, base: Number(base),
        slot: word(slot), word: record } } : {}) };
  });
  return { optimize: opt, tx: { hash: tx.hash, to: address, block },
    trace: { steps: logs.length }, points };
}

const levels = [];
for (const opt of [0, 2]) levels.push(await level(opt));

const data = {
  program: { name: "Arcade", file: rel, source },
  compiler: { name: "bugc", branch: "main", commit },
  player: ALICE,
  levels,
};
fs.writeFileSync(path.join(root, "fixtures", "memory.json"),
  JSON.stringify(data));
console.log("bugc", commit.slice(0, 9));
