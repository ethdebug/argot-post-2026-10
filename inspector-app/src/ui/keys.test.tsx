// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import {
  render, fireEvent, cleanup, waitFor, act,
} from "@testing-library/react";
import { Lens } from "./Lens";
import type { LensContextValue } from "./hooks";
import { fullInspector } from "../lenses/full-inspector";
import { testProject } from "../../test/project";
import { A } from "../../test/expect";

afterEach(cleanup);
const slow = { timeout: 5000 };

async function two() {
  const project = await testProject();
  const got: LensContextValue[] = [];
  const r = render(<>{[0, 1].map((k) => <div key={k} data-mount={k}>
    <Lens spec={fullInspector} project={project}
      onReady={(x) => void (got[k] = x)} /></div>)}</>);
  await waitFor(() => expect(got.length).toBe(2), slow);
  for (const g of got) await act(async () => void await g.show("mid"));
  const link = (k: number) => got[k].store.get().links.storage;
  await waitFor(() => expect([link(0).selection, link(1).selection])
    .toEqual([A, A]), slow);
  const mount = (k: number) => r.container.querySelector(
    `[data-mount="${k}"]`) as HTMLElement;
  return { got, link, mount };
}

it("Escape exits a walkthrough first, then clears", async () => {
  const { got, link, mount } = await two();
  act(() => got[0].store.set((s) => ({ ...s, links: { ...s.links,
    storage: { ...s.links.storage, walk: { step: 2 } } } })));
  const row = mount(0).querySelector<HTMLElement>("#tree .row")!;
  row.focus();
  act(() => void fireEvent.keyDown(row, { key: "Escape" }));
  // (the walkthrough's panel folds its details, then ends it)
  await waitFor(() => expect([link(0).walk, link(0).selection])
    .toEqual([null, A]), slow);
  act(() => void fireEvent.keyDown(row, { key: "Escape" }));
  expect(link(0).selection).toBe(null);
  // (the other lens: untouched)
  expect(link(1).selection).toBe(A);
});

it("with nothing focused, Escape acts on the lens last pressed in",
  async () => {
    const { link, mount } = await two();
    (document.activeElement as HTMLElement | null)?.blur();
    act(() => void fireEvent.pointerDown(
      mount(1).querySelector(".view .rows")!));
    act(() => void fireEvent.keyDown(document.body, { key: "Escape" }));
    expect([link(0).selection, link(1).selection]).toEqual([A, null]);
  });

it("a click on empty space clears; a click in another lens does not",
  async () => {
    const { link, mount } = await two();
    act(() => void fireEvent.click(mount(1).querySelector(".view .gap")!));
    expect([link(0).selection, link(1).selection]).toEqual([A, null]);
  });

it("Review Focus 4: walkthrough keys move only the lens they are in",
  async () => {
    const { got, link, mount } = await two();
    for (const g of got) {
      act(() => g.store.set((s) => ({ ...s, links: { ...s.links,
        storage: { ...s.links.storage, walk: { step: 3, n: 12 } } } })));
    }
    const bar = mount(1).querySelector<HTMLElement>("#details, .rbar")!;
    bar.focus();
    act(() => void fireEvent.keyDown(bar, { key: "ArrowLeft" }));
    expect([link(0).walk!.step, link(1).walk!.step]).toEqual([3, 2]);
    act(() => void fireEvent.keyDown(bar, { key: "End" }));
    act(() => void fireEvent.keyDown(bar, { key: "ArrowRight" }));
    // (End: the last step, found)
    expect([link(0).walk!.step, link(1).walk!.step]).toEqual([3, 10]);
    act(() => void fireEvent.keyDown(bar, { key: "Home" }));
    expect(link(1).walk!.step).toBe(0);
  });

it("a bookmark change ends a walkthrough", async () => {
  const { got, link } = await two();
  act(() => got[0].store.set((s) => ({ ...s, links: { ...s.links,
    storage: { ...s.links.storage, walk: { step: 3, n: 12 } } } })));
  await act(async () => void await got[0].show("alice"));
  expect(link(0).walk).toBe(null);
});
