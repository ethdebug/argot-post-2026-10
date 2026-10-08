import { describe, expect, it } from "vitest";
import { moveFor } from "./scroll";

// the view under the sticky panel: 300 to 900 on screen
const v = { top: 300, bottom: 900 };
describe("moveFor: bringing a step's lit rows into view", () => {
  it("does not scroll when they are in view", () => {
    expect(moveFor({ top: 320, bottom: 880 }, v, 24)).toBe(0);
  });
  it("below the view: as little as it takes, with room under them", () => {
    expect(moveFor({ top: 950, bottom: 1000 }, v, 24)).toBe(124);
  });
  it("above the view (under the panel): their top below the panel", () => {
    expect(moveFor({ top: 100, bottom: 140 }, v, 24)).toBe(-224);
  });
  it("taller than the view: their top first", () => {
    expect(moveFor({ top: 800, bottom: 2000 }, v, 24)).toBe(476);
  });
});
