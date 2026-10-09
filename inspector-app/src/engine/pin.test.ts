import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { pin, sceneJson, sceneOf, unpin } from "./scene";

const file = (id: string) => fs.readFileSync(path.join(__dirname, "..",
  "..", "scenes", `${id}.json`), "utf8");
const alice = sceneOf(JSON.parse(file("alice")));

describe("pins", () => {
  it("a scene file's text is sceneJson's", () => {
    for (const id of ["mid", "alice", "motd", "raw-hero", "raw-named",
      "raw-annotated"]) {
      expect(sceneJson(sceneOf(JSON.parse(file(id)))), id).toBe(file(id));
    }
  });
  it("pin keeps (tx, step) order; a pinned moment again takes its label",
    () => {
      const a = pin(alice, { tx: 12, step: 40 }, "inside the hit");
      expect(a.timeline.map((m) => [m.tx, m.step])).toEqual([[11, "end"],
        [12, 40], [12, "end"]]);
      // (the moment shown first stays the one it was: after her hit)
      expect(a.initial?.moment).toBe(2);
      const b = pin(a, { tx: 12, step: 40 }, "again");
      expect(b.timeline[1]).toEqual({ tx: 12, step: 40, label: "again" });
      expect(b.timeline).toHaveLength(3);
      expect(sceneOf(JSON.parse(sceneJson(b)))).toEqual(b);
    });
  it("unpin removes one, never the last; one moment: no controls", () => {
    const one = unpin(alice, 1);
    expect(one.timeline).toEqual([alice.timeline[0]]);
    expect(one.controls).toBe("none");
    expect(one.initial?.moment).toBeUndefined();
    expect(unpin(one, 0)).toBe(one);
    expect(pin(one, { tx: 12, step: "end" }).controls).toBe("prev-next");
  });
});
