// The annotated layer's reveal (the post's first before/after): off,
// the raw bytes; on, the same bytes with their colours and labels, faded
// in. One per page (a figure is one page): set by the host page's
// scroll (embed: { type: "ethdebug:reveal", on }), by the toggle when
// the figure stands alone, or by the hash (reveal=1)
import { useSyncExternalStore } from "react";
import { createStore } from "./store";

export const reveal = createStore({ on: new URLSearchParams(
  globalThis.location?.hash.slice(1) ?? "").get("reveal") === "1" });
export const useRevealed = () => useSyncExternalStore(reveal.subscribe,
  () => reveal.get().on);
export const setRevealed = (on: boolean) => reveal.set((s) =>
  s.on === on ? s : { on });
