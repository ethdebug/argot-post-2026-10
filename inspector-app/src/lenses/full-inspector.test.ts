import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { initialState } from "../ui/Lens";
import { resolveRef } from "../ui/hooks";
import { fullInspector } from "./full-inspector";

it("$scene and its moments resolve to the scene's points", async () => {
  const p = await testProject();
  const at = (id: string, scene: string) => {
    const s = { ...initialState(fullInspector, p), scene,
      moment: p.bookmarks.find((b) => b.id === scene)!.points.length - 1 };
    const v = fullInspector.views.find((x) => x.id === id)!;
    return "data" in v ? resolveRef(v.data, s, p) : undefined;
  };
  // (one moment: no moment before it)
  expect(at("after", "mid")).toEqual({ decoding: "mid", point: "mid:0" });
  expect(at("before", "mid")).toBeUndefined();
  expect(at("tree", "mid")).toEqual(at("after", "mid"));
  // (two: the previous, the current)
  expect(at("before", "alice")).toEqual({ decoding: "alice",
    point: "alice:0" });
  expect(at("after", "alice")).toEqual({ decoding: "alice",
    point: "alice:1" });
});
