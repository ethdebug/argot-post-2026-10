// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { Lens } from "./Lens";
import { fullInspector } from "../lenses/full-inspector";
import { testProject } from "../../test/project";

afterEach(cleanup);

// every element's place in the markup (boxes: the e2e bbox test; jsdom
// has no layout)
const shape = (root: Element) => [...root.querySelectorAll("*")].map((e) =>
  `${e.tagName}#${e.id}`);
const slow = { timeout: 5000 };
const slot2 = "0x" + "2".padStart(64, "0");

it("hovering a byte changes classes only, not the markup", async () => {
  const project = await testProject();
  const { container } = render(<Lens spec={fullInspector}
    project={project} />);
  await waitFor(() => expect(container.querySelector(
    '.b[data-owners="totalScore"]')).toBeTruthy(), slow);
  const before = shape(container);
  fireEvent.pointerOver(container.querySelector(
    '.view:not([hidden]) .b[data-owners="totalScore"]')!);
  await waitFor(() => expect(container.querySelector(".b.hl"))
    .toBeTruthy(), slow);
  expect(shape(container)).toEqual(before);
});

it("one word per row, its owners' bytes marked", async () => {
  const project = await testProject();
  const { container } = render(<Lens spec={fullInspector}
    project={project} />);
  // (the layout, then the words: the last byte reads 8c)
  await waitFor(() => expect(container.querySelector(
    `.view[data-side="after"] .wrow[data-slot="${slot2}"] .b[data-i="31"]`)
    ?.textContent)
    .toBe("8c"), slow);
  const view = container.querySelector('.view[data-side="after"]')!;
  expect(view.hasAttribute("hidden")).toBe(false);
  expect(container.querySelector('.view[data-side="before"]')!
    .hasAttribute("hidden")).toBe(true);
  const row = view.querySelector(`.rows .wrow[data-slot="${slot2}"]`)!;
  expect(row.getAttribute("data-slot")).toBe("0x" + "2".padStart(64, "0"));
  expect(row.getAttribute("data-name")).toBe("slot 2");
  const cells = [...row.querySelectorAll(".b")];
  expect(cells).toHaveLength(32);
  expect(cells.map((c) => c.textContent).join("").slice(-4)).toBe("008c");
  expect(cells[31].getAttribute("data-owners")).toBe("totalScore");
  expect(cells[31].getAttribute("data-g")).toBe("16-31");
  expect(cells[8].getAttribute("data-owners")).toBe("totalHits");
  expect(cells[0].classList.contains("free")).toBe(true);
  expect(cells[16].getAttribute("aria-label"))
    .toBe("totalScore, bytes 16 to 31 of slot 2, after");
});
