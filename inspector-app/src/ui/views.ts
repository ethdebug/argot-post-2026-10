// The view components, by kind (the Lens draws a ViewSpec with these)
import type { ComponentType } from "react";
import type { ViewKind } from "./types";
import { Dump } from "./Dump";
import { Tree } from "./Tree";
import { Picker } from "./Picker";
import { WalkthroughPanel } from "./WalkthroughPanel";
import { ContractSource } from "./ContractSource";
import { Moment } from "./Moment";
import { Code } from "./Code";
import { Variables } from "./Variables";
import { Reveal } from "./RevealToggle";
import { TimelineBar } from "./TimelineBar";
import { Instructions } from "./Instructions";
import { CallStack } from "./CallStack";

export const viewKinds: Partial<Record<ViewKind, ComponentType<any>>> = {
  dump: Dump, tree: Tree, picker: Picker, walkthrough: WalkthroughPanel,
  contract: ContractSource, moment: Moment, code: Code,
  variables: Variables, callstack: CallStack, reveal: Reveal,
  timeline: TimelineBar, instructions: Instructions,
};
