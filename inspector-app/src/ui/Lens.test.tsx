// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { Lens } from "./Lens";
import { useLink } from "./hooks";
import type { LensSpec } from "./types";
import type { Project } from "../engine/project";

afterEach(cleanup);

// a probe view: shows its link's hover, and sets it on a click
function Probe({ id, link }: { id: string; link?: string }) {
  const [s, set] = useLink(link ?? "");
  return <button data-probe={id} onClick={() => set((x) =>
    ({ ...x, hover: { path: id } }))}>{s.hover?.path ?? "-"}</button>;
}

const data = { decoding: "d", point: "p" };
const spec: LensSpec = {
  id: "probe", title: "Probe", timelines: [], decodings: [],
  grid: '"a b c"', links: ["one", "two"],
  views: [
    { id: "v1", kind: "tree", area: "a", link: "one", data },
    { id: "v2", kind: "tree", area: "b", link: "one", data },
    { id: "v3", kind: "tree", area: "c", link: "two", data },
  ],
};
const project = { bookmarks: [], decodings: {}, memo: new Map() } as
  unknown as Project;
const kinds = { tree: Probe };
const text = (root: HTMLElement, id: string) =>
  root.querySelector(`[data-probe="${id}"]`)!.textContent;

it("two linked views share hover; an unlinked one does not", () => {
  const { container } = render(<Lens spec={spec} project={project}
    kinds={kinds} />);
  act(() => {
    fireEvent.click(container.querySelector('[data-probe="v1"]')!);
  });
  expect(text(container, "v1")).toBe("v1");
  expect(text(container, "v2")).toBe("v1");
  expect(text(container, "v3")).toBe("-");
});

it("two Lens mounts of one spec keep separate state", () => {
  render(<><div data-mount="1"><Lens spec={spec} project={project}
    kinds={kinds} /></div><div data-mount="2"><Lens spec={spec}
    project={project} kinds={kinds} /></div></>);
  const [m1, m2] = [1, 2].map((k) =>
    document.querySelector(`[data-mount="${k}"]`) as HTMLElement);
  act(() => {
    fireEvent.click(m1.querySelector('[data-probe="v2"]')!);
  });
  expect(text(m1, "v1")).toBe("v2");
  expect(text(m2, "v1")).toBe("-");
  expect(screen.getAllByText("v2")).toHaveLength(2);
});

it("lays its views out in its grid's areas", () => {
  const { container } = render(<Lens spec={spec} project={project}
    kinds={kinds} />);
  const grid = container.firstElementChild as HTMLElement;
  expect(grid.style.gridTemplateAreas).toBe('"a b c"');
  expect([...grid.children].map((c) => (c as HTMLElement).style.gridArea))
    .toEqual(["a", "b", "c"]);
});
