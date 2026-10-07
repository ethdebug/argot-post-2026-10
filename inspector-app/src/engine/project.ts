// The project: the bookmarks and decodings named by fixtures/index.json,
// and the timelines and compilations, fetched when first asked for
import type { Io } from "./io";
import type {
  Compilation, CompilationId, Decoding, DecodingId, Timeline, TimelineId,
} from "./types";
import {
  bookmarkOf, fromFixture, SOL, type LegacyScene, type ProjectBookmark,
} from "./fixtures/legacy";

export interface Project {
  bookmarks: ProjectBookmark[];
  decodings: Record<DecodingId, Decoding>;   // "sol:arcade-mid", …
  timeline(id: TimelineId): Promise<Timeline>;        // memoised fetch
  compilation(id: CompilationId): Promise<Compilation>;
  // the engine's results (decode), per project
  memo: Map<string, Promise<unknown>>;
}

export async function load(io: Io, manifest = "fixtures/index.json"):
  Promise<Project> {
  const scenes = await io.json<LegacyScene[]>(manifest);
  const bookmarks = scenes.map(bookmarkOf);
  const decodings: Record<DecodingId, Decoding> = {};
  for (const b of bookmarks) {
    decodings[b.decoding] = { id: b.decoding, compilation: SOL,
      timeline: b.timeline, variables: "state",
      keys: { from: "list", path: "roster" } };
  }
  const fetched = new Map<TimelineId,
    Promise<{ compilation: Compilation; timeline: Timeline }>>();
  const fixture = (id: TimelineId) => {
    if (!fetched.has(id)) {
      const p = io.json(`fixtures/${id}.json`).then((json) => {
        const out = fromFixture(json, id);
        out.timeline.bookmarks = bookmarks.filter((b) => b.timeline === id);
        return out;
      });
      // (a failed fetch is not kept: the next ask tries again)
      p.catch(() => fetched.get(id) === p && fetched.delete(id));
      fetched.set(id, p);
    }
    return fetched.get(id)!;
  };
  return {
    bookmarks, decodings, memo: new Map(),
    timeline: async (id) => (await fixture(id)).timeline,
    // each fixture holds the contract: the first fixture asked for, or
    // the first bookmark's
    async compilation(id) {
      if (id !== SOL) throw new Error(`no compilation ${id}`);
      const any = [...fetched.values()][0] ?? fixture(bookmarks[0].timeline);
      return (await any).compilation;
    },
  };
}
