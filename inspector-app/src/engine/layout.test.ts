import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { layout } from "./layout";
import { slotHex, byteKey } from "./hex";

it("slot 2 holds rounds, then total, in byte order", async () => {
  const p = await testProject();
  const d = await decode(p, p.decodings["sol:arcade-mid"],
    "arcade-mid:after");
  const l = layout(d, "storage", { rows: "values" });
  const row = l.rows.find((r) => r.address === slotHex(2n))!;
  expect(row.what.map((w) => w.name)).toEqual(["rounds", "total"]);
  expect(row.how).toBe("slot 2");
  expect([...l.owned.get("total")!]).toEqual(Array.from({ length: 16 },
    (_, i) => byteKey("storage", slotHex(2n), 16 + i)));
  expect(l.cover.get(byteKey("storage", slotHex(2n), 31)))
    .toEqual(["total"]);
  expect(l.cover.get(byteKey("storage", slotHex(2n), 8)))
    .toEqual(["rounds"]);
});
