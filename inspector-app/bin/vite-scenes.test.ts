import { describe, expect, it } from "vitest";
import { snapshotter } from "./vite-scenes";
import { scenes } from "../src/scenes";
import { snapshotOf } from "../src/engine/source";

describe("snapshotter", () => {
  // (every scene's snapshot, a replay's every step decoded: about 3s on
  // a laptop, five times that on a CI runner, near the default 15s)
  it("makes one file per scene, each its scene's", async () => {
    const make = snapshotter();
    for (const s of scenes) {
      const f = snapshotOf(JSON.parse(await make(s.id)));
      expect(f.scene.id).toBe(s.id);
    }
  }, 60_000);
  it("throws when a run's digest is not digests.json's", async () => {
    const make = snapshotter({ digests: () => ({ sol: "0".repeat(64) }) });
    await expect(make("pitfall-nesting")).rejects.toThrow(/digest/);
  });
});
