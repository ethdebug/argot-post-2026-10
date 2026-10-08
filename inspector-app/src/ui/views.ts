// The view components, by kind (the Lens draws a ViewSpec with these)
import type { ComponentType } from "react";
import type { ViewKind } from "./types";
import { Dump } from "./Dump";
import { Tree } from "./Tree";
import { Picker } from "./Picker";
import { WalkthroughPanel } from "./WalkthroughPanel";
import { Calldata } from "./Calldata";
import { Derivation, LocalsDetails, Note, Source } from "./Locals";
import { ContractSource } from "./ContractSource";

export const viewKinds: Partial<Record<ViewKind, ComponentType<any>>> = {
  dump: Dump, tree: Tree, picker: Picker, walkthrough: WalkthroughPanel,
  calldata: Calldata,
  details: LocalsDetails, derivation: Derivation, source: Source,
  note: Note, contract: ContractSource,
};
