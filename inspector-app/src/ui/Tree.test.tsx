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

async function mount(sel: string | null) {
  const project = await testProject();
  const lens = {} as { it: LensContextValue };
  const r = render(<Lens spec={fullInspector} project={project}
    onReady={(x) => void (lens.it = x)} />);
  await waitFor(() => expect(lens.it).toBeTruthy(), slow);
  await act(async () => void await lens.it.show("mid", { sel }));
  await waitFor(() => expect(r.container.querySelector(
    '#tree li[data-path="players"] > .chev')).toBeTruthy(), slow);
  const li = (p: string) => r.container.querySelector(
    `#tree li[data-path="${p}"]`) as HTMLElement;
  return { ...r, lens: lens.it, li };
}

it("the chevron toggles the group only", async () => {
  const { lens, li } = await mount("players");
  const link = () => lens.store.get().links.storage;
  const before = link();
  const chev = li("players").querySelector(":scope > .chev")!;
  expect(chev.getAttribute("aria-expanded")).toBe("true");
  act(() => void fireEvent.click(chev));
  expect(li("players").classList.contains("collapsed")).toBe(true);
  expect(chev.getAttribute("aria-expanded")).toBe("false");
  expect(chev.getAttribute("aria-label")).toBe("Expand players");
  expect(link().selection).toBe(before.selection);
  expect(link().walk).toBe(before.walk);
  act(() => void fireEvent.click(chev));
  expect(li("players").classList.contains("collapsed")).toBe(false);
});

it("pointing at a chevron points at its row", async () => {
  const { lens, li } = await mount(null);
  act(() => void fireEvent.pointerOver(
    li("roster").querySelector(":scope > .chev")!));
  expect(lens.store.get().links.storage.hover).toEqual({ path: "roster" });
  await waitFor(() => expect(li("roster").querySelector(":scope > .row")!
    .classList.contains("hl")).toBe(true), slow);
});

it("a new selection opens the path to it", async () => {
  const { lens, li } = await mount(null);
  act(() => void fireEvent.click(
    li("players").querySelector(":scope > .chev")!));
  expect(li("players").classList.contains("collapsed")).toBe(true);
  await act(async () => void await lens.show("mid", { sel: `${A}.score` }));
  await waitFor(() => expect(li("players").classList.contains("collapsed"))
    .toBe(false), slow);
});

it("players selected: its entries are blocks in their colours",
  async () => {
    const { li } = await mount("players");
    await waitFor(() => expect(li(A).classList.contains("blk")).toBe(true),
      slow);
    expect(li(A).classList.contains("pk1")).toBe(true);
    expect(li("players").querySelector(":scope > .row")!.classList
      .contains("sel")).toBe(true);
  });
