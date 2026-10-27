// A scene drawn by its lens (addendum §3), for the reader: from its
// snapshot, with its Reset
import { useCallback, useContext, useMemo, useState } from "react";
import type { Project } from "../engine/project";
import type { Scene } from "../engine/scene";
import { Lens } from "./Lens";
import { PanelPort } from "./panel-port";
import { Reset, ResetContext, resetsOwn, useReset } from "./Reset";
import type { LensContextValue } from "./hooks";
import type { LensSpec } from "./types";

export function SceneHost(p: { scene: Scene; project: Project;
  lenses: LensSpec[] }) {
  const lens = p.lenses.find((l) => l.id === p.scene.lens);
  // (the scene, shown first; a lens with scenes of its own to pick from
  // that are not this one shows it as its one scene, when it is a
  // bookmark (the storage inspector's); else its own, until it
  // reads scenes: §8 4)
  const first = p.scene.id;
  const own = p.project.bookmarks.some((b) => b.id === first);
  const spec = useMemo(() => !lens ? lens : lens.bookmarks &&
    !lens.bookmarks.includes(first) ? own ? { ...lens,
      bookmarks: [first], initial: { ...lens.initial,
        scene: first } } : lens
    : { ...lens, initial: { ...lens.initial, scene: first } },
  [lens, own, first]);
  // (the scene's rows: its storage dumps' filter, "touched")
  // (and its roots: every tree's and storage dump's)
  // (and no walkthrough, its bar not drawn, where the scene says so; no
  // controls, "controls": "none": its rows the scene's alone)
  const quiet = p.scene.initial?.walkthrough === false;
  const bare = p.scene.controls === "none";
  const shown = useMemo(() => !spec || (!p.scene.rows && !p.scene.roots &&
    !quiet && !bare) ? spec : { ...spec, views: spec.views.filter((v) =>
      !quiet || v.kind !== "walkthrough").map((v) => (v.kind === "dump" &&
      v.location === "storage") || v.kind === "tree" ? { ...v, filter: {
        ...v.filter, ...p.scene.rows && v.kind === "dump"
          ? { rows: p.scene.rows } : {},
        ...p.scene.roots ? { roots: p.scene.roots } : {} } } : v) },
  [spec, p.scene.rows, p.scene.roots, quiet, bare]);
  // (the reader's figure: its lens, for its Reset)
  const [live, setLive] = useState<{ lens: LensContextValue;
    ready: Promise<boolean> } | null>(null);
  const onReady = useCallback((lens: LensContextValue,
    ready: Promise<boolean>) => setLive((x) => x?.lens === lens &&
      x.ready === ready ? x : { lens, ready }), []);
  const port = useContext(PanelPort);
  const reset = useReset({ lens: live?.lens ?? null,
    ready: live?.ready ?? null, scene: p.scene.id });
  if (!shown) return <p className="error">no lens {p.scene.lens}</p>;
  // (a figure with a walkthrough: its Reset in the walkthrough's bar,
  // where its Exit was; else its own, over the figure; and a figure
  // whose panel is a frame of its own, the post's, or with a bar of its
  // own on top, the moments' (resetsOwn): its own, over the figure, the
  // walkthrough without one)
  const walks = !port && !resetsOwn(shown) &&
    shown.views.some((v) => v.kind === "walkthrough");
  return <div data-scene={p.scene.id} data-mode="reader"
    style={{ display: "contents" }}>
    <ResetContext.Provider value={reset}>
      {!walks && <Reset state={reset} />}
      <Lens spec={shown} project={p.project} onReady={onReady} />
    </ResetContext.Provider></div>;
}
