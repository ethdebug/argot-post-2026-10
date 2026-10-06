// Setup: compile a BUG file with bugc's API (the CLI prints bytecode but
// not the ethdebug program). Writes <dir>/out/<Name>.bin (creation
// code), <dir>/out/<Name>.runtime.bin and <dir>/<stem>.program.json
// (bugc's runtime program, unchanged). <Name> is the program's `name`.
// Usage: node compile.mjs <path to packages/bugc> [file] [level] [dir]
// Defaults: tally.bug at optimization level 2 (inlines `dbl`), in ".".
// The BUG tab's data: weights.bug at levels 0 and 2, into weights-O0
// and weights-O2, by bugc from ethdebug/format main.
import fs from "fs";
const [lib, file = "tally.bug", level = "2", dir = "."] =
  process.argv.slice(2);
const bugc = await import(`${lib}/dist/src/index.js`);
const source = fs.readFileSync(file, "utf8");
const r = await bugc.compile({ to: "bytecode", source,
  optimizer: { level: +level }, sourcePath: file });
if (!r.success) throw new Error(JSON.stringify(r.messages ?? r, null, 1));
const b = r.value.bytecode;
const name = source.match(/^name (\w+);/m)[1];
const stem = file.replace(/\.bug$/, "");
const hex = (u8) => Buffer.from(u8).toString("hex");
fs.mkdirSync(`${dir}/out`, { recursive: true });
fs.writeFileSync(`${dir}/out/${name}.bin`, hex(b.create));
fs.writeFileSync(`${dir}/out/${name}.runtime.bin`, hex(b.runtime));
fs.writeFileSync(`${dir}/${stem}.program.json`,
  JSON.stringify(b.runtimeProgram, null, 1));
console.log(Object.keys(r.value), Object.keys(b),
  b.runtimeProgram.instructions.length, "instructions");
