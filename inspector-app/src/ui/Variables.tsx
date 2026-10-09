// Variables in scope (addendum §6): what the moment's decoding lists, in
// the one Tree, linked to the dumps of their locations; at a debugger's
// moment, everything in scope: the storage variables and the locals,
// a group each. A compiler whose output names no locals says so, in one
// line under them.
import type { ComponentProps } from "react";
import { Tree } from "./Tree";
import { useCompilation, useDecoded } from "./hooks";

const NONE: Record<string, string> = {
  solidity: "solc's output names no locals here",
  vyper: "no ethdebug: no locals named",
};

export function Variables(p: Omit<ComponentProps<typeof Tree>, "align">) {
  const c = useCompilation(p.data);
  const d = useDecoded(p.data);
  const locals = d?.byPath.get("@locals");
  // (no locals: the compiler's word for it, if it has one)
  const none = c && (!d || (locals && !locals.children?.length) ||
    !locals) ? NONE[c.language] : undefined;
  if (d && !locals && none) {
    return <p id={p.domId} className="muted small novars">{none}</p>;
  }
  return <div id={p.domId} className="vars">
    <Tree {...p} domId={undefined} align={[]} />
    {none && <p className="muted small novars">{none}</p>}</div>;
}
