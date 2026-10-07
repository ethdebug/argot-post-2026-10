import { it, expect, beforeAll } from "vitest";
import { testProject } from "../../test/project";
import { A, B } from "../../test/expect";
import { decode } from "./decode";
import { layout } from "./layout";
import { slotHex } from "./hex";
import { blockOf, locked, resolveTarget } from "./target";
import type { Decoded, Hex, Layout, Target } from "./types";

const at = {} as { d: Decoded; l: Layout };
beforeAll(async () => {
  const p = await testProject();
  at.d = await decode(p, p.decodings["sol:arcade-mid"], "arcade-mid:after");
  at.l = layout(at.d, "storage", { rows: "values" });
});
const slotOf = (path: string, k = 0): Hex =>
  slotHex(at.d.byPath.get(path)!.regions[0].slot! + BigInt(k));
const bytes = (row: Hex, from: number, to: number): Target =>
  ({ bytes: { row, from, to, location: "storage" } });
const go = (hit: Target, sel: string | null) =>
  resolveTarget(hit, sel, at.d.byPath, at.l);

it.each([
  // [what, hit, selection, target]
  ["nothing selected: a byte's most specific owner, and its run",
    () => bytes(slotHex(2n), 16, 31), null,
    () => ({ path: "total", ...bytes(slotHex(2n), 16, 31) })],
  ["players selected: a byte in alice's block targets alice",
    () => bytes(slotOf(`${A}.score`), 24, 31), "players", () => ({ path: A })],
  ["alice selected: her score byte targets her score",
    () => bytes(slotOf(`${A}.score`), 24, 31), A,
    () => ({ path: `${A}.score`, ...bytes(slotOf(`${A}.score`), 24, 31) })],
  ["players selected: a tree row inside bob targets bob",
    () => ({ path: `${B}.name` }), "players", () => ({ path: B })],
  ["nothing selected: a tree row is itself",
    () => ({ path: `${B}.name` }), null, () => ({ path: `${B}.name` })],
  ["an own-slot row's address targets its variable",
    () => ({ row: slotHex(3n) }), null, () => ({ path: "players" })],
  ["an own-slot row's byte targets its variable",
    () => bytes(slotHex(3n), 0, 31), null, () => ({ path: "players" })],
  ["a gutter address targets the row", () => ({ row: slotHex(2n) }), null,
    () => ({ row: slotHex(2n) })],
  ["bytes no value owns: the bytes", () => bytes(slotHex(2n), 0, 7), null,
    () => bytes(slotHex(2n), 0, 7)],
])("%s", (_, hit, sel, want) => {
  expect(go(hit(), sel)).toEqual(want());
});

it("blockOf: the selection's child holding a path", () => {
  expect(blockOf(`${A}.name`, "players")).toBe(A);
  expect(blockOf("roster[2]", "roster")).toBe("roster[2]");
  expect(blockOf("total", "players")).toBe("total");
  expect(blockOf(`${A}.name`, null)).toBe(`${A}.name`);
});

it("locked: inside the selection keeps it, outside is ignored", () => {
  expect(locked({ path: A }, "players", at.d.byPath)).toEqual({ path: A });
  expect(locked({ path: "total" }, "players", at.d.byPath)).toBe(null);
  expect(locked(bytes(slotHex(2n), 0, 7), "players", at.d.byPath))
    .toBe(null);
  expect(locked({ path: "total" }, null, at.d.byPath))
    .toEqual({ path: "total" });
  expect(locked(null, "players", at.d.byPath)).toBe(null);
});
