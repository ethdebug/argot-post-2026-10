import { it, expect } from "vitest";
import { parse } from "yaml";
import { testProject } from "../../test/project";
import { pointerText } from "./pointer-text";

const players = async () => {
  const p = await testProject();
  return pointerText(await p.compilation("sol@arcade-mid"), "players");
};

it("players: its pointer, then its templates, names shortened", async () => {
  const { lines, names } = await players();
  const text = lines.map((l) => l.text);
  expect(text[0]).toBe("players:");
  expect(text).toContain("  slot: 0x03");
  expect(text).toContain("mapping(address => Player):");
  expect(text).toContain("  expect: [slot, key]");
  expect(text.some((l) => l.includes("~keccak256"))).toBe(true);
  expect(text.some((l) => l.trim() === "else:")).toBe(true);
  expect(names).toMatchObject({
    "t_struct$_Player_$16_storage": "Player",
    "t_string_storage": "string" });
});

it("keys in the spec's order: if, then, else; a region's name first",
  async () => {
    const { lines } = await players();
    const at = (k: string) => lines.findIndex((l) =>
      l.text.trim().replace(/^- /, "").startsWith(k));
    expect(at("if:")).toBeLessThan(at("then:"));
    expect(at("then:")).toBeLessThan(at("else:"));
    // (a region too long for one line: block style, its name first)
    const k = lines.findIndex((l) => l.text.includes("name: score"));
    expect(lines.slice(k, k + 3).map((l) => l.text.trim()))
      .toEqual(["- name: score", "location: storage", "slot: slot"]);
  });

it("one line each, none wider than 80, in flow or block style", async () => {
  const { lines } = await players();
  expect(lines.every((l) => l.text.length <= 80 + 20)).toBe(true);
  // (a long expression goes in block style: operator, then operands)
  expect(lines.some((l) => l.text.trim() === "~keccak256:")).toBe(false);
  const doc = parse(lines.map((l) => l.text).join("\n"));
  expect(doc.players).toEqual({ location: "storage", slot: 3 });
  expect(doc.Player.expect).toEqual(["slot"]);
});

it("each line knows its place: block | path", async () => {
  const { lines } = await players();
  const slot = lines.find((l) => l.text === "  slot: 0x03")!;
  expect(slot.pos).toBe("|slot");
  const expectL = lines.find((l) => l.text === "  expect: [slot, key]")!;
  expect(expectL.pos)
    .toBe("t_mapping$_t_address_$_t_struct$_Player_$16_storage_$|expect");
});
