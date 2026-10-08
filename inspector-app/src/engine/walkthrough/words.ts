// The walkthrough's words that are not a step's own (vanilla main.js
// shortCap, FOOT): a step's short caption, for the bar, and the spec
// page of its main construct
import type { Step } from "./fold";

const SPEC = "https://ethdebug.github.io/format/spec/pointer/";
export const FOOT: Record<string, [string, string]> = {
  pointer: ["A pointer is a region or a collection of pointers",
    `${SPEC}concepts/#a-pointer-is-a-region-or-a-collection-of-other-pointers`],
  $keccak256: ["Expressions: keccak256",
    `${SPEC}expression/#keccak256-hashes`],
  template: ["Pointer templates", `${SPEC}template/`],
  group: ["Group (a collection of pointers)", `${SPEC}collection/group/`],
  region: ["Storage regions: slot, offset, length",
    `${SPEC}region/location/storage/`],
  if: ["Conditional (if, then, else)", `${SPEC}collection/conditional/`],
  list: ["List (a collection of pointers)", `${SPEC}collection/list/`],
};
// the one construct of a step that gets a footnote
export const footOf = (st: Step) => st.constructs.find((c) => FOOT[c]);

// The short caption of a step, for the bar over the dump
export function shortCap(st: Step, variable: string): string {
  switch (st.phase) {
    case "goal": return "what we're about to find";
    case "declared": return `\`${variable}\`${variable.endsWith("s") ? "'"
      : "'s"} own slot`;
    case "input": return st.chip === "key" ? "the key" : "the keys";
    case "handoff": return st.tkind === "struct" ? "the record's slot"
      : "into a template";
    case "read": return st.rname === "length" ? "the length" : "a flag";
    case "if": return "a branch";
    case "data": return "the text";
    case "template": return "a template's inputs";
    case "item": return "the items, from a hash";
    case "fields": return st.rows.length > 1 ? "packed fields" : "its field";
    default: return st.cap;
  }
}
