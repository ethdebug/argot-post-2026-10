// Which annotators (hooks.ts) a walkthrough uses: its input's own list,
// else its compilation's language's. solc's storage: the page's keys,
// the on-chain names, a focus per entry, solc's layout, another
// compiler's storage read by its rule. Any other compilation: none, the
// fold's own words.
import type { Annotator } from "./hooks";
import type { WalkInput } from "./fold";
import { contrast, keys, names, records, solidity } from "./solidity";

export const ANNOTATORS: Record<string, Annotator[]> = {
  solidity: [keys, names, records, solidity, contrast],
};

export const annotatorsFor = (x: WalkInput): Annotator[] =>
  x.annotators ?? ANNOTATORS[x.c.language] ?? [];
