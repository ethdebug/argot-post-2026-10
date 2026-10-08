import { it, expect } from "vitest";
import { fsIo } from "../../test/io";
import type { Io } from "./io";
import { load } from "./project";
import { decode } from "./decode";

it("loads only the index and the memory pauses until a timeline is "
  + "asked for", async () => {
  const seen: string[] = [];
  const io = { ...fsIo(), json: <T>(q: string) => (seen.push(q),
    fsIo().json<T>(q)) };
  const p = await load(io as Io);
  expect(seen).toEqual(["fixtures/index.json", "fixtures/memory.json"]);
  expect(p.bookmarks.map((b) => b.id))
    .toEqual(["mid", "alice", "motd", "vyper", "O0/roll", "O0/mult",
      "O0/writes", "O2/roll", "O2/mult", "O2/writes"]);
  await p.timeline("arcade-mid");
  await p.timeline("arcade-mid");
  expect(seen).toEqual(["fixtures/index.json", "fixtures/memory.json",
    "fixtures/arcade-mid.json"]);
});

it("a failed timeline is not cached", async () => {
  let fails = 1;
  const io = { ...fsIo(), json: <T>(q: string) =>
    q.endsWith("arcade-mid.json") && fails-- > 0
      ? Promise.reject(new Error("HTTP 503")) : fsIo().json<T>(q) };
  const p = await load(io as Io);
  await expect(p.timeline("arcade-mid")).rejects.toThrow("503");
  const t = await p.timeline("arcade-mid");
  expect(t.points.map((x) => x.id))
    .toEqual(["arcade-mid:before", "arcade-mid:after"]);
});

it("a bookmark names its points, timeline and decoding", async () => {
  const p = await load(fsIo());
  const [mid, alice] = p.bookmarks;
  expect(mid).toMatchObject({ points: ["arcade-mid:after"],
    timeline: "arcade-mid", decoding: "sol:arcade-mid",
    select: "players[0x70997970c51812dc3a010c7d01b50e0d17dc79c8]" });
  expect(alice).toMatchObject({ side: "after", points:
    ["arcade-alice:before", "arcade-alice:after"] });
  // (keys: as the fixture says, `keysIn`, once it is loaded)
  await p.timeline("arcade-mid");
  expect(p.decodings["sol:arcade-mid"]).toEqual({ id: "sol:arcade-mid",
    compilation: "sol@arcade-mid", timeline: "arcade-mid", variables: "state",
    keys: { from: "list", path: "roster" } });
  await p.timeline("arcade-vyper");
  expect(p.decodings.vyAsSol.keys).toEqual({ from: "trace" });
});

it("a point's snapshot is that side's storage", async () => {
  const p = await load(fsIo());
  const t = await p.timeline("arcade-alice");
  const slot2 = ("0x" + "2".padStart(64, "0")) as `0x${string}`;
  expect(t.points[0].snapshot.storage.get(slot2)?.slice(-2)).toBe("28");
  expect(t.points[1].snapshot.storage.get(slot2)?.slice(-2)).toBe("46");
  expect((await p.compilation("sol@arcade-alice")).stateVariables
    .map((v) => v.identifier))
    .toEqual(["roster", "motd", "total", "rounds", "players"]);
});

it("each fixture's contract is its own compilation, whatever the fetch "
  + "order", async () => {
  const p = await load(fsIo());
  await p.timeline("arcade-vyper");
  expect((await p.compilation("sol@arcade-vyper")).stateVariables
    .map((v) => v.identifier)).toEqual(["players"]);
  const d = await decode(p, p.decodings["sol:arcade-mid"],
    "arcade-mid:after");
  expect(d.tree.map((n) => n.path))
    .toEqual(["roster", "motd", "total", "rounds", "players"]);
  expect((await p.compilation("sol@arcade-mid")).stateVariables
    .map((v) => v.identifier))
    .toEqual(["roster", "motd", "total", "rounds", "players"]);
});
