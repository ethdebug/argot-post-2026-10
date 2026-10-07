import { it, expect } from "vitest";
import { createStore } from "./store";

it("sets, and tells its subscribers until they leave", () => {
  const s = createStore({ n: 1 });
  const seen: number[] = [];
  const leave = s.subscribe(() => seen.push(s.get().n));
  s.set((x) => ({ n: x.n + 1 }));
  leave();
  s.set((x) => ({ n: x.n + 1 }));
  expect(seen).toEqual([2]);
  expect(s.get()).toEqual({ n: 3 });
});

it("an unchanged state tells no one", () => {
  const s = createStore({ n: 1 });
  let told = 0;
  s.subscribe(() => told++);
  s.set((x) => x);
  expect(told).toBe(0);
});
