import { it, expect } from "vitest";
import { vtName } from "./transition";

it("a row's transition name is its location's: storage 3 is not stack 3",
  () => {
    const s = vtName("k", "dump", "storage", "0x03");
    expect(s).not.toBe(vtName("k", "dump", "stack", "0x03"));
    expect(s).toMatch(/^vt-[0-9a-z]+-[0-9a-z]+$/);
  });
