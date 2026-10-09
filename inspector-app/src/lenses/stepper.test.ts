// The bugc stepper's scenes (T8.1): inside carol's join, `name` is a
// string calldata reference; its pointer's data is the call's bytes, NAME_C
import { describe, expect, it } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "../engine/decode";
import { NAME_C } from "../../test/expect";

const NAME_HEX = `0x${Buffer.from(NAME_C, "utf8").toString("hex")}`;

describe.each(["stepper-O0", "optimized-locals"])("%s", (scene) => {
  it("everything in scope; the name, sliced from the call, is its " +
    "calldata bytes, NAME_C", async () => {
    const p = await testProject();
    const d = await decode(p, p.decodings[scene], `${scene}:1`);
    expect(d.tree.map((n) => n.path)).toEqual(["@storage", "@locals"]);
    const name = d.byPath.get("name")!;
    // (a string calldata reference: text)
    expect(name.typeText).toBe("string");
    expect(name.value?.text).toBe(`"${NAME_C}"`);
    expect(name.value?.hex).toBe(NAME_HEX);
    const data = name.regions.find((r) => r.location === "calldata")!;
    expect([data.offset, data.length]).toEqual([68,
      Buffer.byteLength(NAME_C)]);
    // (its length: the word's low half, read in memory)
    expect(name.reads?.some((r) => r.location === "memory") ||
      name.regions.some((r) => r.location === "memory")).toBe(true);
  });
});
