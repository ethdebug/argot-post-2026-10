// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { fireEvent, cleanup, waitFor } from "@testing-library/react";
import { slotHex } from "../engine/hex";
import { inspector, mount, slow } from "../../test/lens";

afterEach(cleanup);

// every element's place in the markup (boxes: the e2e bbox test; jsdom
// has no layout)
const shape = (root: Element) => [...root.querySelectorAll("*")].map((e) =>
  `${e.tagName}#${e.id}`);
const slot2 = slotHex(2n);
// (the full inspector's two dumps alone)
const dumps = () => mount(inspector("before", "after"));

it("hovering a byte changes classes only, not the markup", async () => {
  const { container } = await dumps();
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
  const { container } = await dumps();
  // (the layout, then the words: the last byte reads 8c)
  // (mid: one moment, one dump: none before it)
  await waitFor(() => expect(container.querySelector(
    `.view .wrow[data-slot="${slot2}"] .b[data-i="31"]`)?.textContent)
    .toBe("8c"), slow);
  expect(container.querySelectorAll(".view")).toHaveLength(1);
  const view = container.querySelector(".view")!;
  const row = view.querySelector(`.rows .wrow[data-slot="${slot2}"]`)!;
  expect(row.getAttribute("data-name")).toBe("slot 2");
  const cells = [...row.querySelectorAll(".b")];
  expect(cells).toHaveLength(32);
  expect(cells.map((c) => c.textContent).join("").slice(-4)).toBe("008c");
  expect(cells[31].getAttribute("data-owners")).toBe("totalScore");
  expect(cells[31].getAttribute("data-g")).toBe("16-31");
  expect(cells[8].getAttribute("data-owners")).toBe("totalHits");
  expect(cells[0].classList.contains("free")).toBe(true);
  expect(cells[16].getAttribute("aria-label"))
    .toBe("totalScore, bytes 16 to 31 of slot 2");
});
