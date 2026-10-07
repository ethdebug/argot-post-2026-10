// The view components, by kind (the Lens draws a ViewSpec with these)
import type { ComponentType } from "react";
import type { ViewKind } from "./types";

export const viewKinds: Partial<Record<ViewKind, ComponentType<any>>> = {};
