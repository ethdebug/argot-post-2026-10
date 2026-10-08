// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { inspector, mount as mountLens, slow } from "../../test/lens";
import { A } from "../../test/expect";

afterEach(cleanup);

// The full inspector's tree alone, at the middle of the game
async function mount(sel: string | null) {
  const r = await mountLens(inspector("tree"), { sel });
  await waitFor(() => expect(r.container.querySelector(
    '#tree li[data-path="players"] > .chev')).toBeTruthy(), slow);
  const li = (p: string) => r.container.querySelector(
    `#tree li[data-path="${p}"]`) as HTMLElement;
  return { ...r, lens: r.lenses[0], li };
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
    li("playerList").querySelector(":scope > .chev")!));
  expect(lens.store.get().links.storage.hover).toEqual({ path: "playerList" });
  await waitFor(() => expect(li("playerList").querySelector(":scope > .row")!
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
