import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { initialState } from "../ui/Lens";
import { resolveRef } from "../ui/hooks";
import { fullInspector } from "./full-inspector";

it("$bm and the point slots resolve to the bookmark's points",
  async () => {
    const p = await testProject();
    const s = initialState(fullInspector, p);
    const at = (id: string) => {
      const v = fullInspector.views.find((x) => x.id === id)!;
      return "data" in v ? resolveRef(v.data, s, p) : undefined;
    };
    expect(at("before")).toEqual({ decoding: "sol:arcade-mid",
      point: "arcade-mid:after" });
    expect(at("after")).toEqual(at("before"));
    expect(at("tree")).toEqual(at("after"));
  });
