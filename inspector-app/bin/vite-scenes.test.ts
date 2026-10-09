import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { snapshotter, writeScene } from "./vite-scenes";
import { scenes } from "../src/scenes";
import { snapshotOf } from "../src/engine/source";

describe("snapshotter", () => {
  it("makes one file per scene, each its scene's", async () => {
    const make = snapshotter();
    for (const s of scenes) {
      const f = snapshotOf(JSON.parse(await make(s.id)));
      expect(f.scene.id).toBe(s.id);
    }
  });
  it("throws when a run's digest is not digests.json's", async () => {
    const make = snapshotter({ digests: () => ({ sol: "0".repeat(64) }) });
    await expect(make("mid")).rejects.toThrow(/digest/);
  });
});

describe("writeScene", () => {
  const mid = JSON.parse(fs.readFileSync("scenes/mid.json", "utf8"));
  it("writes scenes/<id>.json only, of that id", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scenes-"));
    const s = { ...mid, id: "pinned-1" };
    expect(writeScene(dir, "pinned-1", s)).toBe(path.join(dir,
      "pinned-1.json"));
    expect(fs.readdirSync(dir)).toEqual(["pinned-1.json"]);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "pinned-1.json"),
      "utf8")).id).toBe("pinned-1");
  });
  it("refuses a path, a dot-dot, another id, or no scene", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scenes-"));
    for (const id of ["a/b", "..", "../x", "x.json", "", "A"]) {
      expect(() => writeScene(dir, id, { ...mid, id }), id).toThrow();
    }
    expect(() => writeScene(dir, "mid2", mid)).toThrow(/id/);
    expect(() => writeScene(dir, "x", { id: "x" })).toThrow();
    expect(fs.readdirSync(dir)).toEqual([]);
  });
});
