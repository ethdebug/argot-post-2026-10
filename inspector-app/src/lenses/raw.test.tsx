// @vitest-environment jsdom
// The raw lens: its dumps of the one moment, bare (no names, no tints,
// no popovers, no hover meaning), and the Dump's display parameters
import { it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { fixture } from "../../test/io";
import { Lens } from "../ui/Lens";
import { abbreviated } from "../ui/Dump";
import { testProject } from "../../test/project";
import { rawLenses } from "./raw";
import type { LensSpec } from "../ui/types";

afterEach(cleanup);
const json = fixture("raw");
const slow = { timeout: 5000 };
const view = (c: HTMLElement, l: string) =>
  c.querySelector<HTMLElement>(`.view[data-view$=":${l}"]`);

for (const spec of rawLenses) {
  it(`${spec.id}: four bare dumps; the stack top first`, async () => {
    const project = await testProject();
    const { container: c } = render(<Lens spec={spec} project={project} />);
    await waitFor(() => expect(c.querySelectorAll(
      '.view[data-view$=":stack"] .wrow[data-slot]').length)
      .toBe(json.stack.length), slow);
    await waitFor(() => expect(c.querySelectorAll(".view .rows .wrow")
      .length).toBeGreaterThan(json.stack.length), slow);
    // the stack: 0, 1, … from the top; each word whole, as storage's
    const st = view(c, "stack")!;
    const addrs = [...st.querySelectorAll(".wrow .addr .a")]
      .map((a) => a.textContent);
    expect(addrs).toEqual(json.stack.map((_: string, k: number) => `${k}`));
    // every panel the same dump: words of 32 bytes, no ruler
    for (const l of ["storage", "stack", "memory", "calldata"]) {
      const v = view(c, l)!;
      expect(v.querySelector(".wrow[data-slot] .word")!
        .querySelectorAll(".b").length).toBe(32);
      expect(v.querySelector(".ruler")).toBeNull();
    }
    // storage: every slot it has, ⋯ where the slots jump
    const sto = view(c, "storage")!;
    expect(sto.querySelectorAll(".wrow[data-slot]").length)
      .toBe(Object.keys(json.storage).length);
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

it("abbreviation: the last bytes after 0x…, a short word whole", () => {
  const w = (h: string) => h.padStart(64, "0").match(/../g)!;
  expect(abbreviated(w("53c8a5ff9979"), 2)).toBe("0x…9979");
  expect(abbreviated(w("22"), 2)).toBe("0x22");
  expect(abbreviated(w("0463"), 2)).toBe("0x0463");
  expect(abbreviated(w(""), 2)).toBe("0x00");
});

it("the display parameters: scale, perLine, rows shape", async () => {
  const project = await testProject();
  const spec: LensSpec = { id: "p", title: "P", timelines: ["raw"],
    decodings: ["raw"], links: [], grid: '"a b"', views: [
      { id: "a", kind: "dump", area: "a", location: "calldata",
        data: { decoding: "raw", point: "raw" }, filter: { rows: "all" },
        display: { bare: true, density: "flow", perLine: 8, scale: 2 } },
      { id: "b", kind: "dump", area: "b", location: "stack",
        data: { decoding: "raw", point: "raw" },
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
  expect(lines[1].querySelectorAll(".b").length).toBe(8);
  expect(lines[1].querySelector(".a")!.textContent).toBe("0x0008");
  // (no shape, no abbreviation: whole words, 32 bytes a row, a ruler)
  const b = view(c, "b")!;
  expect(b.querySelectorAll(".wrow[data-slot]").length)
    .toBe(json.stack.length);
  expect(b.querySelector(".wrow[data-slot] .word")!
    .querySelectorAll(".b").length).toBe(32);
  expect(b.querySelector(".ruler")).not.toBeNull();
});
