// The states of the page that the screenshot baseline covers, for
// bin/shots.mjs (capture) and bin/shot-diff.mjs (compare).
// Usage: node bin/manifest.mjs > <dir>/manifest.json
//
// A state: the section to screenshot (storage: from #storage to the end
// of .scols; memory: #memory), the device and colour scheme, the
// URL hash (the vanilla page's keys), then actions on run.mjs
// selectors: a click (as run.mjs taps: the element's click(), no
// pointer), a focus (the page lights what has focus as what is pointed
// at), or a key. `walk: "all"` makes one screenshot per walkthrough
// step, counted on the page at run time: in the storage section, Start
// then Next until Next is disabled; in the memory section, each step of
// the selected value's derivation ("#mhow li[data-region]"), focused.
import { fileURLToPath } from "node:url";

// alice, bob and carol (as in vanilla bin/run.mjs)
const ADDR = {
  A: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8",
  B: "0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc",
  C: "0x90f79bf6eb2c4f870365e785982e1f101e93b906",
};
const A = `players[${ADDR.A}]`;
const B = `players[${ADDR.B}]`;
const C = `players[${ADDR.C}]`;

const MODES = [["desktop", "light"], ["desktop", "dark"],
  ["phone", "light"]];

// Each bookmark's sides: one for a bookmark with one timeline point
const SIDES = [["mid", null], ["alice", "before"], ["alice", "after"],
  ["motd", "before"], ["motd", "after"], ["vyper", null]];

// null: none selected ("sel="); undefined: the bookmark's default
const SELECTIONS = [null, undefined, "playerList", "playerList[1]", "motd",
  "totalScore", "totalHits", "players", A, `${A}.score`, `${C}.name`];
const WALKS = ["players", A, "playerList", "playerList[1]", "totalScore",
  "motd", `${C}.name`, `${B}.plays`];

// The memory section: each level's points, their sides, and the values
// in the tree at each point (from the vanilla page at sync-base)
const POINTS = [["roll", [null], ["hit"]],
  ["mult", ["before", "after"], ["_applyCombo", "points", "combo", "mult"]],
  ["writes", [null], ["gained", "hit", "players[msg.sender]",
    ...["score", "combo", "bestCombo", "plays", "hits", "lastBlock"]
      .map((f) => `players[msg.sender].${f}`)]]];

const START = '#details button[data-r="start"]';
const NEXT = '#details button[data-r="next"]';

// A short name for a path in ids: the addresses as A, B, C
const short = (p) => p.replace(/0x[0-9a-f]{40}/, (a) =>
  Object.keys(ADDR).find((k) => ADDR[k] === a));

const hashOf = (pairs) => pairs.filter(([, v]) => v !== undefined)
  .map(([k, v]) => `${k}=${v ?? ""}`).join("&");

function storage() {
  const out = [];
  for (const [ex, side] of SIDES) {
    const base = [["ex", ex], ["mode", side ?? undefined]];
    const tag = `${ex}${side ? `-${side}` : ""}`;
    for (const sel of SELECTIONS) {
      const name = sel === null ? "none" : sel === undefined ? "default"
        : short(sel);
      out.push({ id: `${tag}-sel=${name}`, section: "storage",
        hash: hashOf([...base, ["sel", sel]]), actions: [] });
    }
    for (const sel of WALKS) {
      const hash = hashOf([...base, ["sel", sel]]);
      out.push({ id: `${tag}-sel=${short(sel)}-walk`, section: "storage",
        hash, actions: [], walk: "all" });
    }
    // players, walkthrough steps 5 and 6, with bob, then carol, picked
    // (by their place in the focus picker, after "all" and alice: a
    // record is named by its name on chain, or its short address)
    for (const k of [5, 6]) for (const [who, at] of [["bob", 2],
      ["carol", 3]]) {
      out.push({ id: `${tag}-sel=players-walk${k}-${who}`,
        section: "storage", hash: hashOf([...base, ["sel", "players"]]),
        actions: [{ click: START },
          ...Array.from({ length: k - 1 }, () => ({ click: NEXT })),
          { click: `#dpick button >> nth=${at}` }] });
    }
  }
  // the calldata (motd only): `text`, then each ABI step pointed at
  for (const side of ["before", "after"]) {
    const hash = hashOf([["ex", "motd"], ["mode", side], ["sel", null]]);
    out.push({ id: `motd-${side}-calldata-text`, section: "storage", hash,
      actions: [{ click: '#ctree li[data-part="m"] > .row' }] });
    for (const part of ["selector", "m-offset", "m-length", "m-data"]) {
      out.push({ id: `motd-${side}-calldata-${part}`, section: "storage",
        hash, actions: [{ focus: `#chow li[data-part="${part}"]` }] });
    }
  }
  return out;
}

function memory() {
  const out = [];
  for (const opt of ["0", "2"]) for (const [pt, sides, paths] of POINTS) {
    for (const side of sides) {
      const base = [["mopt", opt], ["mpt", pt], ["mmode", side ??
        undefined]];
      const tag = `mem-O${opt}-${pt}${side ? `-${side}` : ""}`;
      out.push({ id: `${tag}-msel=none`, section: "memory",
        hash: hashOf([...base, ["msel", null]]), actions: [] });
      for (const p of paths) {
        const hash = hashOf([...base, ["msel", p]]);
        out.push({ id: `${tag}-msel=${p}`, section: "memory", hash,
          actions: [] });
        out.push({ id: `${tag}-msel=${p}-walk`, section: "memory", hash,
          actions: [], walk: "all" });
      }
    }
  }
  return out;
}

export function states() {
  const all = [...storage(), ...memory()];
  return MODES.flatMap(([device, scheme]) => all.map((s) => ({
    ...s, id: `${device}-${scheme}-${s.id}`, device, scheme })));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify({ threshold: 0, states: states() }, null, 1));
}
