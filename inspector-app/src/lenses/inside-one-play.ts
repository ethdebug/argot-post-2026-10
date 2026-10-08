// The memory section, "Inside one play" (vanilla mem.js): Arcade's BUG
// port, compiled by bugc at O0 and O2, paused at three points; the
// locals bugc lists there, in memory (and alice's record slot); a level
// and a pause picker, Before | After at a two-step pause; the words, the
// values, how one was found, the source. Its own link group and keys
// (mopt, mpt, mmode, msel): the storage section's are not its own.
import { panel } from "../ui/Panel";
import type { LensSpec } from "../ui/types";

const at = (slot: string) => ({ decoding: "$bm", point: { slot } });

export const insideOnePlay: LensSpec = {
  id: "inside-one-play", title: "Inside one play (locals in memory)",
  timelines: ["mem-O0", "mem-O2"], decodings: ["mem:O0", "mem:O2"],
  bookmarks: ["O0/roll", "O0/mult", "O0/writes", "O2/roll", "O2/mult",
    "O2/writes"],
  grid: '"meta meta" "level level" "point point" "mode mode" ' +
    '"viewing viewing" "note note" "dump tree" "sdump tree" ' +
    '"details how" ' +
    '"legend src" ". src"',
  links: ["mem"],
  views: [
    { id: "meta", kind: "note", part: "meta", area: "meta",
      domId: "mmeta", data: at("b") },
    { id: "level", kind: "picker", of: "level", area: "level",
      domId: "mlevel" },
    { id: "point", kind: "picker", of: "points", area: "point",
      domId: "mpoint" },
    { id: "mode", kind: "picker", of: "side", area: "mode", domId: "mmode",
      row: "mmoderow" },
    { id: "viewing", kind: "note", part: "viewing", area: "viewing",
      domId: "mviewing", link: "mem", data: at("b") },
    { id: "note", kind: "note", part: "note", area: "note", domId: "mnote",
      data: at("b") },
    // (one panel a location: memory's words, and the storage slot the
    // page reads, alice's record, at the last pause)
    { id: "before", kind: "dump", area: "dump", location: "memory",
      link: "mem", data: at("a"), side: "before", title: "Memory",
      steps: true },
    { id: "after", kind: "dump", area: "dump", location: "memory",
      link: "mem", data: at("b"), side: "after", title: "Memory",
      steps: true },
    { id: "sbefore", kind: "dump", area: "sdump", location: "storage",
      link: "mem", data: at("a"), side: "before", title: "Storage",
      steps: true },
    { id: "safter", kind: "dump", area: "sdump", location: "storage",
      link: "mem", data: at("b"), side: "after", title: "Storage",
      steps: true },
    // (not lined up with the words: vanilla's memory section)
    { id: "tree", kind: "tree", area: "tree", link: "mem", domId: "mtree",
      data: at("$side"), align: [], plain: true },
    { id: "details", kind: "details", area: "details", link: "mem",
      domId: "mdetails", data: at("b") },
    { id: "how", kind: "derivation", area: "how", link: "mem",
      domId: "mhow", data: at("b") },
    { id: "legend", kind: "source", part: "legend", area: "legend",
      domId: "msrclegend", data: at("b") },
    { id: "src", kind: "source", area: "src", domId: "msrc",
      data: at("b") },
  ],
  hash: { prefix: "m", levels: true },
  wrap: { dump: panel("mpanel", "mem", "memory"),
    sdump: panel("mspanel", "mem") },
  areas: { dump: "dump", sdump: "dump", tree: "treebox" },
};
