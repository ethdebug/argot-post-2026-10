// The dev/review shell (spec §5.1): one lens as a full page, a fixed
// bar to switch lenses (the picker; [ and ] previous/next, g the list),
// and a "copy link" button. The hash (#lens=<id>&<lens keys>) is only
// written here and by the lens; a reload shows the same lens.
import { useEffect, useLayoutEffect, useState } from "react";
import type { Project } from "../engine/project";
import { Lens } from "../ui/Lens";
import type { LensSpec } from "../ui/types";

const fromHash = () => new URLSearchParams(location.hash.slice(1))
  .get("lens");
const devHash = () => new URLSearchParams(location.hash.slice(1))
  .get("dev") === "1";

export function Shell({ project, lenses: every }: { project: Project;
  lenses: LensSpec[] }) {
  // "dev": the developers' lenses too, and the parity page; on by the
  // hash (dev=1), or by a link to a dev lens
  const [dev, setDev] = useState(() => devHash() ||
    !!every.find((l) => l.id === fromHash())?.dev);
  const lenses = dev ? every : every.filter((l) => !l.dev);
  const [id, setId] = useState(() =>
    lenses.find((l) => l.id === fromHash())?.id ?? lenses[0].id);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const k = Math.max(0, lenses.findIndex((l) => l.id === id));
  const spec = lenses[k];

  // the URL names the lens shown (the lens's own keys go when it changes)
  useEffect(() => {
    if (fromHash() !== spec.id || devHash() !== dev) {
      history.replaceState(null, "", `#lens=${spec.id}${dev ? "&dev=1"
        : ""}`);
    }
  }, [spec.id, dev]);

  // (bound at commit, not after paint: a key pressed as soon as the
  // shell shows is not lost)
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as Element).closest?.("input, textarea, select") ||
        e.metaKey || e.ctrlKey || e.altKey) return;
      const go = (d: number) =>
        setId(lenses[(k + d + lenses.length) % lenses.length].id);
      if (e.key === "]") go(1);
      else if (e.key === "[") go(-1);
      else if (e.key === "g") setOpen((o) => !o);
      else if (e.key === "Escape" && open) setOpen(false);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lenses, k, open]);

  const copy = async () => {
    await navigator.clipboard?.writeText(location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return <>
    <nav className="shellbar" aria-label="Lenses">
      <div className="shellpick" data-shell-picker>
        <button type="button" className="shellcur" aria-expanded={open}
          onClick={() => setOpen((o) => !o)}>
          <span className="shellk">lens</span> {spec.title}
          <span className="shellcount"> ({k + 1} of {lenses.length})</span>
        </button>
        <ul className="shelllist" data-shell-list hidden={!open}>
          {lenses.map((l) => <li key={l.id}>
            <button type="button" data-lens={l.id}
              aria-current={l.id === id ? "page" : undefined}
              onClick={() => {
                setId(l.id);
                setOpen(false);
              }}>{l.title}</button></li>)}
        </ul>
      </div>
      <button type="button" className="shelldev" data-shell-dev
        aria-pressed={dev} onClick={() => setDev((d) => !d)}>dev</button>
      {dev && <a className="shellparity" href="./">parity page</a>}
      <span className="shellkeys" aria-hidden="true"><kbd>[</kbd>
        <kbd>]</kbd> lens · <kbd>g</kbd> list</span>
      <button type="button" className="shellcopy" data-shell-copy
        onClick={copy}>{copied ? "copied" : "copy link"}</button>
    </nav>
    <div className="shellpage">
      {spec.page ? <spec.page key={spec.id} spec={spec} project={project} />
        : <Lens key={spec.id} spec={spec} project={project} hash />}
    </div>
  </>;
}
