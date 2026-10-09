// The expected values, from vanilla bin/run.mjs
// (A, B, C, MOTD, NAME_C, player(), mid, expected, defaults)

// alice, bob and carol: anvil's accounts 1, 2 and 3
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
export const expected: Record<string, Row[]> = {
  mid: same2(mid),
  alice: [
    [`${A}.score`, "30", "60"],
    [`${A}.combo`, "2", "3"],
    [`${A}.bestCombo`, "2", "3"],
    [`${A}.plays`, "2", "3"],
    [`${A}.hits`, "2", "3"],
    [`${A}.name`, '"alice"', '"alice"'],
    [`${B}.score`, "10", "10"],
    ["totalScore", "140", "170"],
    ["totalHits", "7", "8"],
  ],
  motd: [
    ["motd", `"${MOTD[0]}"`, `"${MOTD[1]}"`],
    [`${A}.score`, "60", "60"],
    [`${C}.name`, `"${NAME_C}"`, `"${NAME_C}"`],
    ["totalScore", "170", "170"],
    ["totalHits", "8", "8"],
  ],
  // Solidity's rule, applied to the Vyper contract's storage
  vyper: same2([A, B, C].flatMap((p): [string, string][] =>
    [[`${p}.score`, "0"], [`${p}.combo`, "0"], [`${p}.name`, '""']])),
};
// Each scene's defaults: the mode shown and the variable selected
export const defaults: Record<string, [string, string]> = {
  mid: ["after", A],
  alice: ["after", A],
  motd: ["after", "motd"],
  vyper: ["after", `${A}.score`],
};
