import { it, expect } from "vitest";
import fs from "node:fs";
import { abiParts } from "./calldata";

const motd = JSON.parse(fs.readFileSync("static/fixtures/arcade-motd.json",
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
