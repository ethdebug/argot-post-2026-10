import { it, expect } from "vitest";
import { columnsOf } from "./columns";
import { lenses } from "../lenses";
import { debuggerLens } from "../lenses/debugger";

const of = (id: string) => columnsOf(lenses.find((l) => l.id === id)!);

it("a lens's columns: declared, or its grid's widest row", () => {
  expect(of("inspector")).toBe(2);
  expect(of("inside-one-play")).toBe(2);
  expect(of("players-walk")).toBe(1);
  expect(of("raw-hero")).toBe(2);
  expect(columnsOf(debuggerLens)).toBe(2);
});
