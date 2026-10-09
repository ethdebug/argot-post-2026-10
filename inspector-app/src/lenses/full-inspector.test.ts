import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { initialState } from "../ui/Lens";
import { resolveRef } from "../ui/hooks";
import { fullInspector } from "./full-inspector";

it("$scene and its moments resolve to the scene's points", async () => {
  const p = await testProject();
  const at = (id: string, scene: string, compare = false) => {
    const s = { ...initialState(fullInspector, p), scene,
      moment: p.bookmarks.find((b) => b.id === scene)!.points.length - 1 };
    const v = fullInspector.views.find((x) => x.id === id)!;
    const ref = compare ? "compare" in v ? v.compare : undefined
      : "data" in v ? v.data : undefined;
    return ref ? resolveRef(ref, s, p) : undefined;
  };
  // (one moment: none before it to compare with)
  expect(at("after", "mid")).toEqual({ decoding: "mid", point: "mid:0" });
  expect(at("after", "mid", true)).toBeUndefined();
  expect(at("tree", "mid")).toEqual(at("after", "mid"));
  // (two: the current, compared with the previous)
  expect(at("after", "alice", true)).toEqual({ decoding: "alice",
    point: "alice:0" });
  expect(at("after", "alice")).toEqual({ decoding: "alice",
    point: "alice:1" });
});
