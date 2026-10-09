import { it, expect } from "vitest";
import { fsIo } from "../../test/io";
import type { Io } from "./io";
import { load } from "./project";
import { decode } from "./decode";
import { builds, page, scenes } from "../scenes";
import { readerProject } from "../../test/project";

const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";

it("loads nothing until a scene is asked "
  + "for; then its snapshot, once", async () => {
  const seen: string[] = [];
  const io = { ...fsIo(), json: <T>(q: string) => (seen.push(q),
    q.startsWith("snapshots/") ? Promise.reject(new Error("HTTP 404"))
      : fsIo().json<T>(q)) };
  const p = await load(io as Io, { scenes, builds, page });
  expect(seen).toEqual([]);
  expect(p.bookmarks.map((b) => b.id))
    .toEqual(["raw-hero", "reveal",
      "raw-named", "pitfall-nesting", "mid", "alice", "motd", "vyper",
      "pointer-walkthrough", "alice-plays", "pitfall-compiler", "stepper-O0",
      "optimized-locals"]);
  await expect(p.timeline("scene:mid")).rejects.toThrow("404");
  // (a failed load is not kept: asked again, it loads again)
  await expect(p.timeline("scene:mid")).rejects.toThrow("404");
  expect(seen).toEqual(["snapshots/mid.json",
    "snapshots/mid.json"]);
});

it("a scene is a bookmark: its moments are the points", async () => {
  const p = await readerProject();
  const by = (id: string) => p.bookmarks.find((b) => b.id === id)!;
  const [mid, alice] = [by("mid"), by("alice")];
  expect(mid).toMatchObject({ points: ["mid:0"], timeline: "scene:mid",
    decoding: "mid", select: A });
  expect(alice).toMatchObject({ side: "after",
    points: ["alice:0", "alice:1"] });
  expect(p.decodings.mid).toEqual({ id: "mid", compilation: "arcade-sol",
    timeline: "scene:mid", variables: "state",
    keys: { from: "list", path: "playerList" } });
  // (Vyper's: solc's rule over another compiler's storage, its keys
  // hashed with Vyper's slot, Vyper's own reading beside it)
  expect(p.decodings.vyper.keys).toEqual({ from: "trace",
    slot: `0x${"6c".padStart(64, "0")}` });
  expect(p.decodings.vyper.foreign).toEqual({ language: "vyper",
    rule: "vyper/rule" });
  const t = await p.timeline("scene:alice");
  expect(t.points.map((x) => [x.id, x.label])).toEqual([
    ["alice:0", "in the middle of the game"],
    ["alice:1", "after alice's third hit"]]);
});

it("a point's snapshot is that moment's storage", async () => {
  const p = await readerProject();
  const t = await p.timeline("scene:alice");
  const slot2 = ("0x" + "2".padStart(64, "0")) as `0x${string}`;
  expect(t.points[0].snapshot.storage.get(slot2)?.slice(-2)).toBe("8c");
  expect(t.points[1].snapshot.storage.get(slot2)?.slice(-2)).toBe("aa");
  expect((await p.compilation("arcade-sol")).stateVariables
    .map((v) => v.identifier))
    .toEqual(["playerList", "motd", "totalScore", "totalHits", "players"]);
});

it("each scene's compilations, whatever the load order", async () => {
  const p = await readerProject();
  await p.timeline("scene:vyper");
  expect((await p.compilation("arcade-sol-players")).stateVariables
    .map((v) => v.identifier)).toEqual(["players"]);
  expect((await p.compilation("arcade-vy-rule")).provenance)
    .toBe("hand-written");
  const d = await decode(p, p.decodings.mid, "mid:0");
  expect(d.tree.map((n) => n.path))
    .toEqual(["playerList", "motd", "totalScore", "totalHits", "players"]);
});
