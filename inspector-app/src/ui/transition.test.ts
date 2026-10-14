// @vitest-environment jsdom
import { it, expect, vi } from "vitest";
import { animated, cut, vtName } from "./transition";
import { createStore } from "./store";
import { RELATED_CONTEXT, type LensState } from "./types";

it("a row's transition name is its location's: storage 3 is not stack 3",
  () => {
    const s = vtName("k", "dump", "storage", "0x03");
    expect(s).not.toBe(vtName("k", "dump", "stack", "0x03"));
    expect(s).toMatch(/^vt-[0-9a-z]+-[0-9a-z]+$/);
  });

it("a selection in the related view animates, a walkthrough on or not; " +
  "a step alone does not", async () => {
    const start = vi.fn((f: () => Promise<void>) => {
      const finished = f();
      return { finished, ready: finished };
    });
    Object.assign(document, { startViewTransition: start });
    globalThis.matchMedia = (() => ({ matches: false })) as never;
    const walk = { step: 2 };
    const store = animated(createStore<LensState>({ scene: "s", moment: 0,
      shows: 1, views: {}, related: { context: RELATED_CONTEXT },
      links: { storage: { selection: "players", hover: null, walk } } }));
    const set = (l: Partial<LensState["links"][string]>) => store.set((s) =>
      ({ ...s, links: { storage: { ...s.links.storage, ...l } } }));
    set({ selection: null });
    expect(start).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r));
    expect(store.get().links.storage.selection).toBe(null);
    set({ selection: "motd" });
    expect(start).toHaveBeenCalledTimes(2);
    await new Promise((r) => setTimeout(r));
    set({ walk: { step: 3 } });
    expect(start).toHaveBeenCalledTimes(2);
    expect(store.get().links.storage.walk).toEqual({ step: 3 });
    delete (document as { startViewTransition?: unknown })
      .startViewTransition;
  });

it("a selection during a replay's move, or on its arrival, or in a cut, " +
  "does not animate", async () => {
    const start = vi.fn((f: () => Promise<void>) => {
      const finished = f();
      return { finished, ready: finished };
    });
    Object.assign(document, { startViewTransition: start });
    globalThis.matchMedia = (() => ({ matches: false })) as never;
    const store = animated(createStore<LensState>({ scene: "s", moment: 0,
      shows: 1, views: {}, related: { context: RELATED_CONTEXT },
      playing: true, toward: 3,
      links: { st: { selection: "player", hover: null, walk: null } } }));
    const set = (selection: string | null) => store.set((s) =>
      ({ ...s, links: { st: { ...s.links.st, selection } } }));
    set(null);
    set("combo");
    expect(start).not.toHaveBeenCalled();
    expect(store.get().links.st.selection).toBe("combo");
    store.set((s) => ({ ...s, playing: undefined, toward: undefined }));
    cut(() => set("mult"));
    expect(start).not.toHaveBeenCalled();
    expect(store.get().links.st.selection).toBe("mult");
    set("gained");
    expect(start).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r));
    delete (document as { startViewTransition?: unknown })
      .startViewTransition;
  });
