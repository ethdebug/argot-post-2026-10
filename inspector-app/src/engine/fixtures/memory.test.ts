import { it, expect } from "vitest";
import fs from "node:fs";
import { fromMemory } from "./memory";

const json = JSON.parse(fs.readFileSync("../demos/inspector/fixtures/memory.json",
  "utf8"));

it("memory.json: bugc at O0 and O2, a timeline each, three pauses as "
  + "bookmarks (two steps inside multiplied)", () => {
  const m = fromMemory(json);
  expect(m.compilations.map((c) => [c.id, c.language, c.provenance]))
    .toEqual([["bug-O0", "bug", "compiler"], ["bug-O2", "bug", "compiler"]]);
  expect(m.compilations[0].sources[0].path).toBe("bug/arcade.bug");
  expect(m.timelines.map((t) => t.points.map((p) => p.id))).toEqual([
    ["O0/roll", "O0/mult:0", "O0/mult:1", "O0/writes"],
    ["O2/roll", "O2/mult:0", "O2/mult:1", "O2/writes"]]);
  expect(m.bookmarks.map((b) => [b.id, b.points, b.select, b.side]))
    .toEqual(["O0", "O2"].flatMap((o) => [
      [`${o}/roll`, [`${o}/roll`], "hit", undefined],
      [`${o}/mult`, [`${o}/mult:0`, `${o}/mult:1`], "multiplied", "after"],
      [`${o}/writes`, [`${o}/writes`], "gained", undefined]]));
  expect(Object.values(m.decodings).map((d) => [d.id, d.compilation,
    d.timeline, d.variables])).toEqual([
    ["mem:O0", "bug-O0", "mem-O0", "locals"],
    ["mem:O2", "bug-O2", "mem-O2", "locals"]]);
  const [roll, mult, , writes] = m.timelines[0].points;
  expect(roll.paused).toMatchObject({ step: 399, op: "DUP1", of: 962,
    range: { offset: 1672, length: 4 } });
  expect(roll.snapshot.memory!.length).toBe((json.levels[0].points[0]
    .steps[0].memory.length - 2) / 2);
  expect([roll.scope, mult.scope]).toEqual([undefined, "multiplied"]);
  expect(writes.locals!.map((v) => [v.identifier, !!v.pointer]))
    .toEqual([["hit", false], ["gained", true]]);
  expect(writes.record).toMatchObject({ path: "players[msg.sender]",
    base: 4, members: [["score", 8], ["combo", 4], ["bestCombo", 4],
      ["plays", 4], ["hitCount", 4], ["lastBlock", 8]] });
  expect(writes.snapshot.storage.get(writes.record!.slot))
    .toBe(json.levels[0].points[2].record.word);
});
