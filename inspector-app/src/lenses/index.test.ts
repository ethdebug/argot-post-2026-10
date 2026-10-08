import { it, expect } from "vitest";
import { lenses } from "./index";

it("every lens: a unique id, and unique view ids", () => {
  const ids = lenses.map((l) => l.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const l of lenses) {
    const vs = l.views.map((v) => v.id);
    expect(new Set(vs).size, l.id).toBe(vs.length);
  }
});
