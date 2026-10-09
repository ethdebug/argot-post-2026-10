// A scene drawn by its lens (addendum §3): the one component tree of
// every mode. The mode chooses the project's source (the reader's
// snapshots, authoring's runs), the controls and the extra panels:
// in authoring, the debugger over the scene's run, beside the scene
// (a "Debugger | Scene" switch on a narrow page), and the pins.
import { useEffect, useMemo, useState } from "react";
import type { Project } from "../engine/project";
import type { Scene } from "../engine/scene";
import type { MomentRef } from "../engine/run/types";
import { debuggerLens } from "../lenses/debugger";
import { Lens } from "./Lens";
import { PinBar } from "./PinBar";
import type { LensContextValue } from "./hooks";
import type { LensSpec } from "./types";

export function SceneHost(p: { scene: Scene; project: Project;
  lenses: LensSpec[]; mode: "authoring" | "reader" | "companion";
  hash?: boolean }) {
  const lens = p.lenses.find((l) => l.id === p.scene.lens);
  // (the scene, shown first; a lens with scenes of its own to pick from
  // that are not this one shows it as its one scene, when it is a
  // bookmark (raw-named, the storage inspector's); else its own, until it
  // reads scenes: §8 4)
  // (a scene of groups, the memory section's: its first group, its other
  // groups and the lens's other scenes to pick)
  const first = p.scene.groups?.[0]?.id ?? p.scene.id;
  const own = p.project.bookmarks.some((b) => b.id === first);
  const spec = useMemo(() => !lens ? lens : lens.bookmarks &&
    !lens.bookmarks.includes(first) ? own ? { ...lens,
      bookmarks: [first], initial: { ...lens.initial,
        scene: first } } : lens
    : { ...lens, initial: { ...lens.initial, scene: first } },
  [lens, own, first]);
  // (the scene's rows: its storage dumps' filter, "touched")
  const shown = useMemo(() => !spec || !p.scene.rows ? spec : { ...spec,
    views: spec.views.map((v) => v.kind === "dump" &&
      v.location === "storage" ? { ...v, filter: { ...v.filter,
        rows: p.scene.rows } } : v) }, [spec, p.scene.rows]);
  if (!shown) return <p className="error">no lens {p.scene.lens}</p>;
  const figure = <Lens spec={shown} project={p.project} hash={p.hash} />;
  if (p.mode === "reader") {
    return <div data-scene={p.scene.id} data-mode={p.mode}
      style={{ display: "contents" }}>{figure}</div>;
  }
  return <Authoring {...p} figure={figure} />;
}

const hashAt = () => new URLSearchParams(location.hash.slice(1)).get("at");
const refOf = (s: string | null): MomentRef | undefined => {
  const m = s?.match(/^(\d+):(\d+|end)$/);
  return m ? { tx: +m[1], step: m[2] === "end" ? "end" : +m[2] }
    : undefined;
};

// The debugger beside the scene, and the pins: opened by its button (or
// a link with debug=1, which the hash then keeps); its moment in the
// hash (at=<tx>:<step>); it opens there, or at the scene's first moment
const hashDebug = () => new URLSearchParams(location.hash.slice(1))
  .get("debug") === "1";
function Authoring(p: { scene: Scene; project: Project; lenses: LensSpec[];
  figure: React.ReactNode; hash?: boolean }) {
  const run = `run:${p.scene.id}`;
  const [start, setStart] = useState<{ run: string; k: number }>();
  const [at, setAt] = useState<MomentRef>();
  const [show, setShow] = useState<"debugger" | "scene">("debugger");
  const [open, setOpen] = useState(() => !!p.hash && hashDebug());
  // (a pane shown again: its dumps fit to it, as on a resize)
  useEffect(() => {
    const f = requestAnimationFrame(() => dispatchEvent(new Event("resize")));
    return () => cancelAnimationFrame(f);
  }, [show]);
  useEffect(() => {
    if (!open) return;
    if (p.hash && !hashDebug()) {
      const q = new URLSearchParams(location.hash.slice(1));
      q.set("debug", "1");
      history.replaceState(null, "", `#${q}`.replace(/%3A/g, ":"));
    }
    let live = true;
    void p.project.source(run).then((src) => {
      const want = refOf(hashAt()) ?? p.scene.timeline[p.scene.initial
        ?.moment ?? 0];
      const k = src.moments.findIndex((m) => m.tx === want.tx &&
        m.step === want.step);
      if (live) setStart({ run, k: Math.max(0, k) });
    });
    return () => {
      live = false;
    };
  }, [p.project, run, p.scene, open, p.hash]);
  const dspec = useMemo(() => start && ({ ...debuggerLens,
    initial: { scene: start.run, moment: start.k } }), [start]);
  // (the debugger's moment: the pins', and the hash's)
  const onReady = useMemo(() => (l: LensContextValue) => {
    const write = () => {
      const s = l.store.get();
      const id = p.project.bookmarks.find((b) => b.id === s.scene)
        ?.points[s.moment];
      void (id ? p.project.point(run, id) : Promise.reject()).then((pt) => {
        const ref = { tx: (pt.at as MomentRef).tx,
          step: (pt.at as MomentRef).step };
        setAt(ref);
        if (!p.hash) return;
        const q = new URLSearchParams(location.hash.slice(1));
        const v = `${ref.tx}:${ref.step}`;
        if (q.get("at") !== v) {
          q.set("at", v);
          history.replaceState(null, "", `#${q}`.replace(/%3A/g, ":"));
        }
      }, () => {});
    };
    write();
    l.store.subscribe(write);
  }, [p.project, run, p.hash]);
  if (!open) {
    return <div className="authoring" data-scene={p.scene.id}
      data-mode="authoring">
      <p className="dopen"><button type="button" className="btn"
        data-open-debugger onClick={() => setOpen(true)}>Debugger: step
        through the scene's run</button></p>
      <section className="scenepane" aria-label="Scene">{p.figure}
      </section></div>;
  }
  return <div className="authoring" data-scene={p.scene.id}
    data-mode="authoring" data-show={show} data-debugger>
    <div className="dswitch picker" role="radiogroup" aria-label="Show">
      {(["debugger", "scene"] as const).map((x) => <button key={x}
        type="button" role="radio" aria-checked={show === x}
        data-show={x} onClick={() => setShow(x)}>
        {x === "debugger" ? "Debugger" : "Scene"}</button>)}</div>
    <section className="dbgpane" aria-label="Debugger">
      {dspec ? <Lens spec={dspec} project={p.project} onReady={onReady} />
        : <p className="muted" data-running>Running {p.scene.run.build}…
        </p>}</section>
    <section className="scenepane" aria-label="Scene">
      {p.figure}
      <PinBar scene={p.scene} at={at} lenses={p.lenses} /></section>
  </div>;
}
