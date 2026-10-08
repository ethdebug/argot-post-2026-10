// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import {
  render, screen, fireEvent, cleanup, act, waitFor,
} from "@testing-library/react";
import { Lens } from "./Lens";
import { useLink } from "./hooks";
import type { LensSpec } from "./types";
import type { Project } from "../engine/project";
import { slotHex } from "../engine/hex";
import { testProject } from "../../test/project";
import { inspector, mount, slow } from "../../test/lens";
import { A } from "../../test/expect";

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

describe("with real data", () => {
  const val = (c: HTMLElement, path: string) => c.querySelector(
    `li[data-path="${path}"] .val`)?.textContent;

  it("a lens brings its own decoding", async () => {
    const project = await testProject();
    const spec: LensSpec = {
      id: "own", title: "Own", timelines: ["arcade-alice"], grid: '"t"',
      decodings: [{ id: "mine", compilation: "sol@arcade-alice",
        timeline: "arcade-alice", variables: "state",
        keys: { from: "list", path: "playerList" } }],
      links: ["s"],
      views: [{ id: "t", kind: "tree", area: "t", link: "s",
        data: { decoding: "mine", point: "arcade-alice:before" } }],
    };
    expect(project.decodings.mine).toBeUndefined();
    const { container } = render(<Lens spec={spec} project={project} />);
    await waitFor(() => expect(val(container, "totalScore")).toBe("140"), slow);
  });

  it("two dumps at two literal points: both shown, neither a side",
    async () => {
      const project = await testProject();
      const at = (point: string) => ({ decoding: "sol:arcade-alice",
        point });
      const spec: LensSpec = {
        id: "two", title: "Two", timelines: ["arcade-alice"],
        decodings: ["sol:arcade-alice"], grid: '"a" "b"', links: ["s"],
        views: [
          { id: "a", kind: "dump", area: "a", location: "storage",
            link: "s", data: at("arcade-alice:before") },
          { id: "b", kind: "dump", area: "b", location: "storage",
            link: "s", data: at("arcade-alice:after") },
        ],
      };
      const { container } = render(<Lens spec={spec} project={project} />);
      const word = (v: Element) => [...v.querySelectorAll(
        `.wrow[data-slot="${slotHex(2n)}"] .b`)].map((b) => b.textContent)
        .join("").slice(-2);
      // (totalScore: 140 before, 170 after)
      await waitFor(() => expect([...container.querySelectorAll(".view")]
        .map(word)).toEqual(["8c", "aa"]), slow);
      const views = [...container.querySelectorAll(".view")];
      expect(views.map((v) => v.hasAttribute("hidden")))
        .toEqual([false, false]);
      expect(views.map((v) => v.getAttribute("data-side")))
        .toEqual([null, null]);
    });
});

// Keys and clicks act on the lens they are in (two lenses of the full
// inspector on one page)
describe("keys and clicks, per lens", () => {
  async function two() {
    const r = await mount(inspector("walk", "after", "tree"), { n: 2 });
    const link = (k: number) => r.lenses[k].store.get().links.storage;
    await waitFor(() => expect([link(0).selection, link(1).selection])
      .toEqual([A, A]), slow);
    return { ...r, link };
  }
  const walk = (r: Awaited<ReturnType<typeof two>>, k: number,
    w: { step: number; n?: number }) => act(() => r.lenses[k].store.set(
    (s) => ({ ...s, links: { ...s.links,
      storage: { ...s.links.storage, walk: w } } })));

  it("Escape exits a walkthrough first, then clears", async () => {
    const r = await two();
    walk(r, 0, { step: 2 });
    const row = r.at(0).querySelector<HTMLElement>("#tree .row")!;
    row.focus();
    act(() => void fireEvent.keyDown(row, { key: "Escape" }));
    // (the walkthrough's panel folds its details, then ends it)
    await waitFor(() => expect([r.link(0).walk, r.link(0).selection])
      .toEqual([null, A]), slow);
    act(() => void fireEvent.keyDown(row, { key: "Escape" }));
    expect(r.link(0).selection).toBe(null);
    expect(r.link(1).selection).toBe(A);
  });

  it("with nothing focused, Escape acts on the lens last pressed in",
    async () => {
      const r = await two();
      (document.activeElement as HTMLElement | null)?.blur();
      act(() => void fireEvent.pointerDown(
        r.at(1).querySelector(".view .rows")!));
      act(() => void fireEvent.keyDown(document.body, { key: "Escape" }));
      expect([r.link(0).selection, r.link(1).selection]).toEqual([A, null]);
    });

  it("a click on empty space clears; a click in another lens does not",
    async () => {
      const r = await two();
      act(() => void fireEvent.click(r.at(1).querySelector(".view .gap")!));
      expect([r.link(0).selection, r.link(1).selection]).toEqual([A, null]);
    });

  it("walkthrough keys move only the lens they are in", async () => {
    const r = await two();
    for (const k of [0, 1]) walk(r, k, { step: 3, n: 12 });
    const bar = r.at(1).querySelector<HTMLElement>("#details, .rbar")!;
    bar.focus();
    act(() => void fireEvent.keyDown(bar, { key: "ArrowLeft" }));
    expect([r.link(0).walk!.step, r.link(1).walk!.step]).toEqual([3, 2]);
    act(() => void fireEvent.keyDown(bar, { key: "End" }));
    act(() => void fireEvent.keyDown(bar, { key: "ArrowRight" }));
    // (End: the last step, found)
    expect([r.link(0).walk!.step, r.link(1).walk!.step]).toEqual([3, 10]);
    act(() => void fireEvent.keyDown(bar, { key: "Home" }));
    expect(r.link(1).walk!.step).toBe(0);
  });

  it("a bookmark change ends a walkthrough", async () => {
    const r = await two();
    walk(r, 0, { step: 3, n: 12 });
    await act(async () => void await r.lenses[0].show("alice"));
    expect(r.link(0).walk).toBe(null);
  });
});
