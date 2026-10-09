import { it, expect } from "vitest";
import { fixture } from "../../../test/io";
import { fromFixture, solcTilde } from "./legacy";

const mid = fixture("arcade-mid");

it("solc's \"$\" expressions read as \"~\" (ethdebug/format#324): keys and "
  + "keyword strings, nowhere else", () => {
  expect(solcTilde({ a: { $keccak256: [{ $wordsized: "key" }, "$wordsize",
    "slot"] }, name: "$x_y", template: "t_x$_y" }))
    .toEqual({ a: { "~keccak256": [{ "~wordsized": "key" }, "~wordsize",
      "slot"] }, name: "~x_y", template: "t_x$_y" });
});

it("the fixture's pointers and templates are in \"~\", at the one place "
  + "solc's output is read", () => {
  const { compilation } = fromFixture(mid, "arcade-mid");
  const text = JSON.stringify([compilation.templates,
    compilation.stateVariables.map((v) => v.pointer)]);
  expect(text).not.toMatch(/"\$[a-z]/);
  expect(text).toContain('"~keccak256"');
  // (types keep their solc ids, "$" and all)
  expect(Object.keys(compilation.types).some((k) => k.includes("$")))
    .toBe(true);
});
