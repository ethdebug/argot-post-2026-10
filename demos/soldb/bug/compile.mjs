// Setup: compile tally.bug with bugc's API (the CLI prints bytecode but
// not the ethdebug program). Writes out/Tally.bin (creation code),
// out/Tally.runtime.bin and tally.program.json (bugc's runtime program,
// unchanged), at optimization level 2 (inlines `dbl`).
// Usage: node compile.mjs <path to packages/bugc>
import fs from "fs";
const bugc = await import(`${process.argv[2]}/dist/src/index.js`);
const source = fs.readFileSync("tally.bug", "utf8");
const r = await bugc.compile({ to: "bytecode", source,
  optimizer: { level: 2 }, sourcePath: "tally.bug" });
if (!r.success) throw new Error(JSON.stringify(r.messages ?? r, null, 1));
const b = r.value.bytecode;
const hex = (u8) => Buffer.from(u8).toString("hex");
fs.mkdirSync("out", { recursive: true });
fs.writeFileSync("out/Tally.bin", hex(b.create));
fs.writeFileSync("out/Tally.runtime.bin", hex(b.runtime));
fs.writeFileSync("tally.program.json",
  JSON.stringify(b.runtimeProgram, null, 1));
console.log(Object.keys(r.value), Object.keys(b),
  b.runtimeProgram.instructions.length, "instructions");
