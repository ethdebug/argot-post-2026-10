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
  // that are not this one shows its own, until it reads scenes: §8 4)
  const spec = useMemo(() => !lens || (lens.bookmarks &&
    !lens.bookmarks.includes(p.scene.id)) ? lens
    : { ...lens, initial: { ...lens.initial, scene: p.scene.id } },
  [lens, p.scene.id]);
  if (!spec) return <p className="error">no lens {p.scene.lens}</p>;
  return <div data-scene={p.scene.id} data-mode={p.mode}
    style={{ display: "contents" }}>
    <Lens spec={spec} project={p.project} hash={p.hash} /></div>;
}
