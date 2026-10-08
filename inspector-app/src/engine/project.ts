// The project: the bookmarks and decodings named by fixtures/index.json,
// and the timelines and compilations, fetched when first asked for
import type { Io } from "./io";
import type {
  Compilation, CompilationId, Decoding, DecodingId, Timeline, TimelineId,
} from "./types";
import {
  bookmarkOf, fixtureOf, fromFixture, keySourceOf, solOf,
  type LegacyScene,
  type ProjectBookmark,
} from "./fixtures/legacy";
import { vyperRule } from "./fixtures/vyper-rule";
import { fromMemory } from "./fixtures/memory";

const VY_RULE = "arcade-vy-rule";

export interface Project {
  bookmarks: ProjectBookmark[];
  decodings: Record<DecodingId, Decoding>;   // "sol:arcade-mid", …
  timeline(id: TimelineId): Promise<Timeline>;        // memoised fetch
  compilation(id: CompilationId): Promise<Compilation>;
  // the engine's results (decode), per project
  memo: Map<string, Promise<unknown>>;
}

// (and fixtures/memory.json: the BUG example's pauses, levels and locals)
export async function load(io: Io, manifest = "fixtures/index.json"):
  Promise<Project> {
  const [scenes, memJson] = await Promise.all([
    io.json<LegacyScene[]>(manifest), io.json("fixtures/memory.json")]);
  const mem = fromMemory(memJson);
  const bookmarks = [...scenes.map(bookmarkOf), ...mem.bookmarks];
  const decodings: Record<DecodingId, Decoding> = {};
  for (const b of bookmarks) {
    if (mem.decodings[b.decoding]) continue;
    decodings[b.decoding] = { id: b.decoding, compilation: solOf(b.timeline),
      timeline: b.timeline, variables: "state",
      keys: { from: "trace" } };   // (until its fixture says: below)
  }
  Object.assign(decodings, mem.decodings);
  // Vyper's own layout, over the same storage (hand-written)
  if (decodings.vyAsSol) {
    decodings.vyRule = { id: "vyRule", compilation: VY_RULE,
      timeline: "arcade-vyper", variables: "state", keys: { from: "trace" } };
  }
  const fetched = new Map<TimelineId, Promise<{ compilation: Compilation;
    timeline: Timeline; json: unknown }>>();
  const fixture = (id: TimelineId) => {
    if (!fetched.has(id)) {
      const p = io.json(`fixtures/${id}.json`).then((json) => {
        const out = fromFixture(json, id);
        // (solc's rule over this fixture: its keys as the fixture says;
        // set before any decode, which waits for the timeline first)
        for (const d of Object.values(decodings)) {
          if (d.compilation === solOf(id)) d.keys = keySourceOf(json);
        }
        out.timeline.bookmarks = bookmarks.filter((b) => b.timeline === id);
        return { ...out, json };
      });
      // (a failed fetch is not kept: the next ask tries again)
      p.catch(() => fetched.get(id) === p && fetched.delete(id));
      fetched.set(id, p);
    }
    return fetched.get(id)!;
  };
  return {
    bookmarks, decodings, memo: new Map(),
    timeline: async (id) => mem.timelines.find((t) => t.id === id) ??
      (await fixture(id)).timeline,
    // a fixture's contract: from that fixture
    async compilation(id) {
      const bug = mem.compilations.find((c) => c.id === id);
      if (bug) return bug;
      if (id === VY_RULE) {
        return vyperRule((await fixture("arcade-vyper")).json);
      }
      const f = fixtureOf(id);
      if (!f) throw new Error(`no compilation ${id}`);
      return (await fixture(f)).compilation;
    },
  };
}
