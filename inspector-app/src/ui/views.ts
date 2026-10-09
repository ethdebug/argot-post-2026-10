// The view components, by kind (the Lens draws a ViewSpec with these)
import type { ComponentType } from "react";
import type { ViewKind } from "./types";
import { Dump } from "./Dump";
import { Tree } from "./Tree";
import { Picker } from "./Picker";
import { WalkthroughPanel } from "./WalkthroughPanel";
import { AbiView } from "./Calldata";
import { Note, Source } from "./Locals";
import { ContractSource } from "./ContractSource";
import { Moment } from "./Moment";
import { Code } from "./Code";
import { Variables } from "./Variables";
import { Moves } from "./Moves";

export const viewKinds: Partial<Record<ViewKind, ComponentType<any>>> = {
  dump: Dump, tree: Tree, picker: Picker, walkthrough: WalkthroughPanel,
  abi: AbiView,
  source: Source,
  note: Note, contract: ContractSource, moment: Moment, code: Code,
  variables: Variables, moves: Moves,
};
