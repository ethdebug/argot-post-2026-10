// The walkthrough's words that are not a step's own: the construct a
// step is about (one axis for every step: the bar's "construct: …"), the
// spec page of it (a fixed label, no number), and the step's place
// ("start", "3 / 9", "done")
import type { Step } from "./fold";

const SPEC = "https://ethdebug.github.io/format/spec/pointer/";
export const FOOT: Record<string, [string, string]> = {
  pointer: ["Pointers: a variable's bytes", `${SPEC}overview/`],
  "~keccak256": ["Expressions: keccak256",
    `${SPEC}expression/#keccak256-hashes`],
  template: ["Pointer templates", `${SPEC}template/`],
  group: ["Group (a collection of pointers)", `${SPEC}collection/group/`],
  region: ["Storage regions: slot, offset, length",
    `${SPEC}region/location/storage/`],
  if: ["Conditional (if, then, else)", `${SPEC}collection/conditional/`],
  list: ["List (a collection of pointers)", `${SPEC}collection/list/`],
};
// the one construct of a step that gets a spec link
export const footOf = (st: Step) => st.constructs.find((c) => FOOT[c]);

// What a step is about, on one axis: the pointer's construct (none for
// step 0, found, and the page's or another rule's facts)
const CONSTRUCT: Record<string, string> = {
  input: "input", declared: "declared", template: "template",
  handoff: "define", fields: "region", read: "region", data: "region",
  item: "list", if: "if",
};
export const constructOf = (st: Step) => CONSTRUCT[st.phase] ?? "";

// A step's place, as the bar shows it: step 0 "start"; the last, when
// it is found (or what follows it), "done"; the others counted
export function placeOf(steps: Step[], i: number): string {
  const goal = steps[0]?.goal ? 1 : 0;
  const end = steps.length > 1 && ["found", "external"].includes(
    steps.at(-1)!.phase) ? 1 : 0;
  if (steps[i]?.goal) return "start";
  if (end && i === steps.length - 1) return "done";
  return `${i + 1 - goal} / ${steps.length - goal - end}`;
}
