// The program x-ray's data (src/figures/xray-data.json), from the files
// the real debugger loads (../demos/debugger/): for each compiler, the
// instructions of Arcade's play(), the first to the last whose range is
// in play's body (and every instruction between them), each entry as
// the compiler wrote it, unchanged; where they sit in the program; and
// the source. Run it again when those files change:
//   node bin/xray-data.mjs
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const dbg = path.resolve(here, "../../demos/debugger");
const read = (f) => fs.readFileSync(path.join(dbg, f), "utf8");

// (each list named as in the program object itself: Fe's file holds
// its programs in a list of its own, not the format's; the figure shows
// the `call` one, as the real debugger does)
// the instructions from the first to the last with a range of source 0
// inside [from, to) (byte offsets of the function's text), and where
// the first is in the program's list
function window(ins, text, from, to) {
  const bytes = (s) => Buffer.byteLength(text.slice(0, text.indexOf(s)));
  const [a, b] = [bytes(from), bytes(to)];
  const inside = (i) => {
    const c = i.context?.code;
    return c && c.source?.id === 0 && c.range.offset >= a &&
      c.range.offset + c.range.length <= b;
  };
  const first = ins.findIndex(inside);
  const last = ins.findLastIndex(inside);
  return { at: first, total: ins.length,
    instructions: ins.slice(first, last + 1) };
}

const solText = read("sol/Arcade.sol");
const solProgram = JSON.parse(read(
  "sol/ethdebug/Arcade_ethdebug-runtime.json"));
const feText = read("fe/arcade.fe");
const feFile = JSON.parse(read("fe/arcade.ethdebug.json"));
const feIndex = feFile.programs.findIndex((p) => p.environment === "call");

const out = {
  sol: { compiler: "solc", file: "Arcade_ethdebug-runtime.json",
    list: "instructions", source: { path: "Arcade.sol", text: solText },
    ...window(solProgram.instructions, solText, "function play()",
      "function setMotd") },
  fe: { compiler: "Fe", file: "arcade.ethdebug.json",
    list: "instructions",
    source: { path: "arcade.fe", text: feText },
    ...window(feFile.programs[feIndex].instructions, feText, "Play uses",
      "SetMotd { text }") },
};
fs.writeFileSync(path.join(here, "../src/figures/xray-data.json"),
  JSON.stringify(out) + "\n");
for (const [k, v] of Object.entries(out)) {
  console.log(k, `${v.at}–${v.at + v.instructions.length - 1} of`,
    v.total);
}
