// @vitest-environment jsdom
// The stepper's pages with the related view off (a scene's `related`
// false): a page whose bytes the selection lights is open, as with the
// view on; one it lights nothing of, shut
import { it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { Lens } from "../ui/Lens";
import { testProject } from "../../test/project";
import { stepper } from "./stepper";

afterEach(cleanup);
// (jsdom has no media queries: a wide page, motion allowed)
globalThis.matchMedia ??= ((q: string) => ({ matches: false, media: q,
  addEventListener() {}, removeEventListener() {} })) as never;
globalThis.ResizeObserver ??= class { observe() {} unobserve() {}
  disconnect() {} } as never;
const slow = { timeout: 60_000 };

it("related view off: the selection's lit pages open", async () => {
  const project = await testProject();
  const bm = project.bookmarks.find((b) => b.id === "optimized-locals")!;
  bm.related = undefined;
  const spec = { ...stepper, initial: { scene: "optimized-locals" } };
  const { container: c } = render(<Lens spec={spec} project={project} />);
  const page = (l: string) => c.querySelector<HTMLElement>(
    `.view[data-location="${l}"]`);
  // (carol's first moment: the locals selected, `len` on the stack and
  // `name` in the call; storage none of them)
  await waitFor(() => expect(c.querySelector(
    'li[data-path="@locals"] > .row.sel')).not.toBeNull(), slow);
  await waitFor(() => {
    expect(page("calldata")?.dataset.open).toBe("true");
    expect(page("stack")?.dataset.open).toBe("true");
  }, slow);
  expect(page("storage")?.dataset.open).toBe("false");
}, 120_000);
