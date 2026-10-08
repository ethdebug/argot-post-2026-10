// A lens mounted in jsdom, for the ui units: the full inspector with
// only the views a test needs (each view of it renders ~2,000 nodes,
// the cost of these tests), on the app's real project
import {
  render, waitFor, act, type RenderResult,
} from "@testing-library/react";
import { expect } from "vitest";
import { Lens } from "../src/ui/Lens";
import type { LensContextValue } from "../src/ui/hooks";
import type { LensSpec } from "../src/ui/types";
import { fullInspector } from "../src/lenses/full-inspector";
import { testProject } from "./project";

// (rendering is slow on a busy machine: waits get room)
export const slow = { timeout: 10_000 };

// The full inspector with the views `only` (by id)
export const inspector = (...only: string[]): LensSpec => ({
  ...fullInspector,
  views: fullInspector.views.filter((v) => only.includes(v.id)),
});

// `n` lenses of `spec`, each in its own [data-mount], each showing
// scene `id` (with `sel`, if given)
export async function mount(spec: LensSpec, { n = 1, id = "mid", sel }:
  { n?: number; id?: string; sel?: string | null } = {}) {
  const project = await testProject();
  const got: LensContextValue[] = [];
  const r: RenderResult = render(<>{Array.from({ length: n }, (_, k) =>
    <div key={k} data-mount={k}><Lens spec={spec} project={project}
      onReady={(x) => void (got[k] = x)} /></div>)}</>);
  await waitFor(() => expect(got.filter(Boolean).length).toBe(n), slow);
  for (const g of got) {
    await act(async () => void await g.show(id,
      sel === undefined ? undefined : { sel }));
  }
  const at = (k: number) => r.container.querySelector(
    `[data-mount="${k}"]`) as HTMLElement;
  return { ...r, lenses: got, at };
}
