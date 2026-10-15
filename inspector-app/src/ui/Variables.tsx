// Variables in scope (addendum §6): what the moment's decoding lists, in
// the one Tree, linked to the dumps of their locations; at a debugger's
// moment, everything in scope: the storage variables and the locals,
// a group each. A compiler whose output names no locals says so, in one
// line under them.
import { useLayoutEffect, useRef, type ComponentProps } from "react";
import { Tree } from "./Tree";
import { useCompilation, useDecoded, useLens } from "./hooks";
import { useEdges } from "./PointerYaml";

const NONE: Record<string, string> = {
  solidity: "solc's output names no locals here",
  vyper: "no ethdebug: no locals named",
};

export function Variables({ edges: scrolls, ...p }:
  Omit<ComponentProps<typeof Tree>, "align"> & { edges?: boolean }) {
  const c = useCompilation(p.data);
  const { spec } = useLens();
  const walkSlot = spec.views.some((v) => v.kind === "walkthrough" &&
    v.button);
  const d = useDecoded(p.data);
  // (`edges`: the tree's box, scrolling inside the column; its edges'
  // buttons, and its classes for the fades)
  const me = useRef<HTMLDivElement>(null);
  const tree = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    tree.current = me.current?.querySelector<HTMLElement>(":scope > .tree")
      ?? null;
  });
  const { more, edge } = useEdges(tree, !!scrolls, [d], {
    what: "the variables", band: "the lit rows", on: ".row.hl" });
  useLayoutEffect(() => {
    tree.current?.classList.toggle("more-up", more.up);
    tree.current?.classList.toggle("more-down", more.down);
  });
  const locals = d?.byPath.get("@locals");
  // (no locals: the compiler's word for it, if it has one)
  const none = c && (!d || (locals && !locals.children?.length) ||
    !locals) ? NONE[c.language] : undefined;
  if (d && !locals && none) {
    return <p id={p.domId} className="muted small novars">{none}</p>;
  }
  return <div ref={me} id={p.domId} className="vars">
    <Tree {...p} domId={undefined} align={[]} />
    {none && <p className="muted small novars">{none}</p>}
    {scrolls && <>{edge("up")}{edge("down")}</>}
    {/* (the walkthrough's way in and out, its room kept: the panel
      draws its button here, ui/WalkthroughPanel.tsx) */}
    {walkSlot && <div className="wslot" />}</div>;
}
