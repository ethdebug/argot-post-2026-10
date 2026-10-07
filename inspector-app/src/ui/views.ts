// The view components, by kind (the Lens draws a ViewSpec with these)
import type { ComponentType } from "react";
import type { ViewKind } from "./types";
import { Dump } from "./Dump";
import { Tree } from "./Tree";
import { Picker } from "./Picker";

export const viewKinds: Partial<Record<ViewKind, ComponentType<any>>> = {
  dump: Dump, tree: Tree, picker: Picker,
};
