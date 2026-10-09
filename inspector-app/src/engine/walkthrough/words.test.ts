import { it, expect } from "vitest";
import { testProject } from "../../../test/project";
import { decode } from "../decode";
import { walkthrough } from "./fold";
import { constructOf, FOOT, footOf, placeOf } from "./words";

it("each step: its construct, its place, at most one spec page",
  async () => {
    const p = await testProject();
    const dc = p.decodings["mid"];
    const d = await decode(p, dc, "mid:0");
    const t = await p.timeline("scene:mid");
    const w = walkthrough({ d, c: await p.compilation(dc.compilation),
      snap: t.points[0].snapshot, keys: dc.keys }, "players")!;
    // (one axis for what a step is about; its place, start to done)
    expect(w.steps.map(constructOf)).toEqual(["", "input", "declared",
      "template", "define", "region", "define", "region", "if", "region",
      "region", ""]);
    expect(w.steps.map((_, k) => placeOf(w.steps, k))).toEqual(["start",
      "1 / 10", "2 / 10", "3 / 10", "4 / 10", "5 / 10", "6 / 10", "7 / 10",
      "8 / 10", "9 / 10", "10 / 10", "done"]);
    const notes = w.steps.map(footOf);
    expect(notes.filter(Boolean).every((n) => FOOT[n!][1].startsWith(
      "https://ethdebug.github.io/format/spec/pointer/"))).toBe(true);
    expect(notes[2]).toBe("pointer");
  });
