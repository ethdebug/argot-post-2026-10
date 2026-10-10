import { it, expect } from "vitest";
import { narrowAreas } from "./narrow";
import { fullInspector } from "../lenses/full-inspector";
import { vyper } from "../lenses/vyper";

it("one column: row by row, dumps first, a spanning area at its end",
  () => {
    expect(narrowAreas(fullInspector.grid, fullInspector.areas)).toBe(
      '"contract" "pick" "time" "bar" "rows" "dump" "tree"');
    expect(narrowAreas(vyper.grid, vyper.areas))
      .toBe('"t1" "t2" "d"');
  });
