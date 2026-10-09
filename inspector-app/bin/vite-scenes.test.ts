import { describe, expect, it } from "vitest";
import { snapshotter } from "./vite-scenes";
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
