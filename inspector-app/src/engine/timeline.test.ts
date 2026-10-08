import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { A, B } from "../../test/expect";
import { decode } from "./decode";
import { changed, pointsOf, readWritten } from "./timeline";
import { slotHex } from "./hex";

it("alice: score changed, bob's did not", async () => {
  const p = await testProject();
  const d = p.decodings["sol:arcade-alice"];
  const [a, b] = await Promise.all(["before", "after"].map((s) =>
    decode(p, d, `arcade-alice:${s}`)));
  expect(changed(a, b, `${A}.score`)).toBe(true);
  expect(changed(a, b, A)).toBe(true);
  expect(changed(a, b, `${B}.score`)).toBe(false);
  expect(changed(a, b, B)).toBe(false);
  expect(changed(a, b, "players")).toBe(true);
});

it("motd: slot 1 is 'read, written' at motd:after", async () => {
  const p = await testProject();
  const [before, after] = (await p.timeline("arcade-motd")).points;
  expect(readWritten(before, after, slotHex(1n))).toBe("read, written");
  expect(readWritten(before, after, slotHex(2n))).toBe(null);
});

it("a bookmark's points", async () => {
  const p = await testProject();
  expect(pointsOf(p.bookmarks[1]))
    .toEqual(["arcade-alice:before", "arcade-alice:after"]);
});
