// The memory section, "Inside one play" (vanilla mem.js): Arcade's BUG
// port, compiled by bugc at O0 and O2, paused at three points; the
// locals bugc lists there, in memory (and alice's record slot); a level
// and a pause picker; at a two-step pause, both steps' words; the
// values, how one was found (the storage section's walkthrough, over
// bugc's pointers), the source. Its own link group and keys
// (mopt, mpt, msel): the storage section's are not its own.
import { panel } from "../ui/Panel";
import type { LensSpec } from "../ui/types";

const NOW = { decoding: "$scene", moment: "current" } as const;
const BEFORE = { decoding: "$scene", moment: "previous" } as const;

export const insideOnePlay: LensSpec = {
  id: "inside-one-play", title: "Inside one play (locals in memory)",
  timelines: ["mem-O0", "mem-O2"], decodings: ["mem:O0", "mem:O2"],
  bookmarks: ["O0/roll", "O0/mult", "O0/writes", "O2/roll", "O2/mult",
    "O2/writes"],
  grid: '"meta meta" "level level" "point point" ' +
    '"viewing viewing" "note note" "bar bar" "rows tree" "dump tree" ' +
    '"sdump tree" ' +
    '"legend src" ". src"',
  links: ["mem"],
  views: [
    { id: "meta", kind: "note", part: "meta", area: "meta",
      domId: "mmeta", data: NOW },
    { id: "level", kind: "picker", of: "level", area: "level",
      domId: "mlevel" },
    { id: "point", kind: "picker", of: "points", area: "point",
      domId: "mpoint" },
    { id: "viewing", kind: "note", part: "viewing", area: "viewing",
      domId: "mviewing", link: "mem", data: NOW },
    { id: "note", kind: "note", part: "note", area: "note", domId: "mnote",
      data: NOW },
    // (one panel a location: memory's words, and the storage slot the
    // page reads, alice's record, at the last pause)
    { id: "before", kind: "dump", area: "dump", location: "memory",
      link: "mem", data: BEFORE, compare: NOW, idle: "hidden",
      title2: "Before" },
    { id: "after", kind: "dump", area: "dump", location: "memory",
      link: "mem", data: NOW, compare: BEFORE, title: "",
      title2: "After" },
    { id: "sbefore", kind: "dump", area: "sdump", location: "storage",
      link: "mem", data: BEFORE, compare: NOW, idle: "hidden",
      title2: "Before" },
    { id: "safter", kind: "dump", area: "sdump", location: "storage",
      link: "mem", data: NOW, compare: BEFORE, title: "",
      title2: "After" },
    // All | Related (the storage section's, for this section's own
    // selection)
    { id: "rows", kind: "picker", of: "related", area: "rows",
      link: "mem", domId: "mrelated" },
    // (not lined up with the words: vanilla's memory section)
    { id: "tree", kind: "tree", area: "tree", link: "mem", domId: "mtree",
      data: NOW, compare: BEFORE, align: [], plain: true },
    // the selection and how it was found: the walkthrough, as the
    // storage section's
    { id: "walk", kind: "walkthrough", area: "bar", link: "mem",
      domId: "mdetails", data: NOW, compare: BEFORE },
    { id: "legend", kind: "source", part: "legend", area: "legend",
      domId: "msrclegend", data: NOW },
    { id: "src", kind: "source", area: "src", domId: "msrc",
      data: NOW },
  ],
  hash: { prefix: "m", levels: true },
  wrap: { dump: panel("mpanel", "mem", "memory"),
    sdump: panel("mspanel", "mem") },
  areas: { dump: "dump", sdump: "dump", tree: "treebox" },
};
