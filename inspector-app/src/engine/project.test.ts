import { it, expect } from "vitest";
import { fsIo } from "../../test/io";
import type { Io } from "./io";
import { load } from "./project";
import { decode } from "./decode";
import { builds, scenes } from "../scenes";
import { readerProject } from "../../test/project";

const A = "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]";

it("loads nothing until a scene is asked "
  + "for; then its snapshot, once", async () => {
  const seen: string[] = [];
  const io = { ...fsIo(), json: <T>(q: string) => (seen.push(q),
    q.startsWith("snapshots/") ? Promise.reject(new Error("HTTP 404"))
      : fsIo().json<T>(q)) };
  const p = await load(io as Io, { scenes, builds });
  expect(seen).toEqual([]);
  expect(p.bookmarks.map((b) => b.id)).toEqual(scenes.map((s) => s.id));
  await expect(p.timeline("scene:pitfall-nesting")).rejects.toThrow("404");
  // (a failed load is not kept: asked again, it loads again)
  await expect(p.timeline("scene:pitfall-nesting")).rejects.toThrow("404");
  expect(seen).toEqual(["snapshots/pitfall-nesting.json",
    "snapshots/pitfall-nesting.json"]);
});

it("a scene is a bookmark: its moments are the points", async () => {
  const p = await readerProject();
  const by = (id: string) => p.bookmarks.find((b) => b.id === id)!;
  expect(by("pitfall-nesting")).toMatchObject({
    points: ["pitfall-nesting:0"], timeline: "scene:pitfall-nesting",
    decoding: "pitfall-nesting", select: A, related: true });
  expect(p.decodings["pitfall-nesting"]).toEqual({ id: "pitfall-nesting",
    compilation: "arcade-sol", timeline: "scene:pitfall-nesting",
    variables: "state", keys: { from: "list", path: "playerList" } });
  // (Vyper's: solc's rule over another compiler's storage, its keys
  // hashed with Vyper's slot, Vyper's own reading beside it)
  expect(p.decodings["pitfall-compiler"].keys).toEqual({ from: "trace",
    slot: `0x${"6c".padStart(64, "0")}` });
  expect(p.decodings["pitfall-compiler"].foreign).toEqual({
    language: "vyper", rule: "pitfall-compiler/rule" });
});

it("a point's snapshot is that moment's storage", async () => {
  const p = await readerProject();
  const t = await p.timeline("scene:pitfall-nesting");
  const slot2 = ("0x" + "2".padStart(64, "0")) as `0x${string}`;
  // (totalScore, 140, in its low bytes)
  expect(t.points[0].snapshot.storage.get(slot2)?.slice(-2)).toBe("8c");
  expect((await p.compilation("arcade-sol")).stateVariables
    .map((v) => v.identifier))
    .toEqual(["playerList", "motd", "totalScore", "totalHits", "players"]);
});

it("each scene's compilations, whatever the load order", async () => {
  const p = await readerProject();
  await p.timeline("scene:pitfall-compiler");
  expect((await p.compilation("arcade-sol-players")).stateVariables
    .map((v) => v.identifier)).toEqual(["players"]);
  expect((await p.compilation("arcade-vy-rule")).provenance)
    .toBe("hand-written");
  const d = await decode(p, p.decodings["pitfall-nesting"],
    "pitfall-nesting:0");
  expect(d.tree.map((n) => n.path))
    .toEqual(["playerList", "motd", "totalScore", "totalHits", "players"]);
});
