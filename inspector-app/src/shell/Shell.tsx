// The dev/review shell (spec §5.1; addendum §3: the authoring host):
// one scene as a full page, drawn by its lens; a fixed bar to switch
// scenes (the picker; [ and ] previous/next, g the list), and a "copy
// link" button. "dev" adds the developers' scenes and the lenses no
// scene names. The hash (#scene=<id>, or #lens=<id> for a lens with no
// scene; a link to a lens shows its first scene) is only written here
// and by the lens; a reload shows the same.
import { useEffect, useLayoutEffect, useState } from "react";
import type { Project } from "../engine/project";
import type { Scene } from "../engine/scene";
import type { Figure } from "../scenes";
import { Lens } from "../ui/Lens";
import { SceneHost } from "../ui/SceneHost";
import type { LensSpec } from "../ui/types";

const hashed = (k: string) => new URLSearchParams(location.hash.slice(1))
  .get(k);
const devHash = () => hashed("dev") === "1";

// what the picker lists: a scene, or a lens no scene names (its key:
// "scene=<id>" or "lens=<id>", as the hash names it)
interface Item { id: string; key: "scene" | "lens"; title: string;
  dev: boolean; scene?: Scene; lens: LensSpec }
const keyOf = (x: Item) => `${x.key}=${x.id}`;

export function Shell({ project, lenses: every, scenes = [],
  figures = [] }: { project: Project; lenses: LensSpec[];
  scenes?: Scene[]; figures?: Figure[] }) {
  const lensOf = (id: string) => every.find((l) => l.id === id);
  const all: Item[] = [
    ...scenes.filter((s) => lensOf(s.lens)).map((s): Item => ({ id: s.id,
      key: "scene", title: s.title, dev: !!lensOf(s.lens)!.dev, scene: s,
      lens: lensOf(s.lens)! })),
    // (a figure: its lens's own page)
    ...figures.filter((f) => lensOf(f.lens)).map((f): Item => ({ id: f.id,
      key: "scene", title: f.title, dev: false, lens: lensOf(f.lens)! })),
    ...every.filter((l) => !scenes.some((s) => s.lens === l.id) &&
      !figures.some((f) => f.lens === l.id))
      .map((l): Item => ({ id: l.id, key: "lens", title: l.title,
        dev: !!l.dev, lens: l }))];
  // the hash's item: a scene, a lens with no scene, or a lens's first
  // scene
  const wanted = () => all.find((x) => x.key === "scene" &&
    x.id === hashed("scene")) ?? all.find((x) => x.key === "lens" &&
    x.id === hashed("lens")) ?? all.find((x) => x.lens.id ===
    hashed("lens"));
  // "dev": on by the hash (dev=1), or by a link to a dev item
  const [dev, setDev] = useState(() => devHash() || !!wanted()?.dev);
  const items = dev ? all : all.filter((x) => !x.dev);
  const [id, setId] = useState(() => {
    const w = wanted();
    return keyOf(w && items.includes(w) ? w : items[0]);
  });
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const k = Math.max(0, items.findIndex((x) => keyOf(x) === id));
  const item = items[k];

  // the URL names the item shown (the lens's own keys go when it changes)
  useEffect(() => {
    if (hashed(item.key) !== item.id || devHash() !== dev) {
      history.replaceState(null, "", `#${item.key}=${item.id}${dev
        ? "&dev=1" : ""}`);
    }
  }, [item, dev]);

  // (bound at commit, not after paint: a key pressed as soon as the
  // shell shows is not lost)
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.("input, textarea, select") ||
        e.metaKey || e.ctrlKey || e.altKey) return;
      const go = (d: number) =>
        setId(keyOf(items[(k + d + items.length) % items.length]));
      if (e.key === "]") go(1);
      else if (e.key === "[") go(-1);
      else if (e.key === "g") setOpen((o) => !o);
      else if (e.key === "Escape" && open) setOpen(false);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [items, k, open]);

  const copy = async () => {
    await navigator.clipboard?.writeText(location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return <>
    <nav className="shellbar" aria-label="Scenes">
      <div className="shellpick" data-shell-picker>
        <button type="button" className="shellcur" aria-expanded={open}
          onClick={() => setOpen((o) => !o)}>
          <span className="shellk">{item.key}</span> {item.title}
          <span className="shellcount"> ({k + 1} of {items.length})</span>
        </button>
        <ul className="shelllist" data-shell-list hidden={!open}>
          {items.map((x) => <li key={keyOf(x)}>
            <button type="button" {...{ [`data-${x.key}`]: x.id }}
              data-lens={x.lens.id}
              aria-current={keyOf(x) === id ? "page" : undefined}
              onClick={() => {
                setId(keyOf(x));
                setOpen(false);
              }}>{x.title}</button></li>)}
        </ul>
      </div>
      <button type="button" className="shelldev" data-shell-dev
        aria-pressed={dev} onClick={() => setDev((d) => !d)}>dev</button>
      {dev && <a className="shellparity" href="./">parity page</a>}
      <span className="shellkeys" aria-hidden="true"><kbd>[</kbd>
        <kbd>]</kbd> scene · <kbd>g</kbd> list</span>
      <button type="button" className="shellcopy" data-shell-copy
        onClick={copy}>{copied ? "copied" : "copy link"}</button>
    </nav>
    <div className="shellpage">
      {item.lens.page
        ? <item.lens.page key={keyOf(item)} spec={item.lens}
          project={project} />
        : item.scene
          ? <SceneHost key={keyOf(item)} scene={item.scene}
            project={project} lenses={every} mode="authoring" hash />
          : <Lens key={keyOf(item)} spec={item.lens} project={project}
            hash />}
    </div>
  </>;
}
