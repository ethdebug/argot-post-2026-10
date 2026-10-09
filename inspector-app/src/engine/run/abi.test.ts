import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { encodeCall, inputOf } from "./abi";
import { MOTD, NAME_C } from "../../../test/expect";

const demo = path.join(__dirname, "..", "..", "..", "..", "demos",
  "inspector");
const bug = fs.readFileSync(path.join(demo, "bug", "arcade.bug"), "utf8");
// the selector arcade.bug compares msg.data[0:4] with, under the
// comment that names the function
const selectorIn = (fn: string) => bug.match(new RegExp(
  `// ${fn.replace(/[()]/g, "\\$&")}[^\\n]*\\n.*?== (0x[0-9a-f]{8})`))![1];

describe("encodeCall", () => {
  it("gives arcade.bug's selectors", () => {
    for (const fn of ["join(string)", "setMotd(string)"]) {
      expect(encodeCall(fn, [""]).slice(0, 10)).toBe(selectorIn(fn));
    }
  });
  it("encodes a string: offset, length, its bytes padded to words", () => {
    const words = encodeCall("join(string)", [NAME_C]).slice(10)
      .match(/.{64}/g)!;
    const n = Buffer.byteLength(NAME_C);
    expect(words.slice(0, 2)).toEqual(["20".padStart(64, "0"),
      n.toString(16).padStart(64, "0")]);
    expect(Buffer.from(words.slice(2).join(""), "hex").toString("utf8")
      .replace(/\0+$/, "")).toBe(NAME_C);
    expect(encodeCall("setMotd(string)", [MOTD[1]]).length)
      .toBe(10 + 64 * 3);
  });
  it("encodes uint, address and bytes", () => {
    const a = "0x70997970c51812dc3a010c7d01b50e0d17dc79c8";
    const out = encodeCall("f(uint256,address,bytes)", [5n, a, "0xabcd"]);
    const words = out.slice(10).match(/.{64}/g)!;
    expect(words).toEqual([
      "5".padStart(64, "0"), a.slice(2).padStart(64, "0"),
      "60".padStart(64, "0"), "2".padStart(64, "0"),
      "abcd".padEnd(64, "0")]);
  });
  it("refuses a type it does not know", () => {
    expect(() => encodeCall("f(uint256[])", [[]])).toThrow(/uint256\[\]/);
  });
});

describe("inputOf", () => {
  it("encodes a call, or takes its input", () => {
    const block = { prevrandao: "0x00" as const };
    expect(inputOf({ label: "play()", from: "alice", kind: "call",
      call: { signature: "play()", args: [] }, block })).toBe("0x93e84cd9");
    expect(inputOf({ label: "x", from: "alice", kind: "call",
      call: { input: "0x1234" }, block })).toBe("0x1234");
    expect(inputOf({ label: "deploy", from: "deployer", kind: "create",
      block })).toBe("0x");
  });
});
