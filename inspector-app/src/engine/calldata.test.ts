import { it, expect } from "vitest";
import { fixture } from "../../test/io";
import { abiParts } from "./calldata";

const motd = fixture("arcade-motd");

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
  + "bytes; the dump's rows: one stream from byte 0, a word a row",
  async () => {
    const { testProject } = await import("../../test/project");
    const { decode } = await import("./decode");
    const { layout, rowLabel } = await import("./layout");
    const { byteKey } = await import("./hex");
    const p = await testProject();
    const d = await decode(p, p.decodings["abi:motd"], "motd:1");
    // (paths by the parameter's name, as vanilla's tree: text.length;
    // each node keeps its ABI part's id)
    expect([...d.byPath.keys()]).toEqual(["selector", "text", "text.offset",
      "text.length", "text.bytes"]);
    expect([...d.byPath.values()].map((n) => n.part)).toEqual(["selector",
      "m", "m-offset", "m-length", "m-data"]);
    expect(d.byPath.get("text.length")!.value!.text).toBe("5");
    const tl = await p.timeline(p.decodings["abi:motd"].timeline);
    const point = tl.points.find((x) => x.id === "motd:1");
    // (the whole call's input: 100 bytes, its rows to 0x0060)
    const l = layout(d, "calldata", {}, { point });
    // (calldata is offset-addressed: rows only lay it out, from 0x0000
    // by a word; the ABI's words start at byte 4 and cross them)
    expect(l.rows.map((r) => [r.address, r.how, !!r.gapBefore])).toEqual([
      ["0x0000", "calldata 0x0000", false],
      ["0x0020", "calldata 0x0020", false],
      ["0x0040", "calldata 0x0040", false],
      ["0x0060", "calldata 0x0060", false]]);
    expect(rowLabel(l.rows[1])).toBe(
      "calldata 0x0020 : offset · length");
    // (byte 40: row 0x0020's byte 8, the length's)
    expect(l.cover.get(byteKey("calldata", "0x0020", 8))).toEqual(
      ["text.length"]);
    // (the selector: row 0x0000's bytes 0-3; the offset from byte 4)
    expect(l.cover.get(byteKey("calldata", "0x0000", 3))).toEqual(
      ["selector"]);
    expect(l.cover.get(byteKey("calldata", "0x0000", 4))).toEqual(
      ["text.offset"]);
  });
