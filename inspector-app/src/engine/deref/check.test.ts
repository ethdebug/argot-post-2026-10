import { it, expect } from "vitest";
import { testProject } from "../../../test/project";
import { decode } from "../decode";
import { dereference } from "../lib";
import { machineState } from "../snapshot";
import { regionsOf, sameAsLibrary } from "./check";

it("throws when a region differs from the library's", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings["mid"],
    "mid:0");
  const g = d.graphs.get("totalScore")!;
  const t = await p.timeline("scene:mid");
  const state = machineState(t.points[0].snapshot);
  const view = await (await dereference({ location: "storage",
    slot: "0x02", offset: "0x10", length: "0x10" } as never, { state }))
    .view(state);
  expect(() => sameAsLibrary(g, view.regions)).not.toThrow();
  const r = regionsOf(g)[0];
  const off = r.offset;
  r.offset = 15;
  expect(() => sameAsLibrary(g, view.regions)).toThrow(/region 0 differs/);
  r.offset = off;
  expect(() => sameAsLibrary(g, [])).toThrow(/library gave 0 regions/);
});
