import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { dereference, Data, evaluate } from "./lib";
import type { Machine } from "./lib";

it("the tarballs are the pinned ones", () => {
  const pin = fs.readFileSync("vendor/PIN", "utf8");
  const tgz = fs.readdirSync("vendor").filter((f) => f.endsWith(".tgz"));
  expect(tgz).toHaveLength(4);
  for (const f of tgz) {
    expect(pin).toContain(createHash("sha256")
      .update(fs.readFileSync(`vendor/${f}`)).digest("hex"));
  }
  expect(pin).toContain("ba31f0a81");
});

it("dereferences a storage region", async () => {
  const c = await dereference({ location: "storage", slot: 2,
    offset: 16, length: 16 } as never);
  const word = Data.fromHex("0x" + "00".repeat(30) + "0028");
  const state = { storage: { read: async () => word },
    stack: { length: Promise.resolve(0n) } } as unknown as Machine.State;
  const { regions } = await c.view(state);
  expect(regions[0]).toMatchObject({ offset: Data.fromNumber(16) });
});

it("exposes the evaluator", async () => {
  const v = await evaluate({ "~sum": [1, 2] } as never,
    { state: {} as never, regions: {}, variables: {} });
  expect(v).toEqual({ sort: "integer", value: 3n });
});
