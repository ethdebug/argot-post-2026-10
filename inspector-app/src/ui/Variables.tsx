// Variables in scope (addendum §6): the locals the moment's context
// lists, in the one Tree, linked to the dumps of their locations; a
// compiler whose output names no locals says so in one line
import type { ComponentProps } from "react";
import { Tree } from "./Tree";
import { useCompilation } from "./hooks";

const NONE: Record<string, string> = {
  solidity: "solc's output names no locals here",
  vyper: "no ethdebug: no locals named",
};

export function Variables(p: Omit<ComponentProps<typeof Tree>, "align">) {
  const c = useCompilation(p.data);
  const none = c && NONE[c.language];
  return none ? <p id={p.domId} className="muted small novars">{none}</p>
    : <Tree {...p} align={[]} plain />;
}
