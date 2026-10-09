// A scene drawn by its lens (addendum §3): the one component tree of
// every mode. The mode chooses the project's source (the reader's
// snapshots, authoring's runs), the controls and the extra panels;
// none of those are here yet (TimelineBar: §5; the debugger: §3.1).
import { useMemo } from "react";
import type { Project } from "../engine/project";
import type { Scene } from "../engine/scene";
import { Lens } from "./Lens";
import type { LensSpec } from "./types";

export function SceneHost(p: { scene: Scene; project: Project;
  lenses: LensSpec[]; mode: "authoring" | "reader" | "companion";
  hash?: boolean }) {
  const lens = p.lenses.find((l) => l.id === p.scene.lens);
  // (the scene, shown first; a lens with scenes of its own to pick from
  // that are not this one shows it as its one scene, when it is a
  // bookmark (raw-named, the storage inspector's); else its own, until it
  // reads scenes: §8 4)
  const own = p.project.bookmarks.some((b) => b.id === p.scene.id);
  const spec = useMemo(() => !lens ? lens : lens.bookmarks &&
    !lens.bookmarks.includes(p.scene.id) ? own ? { ...lens,
      bookmarks: [p.scene.id], initial: { ...lens.initial,
        scene: p.scene.id } } : lens
    : { ...lens, initial: { ...lens.initial, scene: p.scene.id } },
  [lens, own, p.scene.id]);
  // (the scene's rows: its storage dumps' filter, "touched")
  const shown = useMemo(() => !spec || !p.scene.rows ? spec : { ...spec,
    views: spec.views.map((v) => v.kind === "dump" &&
      v.location === "storage" ? { ...v, filter: { ...v.filter,
        rows: p.scene.rows } } : v) }, [spec, p.scene.rows]);
  if (!shown) return <p className="error">no lens {p.scene.lens}</p>;
  return <div data-scene={p.scene.id} data-mode={p.mode}
    style={{ display: "contents" }}>
    <Lens spec={shown} project={p.project} hash={p.hash} /></div>;
}
