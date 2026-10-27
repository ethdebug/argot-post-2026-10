// The expected values, from vanilla bin/run.mjs
// (A, B, C, MOTD, NAME_C, player(), mid, expected, defaults)

// alice, bob and carol: the scenario's accounts 1, 2 and 3
export const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";
export const B = "players[0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc]";
export const C = "players[0x90f79bf6eb2c4f870365e785982e1f101e93b906]";
export const MOTD = ["season 2 starts friday, see you on the leaderboard",
  "gl hf"];
export const NAME_C = "carol, the unstoppable combo queen";

type Row = [path: string, before: string, after: string];
// [path, before, after] for each scene. A scene with one point shows
// the same state on both sides.
const same2 = (rows: [string, string][]): Row[] =>
  rows.map(([p, v]) => [p, v, v]);
export const player = (p: string,
  [score, combo, best, plays, hc]: string[], name: string):
  [string, string][] => [
  [`${p}.score`, score], [`${p}.combo`, combo], [`${p}.bestCombo`, best],
  [`${p}.plays`, plays], [`${p}.hits`, hc], [`${p}.name`, name]];
// the middle of the game
export const mid: [string, string][] = [
  ...player(A, ["30", "2", "2", "2", "2"], '"alice"'),
  ...player(B, ["10", "1", "1", "1", "1"], '"bob"'),
  ...player(C, ["100", "0", "4", "5", "4"], `"${NAME_C}"`),
  ["playerList", "length 3"],
  ["playerList[0]", "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"],
  ["playerList[2]", "0x90f79bf6eb2c4f870365e785982e1f101e93b906"],
  ["motd", `"${MOTD[0]}"`], ["totalScore", "140"], ["totalHits", "7"],
];
// [path, before, after] for each scene. The post's storage scenes are
// at one moment, carol's miss (transaction 11, its writes done): the
// middle of the game
export const expected: Record<string, Row[]> = {
  "pitfall-nesting": same2(mid),
  // Solidity's rule, applied to the Vyper contract's storage
  "pitfall-compiler": same2([A, B, C].flatMap((p): [string, string][] =>
    [[`${p}.score`, "0"], [`${p}.combo`, "0"], [`${p}.name`, '""']])),
};
// Each scene's defaults: the mode shown and the variable selected
export const defaults: Record<string, [string, string]> = {
  "pitfall-nesting": ["after", A],
  "pointer-walkthrough": ["after", "players"],
  "pitfall-compiler": ["after", `${A}.score`],
};
// players' lastBlock in the arcade scenario's runs (genesis block 0, one
// transaction a block: transaction k in block k + 1): alice, bob and
// carol in the middle of the game (their last plays: transactions 5, 6
// and 11)
export const lastBlock = ["6", "7", "12"];

// Inside one play (alice's third hit, transaction 12, in the bug runs):
// four pauses, each its trace step at -O2, its source range
// and the locals its context lists: in
// _turn, after the roll; inside _applyCombo, the two steps around `mult
// = combo`; before the writes (totalScore's, in _turn)
export const PAUSE_TX = 12;
export const PAUSE_STEPS = { O2: [499, 723, 724, 795] } as const;
// (the stepper's scene)
export const STEPPER = { O2: "optimized-locals" } as const;
export const pauses: { range?: string; locals: string[] }[] = [
  { range: "!hit", locals: ["player", "hit"] },
  { range: "if (combo < 5) {\n      mult = combo;\n    }",
    locals: ["points", "combo", "mult"] },
  { range: "if (combo < 5) {\n      mult = combo;\n    }",
    locals: ["points", "combo", "mult"] },
  { range: "totalScore", locals: ["player", "hit", "gained"] }];
