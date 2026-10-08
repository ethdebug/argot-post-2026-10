import { it, expect } from "vitest";
import { testProject } from "../../../test/project";
import { decode } from "../decode";
import { walkthrough } from "./fold";
import { FOOT, footOf, shortCap } from "./words";

it("each step: a short caption, at most one footnote, a spec page",
  async () => {
    const p = await testProject();
    const dc = p.decodings["sol:arcade-mid"];
    const d = await decode(p, dc, "arcade-mid:after");
    const t = await p.timeline("arcade-mid");
    const w = walkthrough({ d, c: await p.compilation(dc.compilation),
      snap: t.points[1].snapshot, keys: dc.keys }, "players")!;
    expect(w.steps.map((s) => shortCap(s, "players"))).toEqual([
      "what we're about to find", "the keys", "`players`' own slot",
      "a template's inputs", "the record's slot", "packed fields",
      "into a template", "a flag", "a branch", "the text", "the text",
      "found"]);
    const notes = w.steps.map(footOf);
    expect(notes.filter(Boolean).every((n) => FOOT[n!][1].startsWith(
      "https://ethdebug.github.io/format/spec/pointer/"))).toBe(true);
    expect(notes[2]).toBe("pointer");
  });
