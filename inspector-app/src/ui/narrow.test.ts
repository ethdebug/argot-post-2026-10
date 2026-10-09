import { it, expect } from "vitest";
import { narrowAreas } from "./narrow";
import { fullInspector } from "../lenses/full-inspector";
import { vyper } from "../lenses/vyper";
import { insideOnePlay } from "../lenses/inside-one-play";

it("one column: row by row, dumps first, a spanning area at its end",
  () => {
    expect(narrowAreas(fullInspector.grid, fullInspector.areas)).toBe(
      '"contract" "pick" "time" "bar" "rows" "dump" "tree" "cdump" "ctree" ' +
      '"cdetails" "chow"');
    expect(narrowAreas(vyper.grid, vyper.areas))
      .toBe('"t1" "t2" "d1" "d2"');
    expect(narrowAreas(insideOnePlay.grid, insideOnePlay.areas)).toBe(
      '"meta" "level" "point" "viewing" "note" "bar" "rows" "dump" ' +
      '"sdump" "tree" "legend" "src"');
  });
