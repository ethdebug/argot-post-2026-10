// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Lens } from "./Lens";
import { fullInspector } from "../lenses/full-inspector";
import { testProject } from "../../test/project";

afterEach(cleanup);

// every element's place in the markup, and its box
const shape = (root: Element) => [...root.querySelectorAll("*")].map((e) =>
  `${e.tagName}${JSON.stringify(e.getBoundingClientRect())}`);

it("hovering a byte moves nothing", async () => {
  const project = await testProject();
  const { container } = render(<Lens spec={fullInspector}
    project={project} />);
  await waitFor(() => expect(container.querySelector(
    '.b[data-owners="total"]')).toBeTruthy());
  const before = shape(container);
  const rects = [...container.querySelectorAll(".wrow")].map((r) =>
    JSON.stringify(r.getBoundingClientRect()));
  fireEvent.pointerOver(container.querySelector(
    '.view:not([hidden]) .b[data-owners="total"]')!);
  await waitFor(() => expect(container.querySelector(".b.hl"))
    .toBeTruthy());
  expect(shape(container)).toEqual(before);
  expect([...container.querySelectorAll(".wrow")].map((r) =>
    JSON.stringify(r.getBoundingClientRect()))).toEqual(rects);
});

it("one word per row, its owners' bytes marked", async () => {
  const project = await testProject();
  const { container } = render(<Lens spec={fullInspector}
    project={project} />);
  await waitFor(() => expect(container.querySelector(
    '.view[data-side="after"] .wrow')).toBeTruthy());
  const view = container.querySelector('.view[data-side="after"]')!;
  expect(view.hasAttribute("hidden")).toBe(false);
  expect(container.querySelector('.view[data-side="before"]')!
    .hasAttribute("hidden")).toBe(true);
  const row = view.querySelector(".rows .wrow")!;
  expect(row.getAttribute("data-slot")).toBe("0x" + "2".padStart(64, "0"));
  expect(row.getAttribute("data-name")).toBe("slot 2");
  const cells = [...row.querySelectorAll(".b")];
  expect(cells).toHaveLength(32);
  expect(cells.map((c) => c.textContent).join("").slice(-4)).toBe("0028");
  expect(cells[31].getAttribute("data-owners")).toBe("total");
  expect(cells[31].getAttribute("data-g")).toBe("16-31");
  expect(cells[8].getAttribute("data-owners")).toBe("rounds");
  expect(cells[0].classList.contains("free")).toBe(true);
  expect(cells[16].getAttribute("aria-label"))
    .toBe("total, bytes 16 to 31 of slot 2, after");
});
