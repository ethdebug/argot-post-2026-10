// fixtures/raw.json: the raw lens's one moment, loaded as a timeline
// of one point; its stack, top first, as a dump's rows
import { it, expect } from "vitest";
import fs from "node:fs";
import { testProject } from "../../../test/project";
import { decode } from "../decode";
import { layout } from "../layout";
import { allRows, rowBytes } from "../location";

const json = JSON.parse(fs.readFileSync(new URL(
  "../../../../demos/inspector/fixtures/raw.json", import.meta.url), "utf8"));

it("raw.json: one point inside carol's join, its state whole", async () => {
  const p = await testProject();
  const t = await p.timeline("raw");
  expect(t.points.map((x) => x.id)).toEqual(["raw"]);
  const s = t.points[0].snapshot;
  expect(s.stack).toEqual(json.stack);
  expect(s.storage.size).toBe(Object.keys(json.storage).length);
  expect(s.memory!.length).toBe((json.memory.length - 2) / 2);
  expect(s.calldata!.slice(0, 4)).toEqual(Uint8Array.from([0x6a, 0x78,
    0x6b, 0x07]));                                  // join(string)
  expect(t.points[0].paused).toMatchObject({ step: json.step.index,
    op: json.step.op });
  // (her name half written: its first text word stored, not yet its
  // length)
  const text = Buffer.from("carol, the unstoppable combo que")
    .toString("hex");
  expect([...s.storage.values()].some((w) => w === `0x${text}`)).toBe(true);
});

it("the raw decoding names nothing; its rows are the point's all", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings.raw, "raw");
  expect(d.tree).toEqual([]);
  const at = (await p.timeline("raw")).points[0];
  const rows = (l: "storage" | "stack" | "memory") =>
    layout(d, l, { rows: "all" }, { point: at }).rows;
  expect(rows("storage").map((r) => r.address))
    .toEqual(Object.keys(json.storage));
  expect(rows("memory").map((r) => r.address))
    .toEqual(["0x0000", "0x0020", "0x0040"]);
  // the stack: a row an item, the top first, 0, 1, … from the top
  const st = rows("stack");
  expect(st.length).toBe(json.stack.length);
  expect(st.map((r) => BigInt(r.address))).toEqual(json.stack.map(
    (_: string, k: number) => BigInt(k)));
  expect(st[0].how).toBe("stack 0");
  expect(rowBytes(at.snapshot, "stack", st[0].address).join(""))
    .toBe(json.stack.at(-1).slice(2));
  expect(rowBytes(at.snapshot, "stack", st.at(-1)!.address).join(""))
    .toBe(json.stack[0].slice(2));
  expect(allRows(at.snapshot, "stack").length).toBe(json.stack.length);
  // (nothing owns a byte)
  expect(layout(d, "storage", { rows: "all" }, { point: at }).cover.size)
    .toBe(0);
});
