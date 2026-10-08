// @vitest-environment jsdom
import { it, expect, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup, act } from "@testing-library/react";
import { Shell } from "./Shell";
import type { LensSpec } from "../ui/types";
import type { Project } from "../engine/project";

afterEach(cleanup);
beforeEach(() => history.replaceState(null, "", "/"));

const lens = (id: string): LensSpec => ({ id, title: `Lens ${id}`,
  timelines: [], decodings: [], grid: '"a"', links: [], views: [] });
const lenses = [lens("one"), lens("two"), lens("three")];
const project = { bookmarks: [], decodings: {}, memo: new Map() } as
  unknown as Project;
const current = (c: HTMLElement) =>
  c.querySelector('[aria-current="page"]')?.getAttribute("data-lens");

it("shows the first lens, or the hash's", () => {
  const a = render(<Shell project={project} lenses={lenses} />);
  expect(current(a.container)).toBe("one");
  expect(location.hash).toBe("#lens=one");
  cleanup();
  history.replaceState(null, "", "#lens=two");
  const b = render(<Shell project={project} lenses={lenses} />);
  expect(current(b.container)).toBe("two");
});

it("] and [ move through the lenses, round", () => {
  const { container } = render(<Shell project={project} lenses={lenses} />);
  act(() => void fireEvent.keyDown(document.body, { key: "]" }));
  expect(current(container)).toBe("two");
  expect(location.hash).toBe("#lens=two");
  act(() => void fireEvent.keyDown(document.body, { key: "[" }));
  act(() => void fireEvent.keyDown(document.body, { key: "[" }));
  expect(current(container)).toBe("three");
});

it("keys in a text field are the field's", () => {
  const { container } = render(<><input data-x /><Shell project={project}
    lenses={lenses} /></>);
  fireEvent.keyDown(container.querySelector("[data-x]")!, { key: "]" });
  expect(current(container)).toBe("one");
});

it("g opens the list, Escape closes it", () => {
  const { container } = render(<Shell project={project} lenses={lenses} />);
  const list = container.querySelector("[data-shell-list]") as HTMLElement;
  expect(list.hidden).toBe(true);
  act(() => void fireEvent.keyDown(document.body, { key: "g" }));
  expect(list.hidden).toBe(false);
  act(() => void fireEvent.keyDown(document.body, { key: "Escape" }));
  expect(list.hidden).toBe(true);
});
