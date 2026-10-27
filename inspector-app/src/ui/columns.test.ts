import { it, expect } from "vitest";
import { columnsOf } from "./columns";
import { lenses } from "../lenses";

const of = (id: string) => columnsOf(lenses.find((l) => l.id === id)!);

it("a lens's columns: declared, or its grid's widest row", () => {
  expect(of("inspector")).toBe(2);
  expect(of("stepper")).toBe(2);
  expect(of("reveal")).toBe(2);
});
