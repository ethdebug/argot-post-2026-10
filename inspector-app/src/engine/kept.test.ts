import { describe, expect, it } from "vitest";
import { keep, peek } from "./kept";

describe("a kept promise", () => {
  it("has its value once it resolves, none before or on failure",
    async () => {
      const p = keep(Promise.resolve(7));
      expect(peek(p)).toBeUndefined();
      await p;
      expect(peek(p)).toBe(7);
      const q = keep(Promise.reject(new Error("no")));
      await q.catch(() => {});
      expect(peek(q)).toBeUndefined();
      expect(peek(undefined)).toBeUndefined();
    });
});
