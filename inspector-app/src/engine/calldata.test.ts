import { it, expect } from "vitest";
import fs from "node:fs";
import { abiParts } from "./calldata";

const motd = JSON.parse(fs.readFileSync("../demos/inspector/fixtures/arcade-motd.json",
  "utf8"));

it("setMotd(string)'s calldata, by the ABI: selector, head, length, "
  + "bytes", () => {
  const cd = abiParts(motd.tx.input, "text");
  // (keccak256("setMotd(string)"), first 4 bytes)
  const sel = "0x5fe59b9d";
  expect(cd.parts.map((p) => [p.id, p.label, p.from, p.to, p.value]))
    .toEqual([
      ["selector", "selector", 0, 3, sel],
      ["m-offset", "text (offset)", 4, 35, "32"],
      ["m-length", "text (length)", 36, 67, "5"],
      ["m-data", "text (bytes)", 68, 72, '"gl hf"'],
    ]);
  expect(cd.bytes.length).toBe(100);
  expect([cd.offset, cd.lenAt, cd.dataAt, cd.text])
    .toEqual([32, 36, 68, "gl hf"]);
  expect(cd.partAt(40)?.id).toBe("m-length");
  expect(cd.partAt(80)).toBeUndefined();
});

it("as a decoding: the selector and the parameter's parts, each its "
  + "bytes; the dump's rows: the selector, then words from byte 4",
  async () => {
    const { testProject } = await import("../../test/project");
    const { decode } = await import("./decode");
    const { layout, rowLabel } = await import("./layout");
    const { byteKey } = await import("./hex");
    const p = await testProject();
    const d = await decode(p, p.decodings["abi:motd"], "arcade-motd:after");
    // (paths by the parameter's name, as vanilla's tree: text.length;
    // each node keeps its ABI part's id)
    expect([...d.byPath.keys()]).toEqual(["selector", "text", "text.offset",
      "text.length", "text.bytes"]);
    expect([...d.byPath.values()].map((n) => n.part)).toEqual(["selector",
      "m", "m-offset", "m-length", "m-data"]);
    expect(d.byPath.get("text.length")!.value!.text).toBe("5");
    const l = layout(d, "calldata");
    // (the selector's row, then words from byte 4; named "calldata …")
    expect(l.rows.map((r) => [r.address, r.how, !!r.gapBefore])).toEqual([
      ["0x0000", "calldata 0x0000", false],
      ["0x0004", "calldata 0x0004", false],
      ["0x0024", "calldata 0x0024", false],
      ["0x0044", "calldata 0x0044", false]]);
    expect(rowLabel(l.rows[2])).toBe("calldata 0x0024 : text.length");
    // (byte 40: word 0x0024's byte 4, the length's)
    expect(l.cover.get(byteKey("calldata", "0x0024", 4))).toEqual(
      ["text.length"]);
  });
