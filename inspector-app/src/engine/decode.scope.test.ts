// Everything in scope (decodeScope): bugc's storage variables, its
// types inline and its templates in its pointers, decode as solc's do:
// test/expect.ts's story, from bugc's runs, at the same moments
import { describe, expect, it } from "vitest";
import { decode } from "./decode";
import { layout } from "./layout";
import { pauseOf, testProject } from "../../test/project";
import { expected, lastBlock, A, B, C } from "../../test/expect";

const at = async (scene: string, tx: number) => {
  const p = await testProject();
  const run = `run:${scene}`;
  const src = await p.source(run);
  const k = src.moments.findIndex((m) => m.tx === tx && m.step === "end");
  return decode(p, p.decodings[run], `${run}:${k}`);
};
const text = (d: Awaited<ReturnType<typeof at>>, path: string) => {
  const n = d.byPath.get(path);
  return n?.value?.text ?? n?.summary;
};

describe.each(["stepper-O0", "optimized-locals", "mid"])("%s's storage in scope",
  (scene) => {
    it("the middle of the game: test/expect.ts's values", async () => {
      const d = await at(scene, 11);
      for (const [path, , value] of expected.mid) {
        expect(text(d, path), path).toBe(value);
      }
      expect([A, B, C].map((x) => text(d, `${x}.lastBlock`)))
        .toEqual(lastBlock.mid);
    });
    it("alice's third hit, and setMotd", async () => {
      const d = await at(scene, 12);
      for (const [path, , value] of expected.alice) {
        expect(text(d, path), path).toBe(value);
      }
      const e = await at(scene, 13);
      for (const [path, , value] of expected.motd) {
        expect(text(e, path), path).toBe(value);
      }
    });
    it("groups: storage, then locals", async () => {
      const d = await at(scene, 11);
      expect(d.tree.map((n) => n.path)).toEqual(["@storage", "@locals"]);
      expect(d.tree[0].children!.map((n) => n.path)).toEqual(["playerList",
        "motd", "totalScore", "totalHits", "players"]);
    });
  });

// (a row's name, how it is found: bugc's slot expressions, ~wordsized
// and ~sum in its regions and keccaks, named as solc's templates are)
it("bugc's storage rows are named as solc's", async () => {
  const p = await testProject();
  const at = await pauseOf(p, "O0", 3);
  const d = await decode(p, at.decoding, at.point);
  const l = layout(d, "storage", {}, { point: await p.point(
    at.decoding.timeline, at.point) });
  const how = Object.fromEntries(l.rows.map((r) => [r.address.slice(-4),
    r.how]));
  expect(how).toMatchObject({ e563: "keccak(slot 0)",
    e564: "keccak(slot 0) + 1", "0cf6": "keccak(slot 1)",
    fb94: "keccak(0x7099…79c8, slot 4)",
    "15f1": "keccak(keccak(0x90f7…b906, slot 4) + 1)" });
});

// (a struct local, bugc's copy of the caller's record: its fields from
// memory, each its own region, `player-score` …; alice before her third
// hit is written back: the middle of the game's record, plays already
// counted)
it.each([["stepper-O0", 548], ["optimized-locals", 402]] as const)(
  "%s: play()'s player, a struct in memory, field by field",
  async (b, step) => {
    const p = await testProject();
    const run = `run:${b}`;
    const src = await p.source(run);
    const k = src.moments.findIndex((m) => m.tx === 12 && m.step === step);
    const d = await decode(p, p.decodings[run], `${run}:${k}`);
    const pl = d.byPath.get("player")!;
    expect(pl.children!.map((c) => c.label)).toEqual(["score", "combo",
      "bestCombo", "plays", "hits", "lastBlock", "name"]);
    expect(text(d, "player.name")).toBe('"alice"');
    expect(text(d, "player.score")).toBe("30");
    expect(d.byPath.get("player.score")!.regions[0].location)
      .toBe("memory");
  });
