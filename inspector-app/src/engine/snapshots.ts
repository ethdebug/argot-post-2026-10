// A scene's snapshot file from a project over its run (the snapshot
// build, bin/vite-scenes.ts): its moments' states cut to what its
// decodings read
import type { Decoded, Hex } from "./types";
import type { Project } from "./project";
import { decode } from "./decode";
import { pointOf, timelineOf, type Scene } from "./scene";
import type { SceneSnapshot } from "./source";
import { snapshotFile } from "./source-run";
import { slotHex, toBig } from "./hex";

// The storage slots decodings read: every region of every value (and
// what was read to find it), every region the dereferences made, and
// each variable's own slot (a mapping's holds none of its data; the
// dump shows it)
export function slotsRead(ds: Decoded[]): Set<Hex> {
  const out = new Set<Hex>();
  const add = (r: { location: string; slot?: bigint }) => {
    if (r.location === "storage" && r.slot !== undefined) {
      out.add(slotHex(r.slot));
    }
  };
  for (const d of ds) {
    for (const n of d.byPath.values()) {
      n.regions.forEach(add);
      n.reads?.forEach(add);
    }
    for (const g of d.graphs.values()) {
      for (const node of g.nodes.values()) {
        for (const i of node.instances) {
          if (i.region) add(i.region);
          if (node.kind === "declared" && i.value) {
            out.add(slotHex(toBig(i.value)));
          }
        }
      }
    }
  }
  return out;
}

export async function sceneSnapshot(p: Project, scene: Scene):
  Promise<SceneSnapshot> {
  const timeline = timelineOf(scene.id);
  const ds = Object.values(p.decodings).filter((d) =>
    d.timeline === timeline);
  const compilations = await Promise.all([...new Set(ds.map((d) =>
    d.compilation))].map((c) => p.compilation(c)));
  const src = await p.source(scene.id);
  // (the slots read at a moment depend on its transaction, its storage,
  // the mapping keys seen so far and the variables there whose pointers
  // read storage: decoded once for each of those, not at every one of a
  // replay's moments)
  const once = new Map<string, Promise<Set<Hex>>>();
  const keyOf = async (i: number) => {
    const m = src.moment(i);
    const st = await src.state(i);
    const vars: unknown[] = [];
    const walk = (c: unknown) => {
      if (!c || typeof c !== "object") return;
      if (Array.isArray(c)) return c.forEach(walk);
      const o = c as Record<string, unknown>;
      if (Array.isArray(o.variables)) {
        for (const v of o.variables) {
          if (JSON.stringify(v).includes('"storage"')) vars.push(v);
        }
      }
      for (const [k, x] of Object.entries(o)) if (k !== "variables") walk(x);
    };
    walk(m.context);
    // (and the mapping keys seen so far: the hashes' inputs)
    const f = src.facts(i);
    return JSON.stringify([m.tx, [...st.storage].sort(([a], [b]) =>
      a < b ? -1 : 1), vars, f?.keccakInputs ?? null,
    f ? [...f.reads, ...f.writes] : null]);
  };
  return snapshotFile(scene, src, {
    compilations, decodings: ds,
    slots: async (i) => {
      const k = await keyOf(i);
      if (!once.has(k)) {
        once.set(k, (async () => slotsRead(await Promise.all(ds.map((d) =>
          decode(p, d, pointOf(scene.id, i))))))());
      }
      return once.get(k)!;
    },
  });
}
