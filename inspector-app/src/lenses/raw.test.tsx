// @vitest-environment jsdom
// The raw lens: its dumps of the one moment, bare (no names, no tints,
// no popovers, no hover meaning), and the Dump's display parameters
import { it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Lens } from "../ui/Lens";
import { abbreviated } from "../ui/Dump";
import { testProject } from "../../test/project";
import { rawLenses } from "./raw";
import type { LensSpec } from "../ui/types";

afterEach(cleanup);
// (the scene's moment, from the run: its stack, top last; its storage;
// its calldata)
const moment = async () => {
  const p = await testProject();
  const { snapshot: s } = (await p.timeline("scene:raw-hero")).points[0];
  const hex = (b: Uint8Array) => `0x${Buffer.from(b).toString("hex")}`;
  return { stack: s.stack!, storage: Object.fromEntries(s.storage),
    calldata: hex(s.calldata!) };
};
const slow = { timeout: 5000 };
const view = (c: HTMLElement, l: string) =>
  c.querySelector<HTMLElement>(`.view[data-view$=":${l}"]`);

for (const spec of rawLenses) {
  it(`${spec.id}: three bare dumps; the stack top first`, async () => {
    const project = await testProject();
    const json = await moment();
    const { container: c } = render(<Lens spec={spec} project={project} />);
    await waitFor(() => expect(c.querySelectorAll(
      '.view[data-view$=":stack"] .wrow[data-slot]').length)
      .toBe(json.stack.length), slow);
    await waitFor(() => expect(c.querySelectorAll(".view .rows .wrow")
      .length).toBeGreaterThan(json.stack.length), slow);
    // the stack: 0, 1, … from the top; each word abbreviated, one row
    const st = view(c, "stack")!;
    const addrs = [...st.querySelectorAll(".wrow .addr .a")]
      .map((a) => a.textContent);
    expect(addrs).toEqual(json.stack.map((_: string, k: number) => `${k}`));
    expect(st.querySelector(".wrow .ab")!.textContent)
      .toBe(abbreviated(json.stack.at(-1)!.slice(2).match(/../g)!, 3));
    // the others the same dump: words of 32 bytes; no ruler anywhere
    // (memory: one run of bytes, 16 a line, each line its offset)
    const mem = view(c, "memory")!;
    expect(mem.classList.contains("flow")).toBe(true);
    const lines = [...mem.querySelectorAll(".wrow")];
    expect(lines.length).toBeGreaterThan(1);
    for (const r of lines) {
      expect(r.querySelectorAll(".b").length).toBeLessThanOrEqual(16);
    }
    expect(lines[1].querySelector(".a")!.textContent).toBe("0x0010");
    for (const l of ["storage"]) {
      expect(view(c, l)!.querySelector(".wrow[data-slot] .word")!
        .querySelectorAll(".b").length).toBe(32);
    }
    expect(c.querySelector(".ruler")).toBeNull();
    // storage: every slot that holds something, each its word; ⋯ where
    // the slots jump
    const sto = view(c, "storage")!;
    const word = (slot: string) => [...sto.querySelectorAll(
      `.wrow[data-slot="${slot}"] .b`)].map((b) => b.textContent).join("");
    for (const [slot, w] of Object.entries(json.storage)) {
      if (/^0x0*$/.test(w)) continue;
      expect(word(slot), slot).toBe(w.slice(2));
    }
    // (its all-zero rows folded into the gaps: only the written slots)
    const shown = [...sto.querySelectorAll<HTMLElement>(".wrow[data-slot]")];
    for (const r of shown) expect(word(r.dataset.slot!)).not.toMatch(/^0+$/);
    expect(sto.querySelectorAll(".gap").length).toBeGreaterThan(0);
    // no names, tints, popovers, tree; nothing to point at
    expect(c.querySelector(".b[data-owners], .b[class*=' t'], .b.free"))
      .toBeNull();
    expect(c.querySelector(".tree, .pop, [tabindex], [role=button]"))
      .toBeNull();
    fireEvent.pointerOver(sto.querySelector(".b")!);
    fireEvent.click(sto.querySelector(".b")!);
    expect(c.querySelector(".hl, .on, .chosen, .active, .pop")).toBeNull();
  });
}

it("abbreviation: a word's first and last bytes, padded to 32: one width",
  () => {
  const w = (h: string) => h.padStart(64, "0").match(/../g)!;
  expect(abbreviated(w("53c8a5ff9979"), 3)).toBe("0x00…ff9979");
  expect(abbreviated(w("1420"), 3)).toBe("0x00…001420");
  expect(abbreviated(w("22"), 3)).toBe("0x00…000022");
  expect(abbreviated(w("ab".repeat(32)), 3)).toBe("0xab…ababab");
  // (a short word, its bytes the low end's)
  expect(abbreviated(["14", "20"], 3)).toBe("0x00…001420");
});

it("the display parameters: scale, perLine, rows shape", async () => {
  const project = await testProject();
  const json = await moment();
  const spec: LensSpec = { id: "p", title: "P", timelines: [],
    decodings: [], links: [], initial: { scene: "raw-hero" }, grid: '"a b"', views: [
      { id: "a", kind: "dump", area: "a", location: "calldata",
        data: { decoding: "$scene", moment: "current" }, filter: { rows: "all" },
        display: { bare: true, density: "flow", perLine: 8, scale: 2 } },
      { id: "b", kind: "dump", area: "b", location: "stack",
        data: { decoding: "$scene", moment: "current" },
        display: { bare: true } }] };
  const { container: c } = render(<Lens spec={spec} project={project} />);
  await waitFor(() => expect(c.querySelectorAll(
    '[data-area="b"] .wrow[data-slot]').length).toBe(json.stack.length),
  slow);
  await waitFor(() => expect(c.querySelectorAll('[data-area="a"] .wrow')
    .length).toBeGreaterThan(0), slow);
  const a = view(c, "a")!;
  expect(a.querySelector<HTMLElement>(".rows")!.style.fontSize).toBe("2em");
  const lines = a.querySelectorAll(".wrow");
  expect(lines.length).toBe(Math.ceil((json.calldata.length - 2) / 16));
  // (play()'s calldata: its selector, 4 bytes on one line)
  const n = (json.calldata.length - 2) / 2;
  expect(lines[0].querySelectorAll(".b").length).toBe(Math.min(n, 8));
  expect(lines[0].querySelector(".a")!.textContent).toBe("0x0000");
  // (no shape, no abbreviation: whole words, 32 bytes a row, a ruler)
  const b = view(c, "b")!;
  expect(b.querySelectorAll(".wrow[data-slot]").length)
    .toBe(json.stack.length);
  expect(b.querySelector(".wrow[data-slot] .word")!
    .querySelectorAll(".b").length).toBe(32);
  expect(b.querySelector(".ruler")).not.toBeNull();
});
