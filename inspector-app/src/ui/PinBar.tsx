// Authoring's pins (addendum §3.1): the scene's moments, each to unpin;
// "Pin this moment" adds the debugger's moment (with a label) to the
// scene; "New scene from here" makes a scene of it (a lens, a title).
// Each writes scenes/<id>.json through the dev server (POST
// /__scene/<id>); with no dev server, the scene's JSON is copied.
import { useState } from "react";
import { pin, sceneJson, unpin, type Scene } from "../engine/scene";
import type { MomentRef } from "../engine/run/types";
import type { LensSpec } from "./types";

const momentText = (m: MomentRef) => m.step === "end"
  ? `after transaction ${m.tx}` : `transaction ${m.tx}, trace step ${
    m.step}`;
const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "").slice(0, 40) || "scene";

async function save(s: Scene): Promise<string> {
  try {
    const r = await fetch(`${import.meta.env.BASE_URL}__scene/${s.id}`,
      { method: "POST", body: sceneJson(s) });
    if (r.ok) return `saved scenes/${s.id}.json`;
    throw new Error(await r.text());
  } catch (e) {
    await navigator.clipboard?.writeText(sceneJson(s)).catch(() => {});
    return `no dev server to write to (${(e as Error)?.message ?? e}): ` +
      "the scene's JSON is copied";
  }
}

export function PinBar(p: { scene: Scene; at?: MomentRef;
  lenses: LensSpec[] }) {
  const [label, setLabel] = useState("");
  const [title, setTitle] = useState("");
  const [lens, setLens] = useState(p.scene.lens);
  const [said, setSaid] = useState("");
  const write = async (s: Scene) => setSaid(await save(s));
  const at = p.at;
  return <div className="pinbar" data-pinbar>
    <p className="pinhead">Pinned in <b>{p.scene.title}</b></p>
    <ol className="pins">{p.scene.timeline.map((m, i) =>
      <li key={`${m.tx}:${m.step}`} data-pin={`${m.tx}:${m.step}`}>
        <span>{m.label ?? momentText(m)}</span>{" "}
        <span className="muted small">{momentText(m)}</span>{" "}
        <button type="button" className="btn" aria-label={`Unpin ${
          momentText(m)}`} disabled={p.scene.timeline.length < 2}
          onClick={() => void write(unpin(p.scene, i))}>×</button>
      </li>)}</ol>
    <div className="pinrow">
      <input aria-label="Label" placeholder="label (optional)"
        value={label} onChange={(e) => setLabel(e.target.value)} />
      <button type="button" className="btn" data-pin-this disabled={!at}
        onClick={() => at && void write(pin(p.scene, at, label || undefined))}>
        Pin this moment{at ? ` (${momentText(at)})` : ""}</button>
    </div>
    <div className="pinrow">
      <input aria-label="Title" placeholder="new scene's title"
        value={title} onChange={(e) => setTitle(e.target.value)} />
      <select aria-label="Lens" value={lens}
        onChange={(e) => setLens(e.target.value)}>
        {p.lenses.map((l) => <option key={l.id} value={l.id}>{l.title}
        </option>)}</select>
      <button type="button" className="btn" data-new-scene
        disabled={!at || !title}
        onClick={() => at && void write({ id: slug(title), title,
          run: p.scene.run, lens, controls: "none",
          timeline: [{ tx: at.tx, step: at.step }] })}>
        New scene from here</button>
    </div>
    <p className="muted small" aria-live="polite" data-pin-said>{said}</p>
  </div>;
}
