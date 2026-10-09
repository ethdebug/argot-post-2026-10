// Writes the arcade scenario's builds, scenarios/arcade/builds/<id>/
// build.json (src/engine/run/build.ts buildOf reads them): Arcade.sol by
// Walnut's solc (SOLC), Arcade.vy by vyper (VYPER), arcade.bug by bugc
// at -O 0 and -O 2 (BUGC). Compiling only: the runner executes them.
// The creation code carries the constructor's argument, the first motd
// (BUG's create block sets it itself). Run by bin/build-arcade.sh.
// ONLY=bug: the bugc builds alone (BUGC only), the others kept as they
// are.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bug, solidity, vyper } from "./compile.mjs";

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const demo = path.join(app, "..", "demos", "inspector");
const out = path.join(app, "scenarios", "arcade", "builds");
// (test/expect.ts MOTD[0])
const MOTD = "season 2 starts friday, see you on the leaderboard";

// abi.encode(string): offset, length, the bytes padded to words
const word = (n) => n.toString(16).padStart(64, "0");
const bytes = Buffer.from(MOTD, "utf8");
const ctor = word(32n) + word(BigInt(bytes.length)) +
  bytes.toString("hex").padEnd(Math.ceil(bytes.length / 32) * 64, "0");

// one instruction a line, so a rebuild's diff reads by instruction
const program = (p) => `{${Object.entries(p).map(([k, v]) =>
  `${JSON.stringify(k)}:${k === "instructions"
    ? `[\n${v.map((i) => JSON.stringify(i)).join(",\n")}\n]`
    : JSON.stringify(v)}`).join(",")}}`;
const text = (b) => `{\n${Object.entries(b).map(([k, v]) =>
  `${JSON.stringify(k)}: ${k === "programs" ? `{${Object.entries(v)
    .filter(([, p]) => p).map(([n, p]) =>
      `${JSON.stringify(n)}:\n${program(p)}`).join(",\n")}}`
    : JSON.stringify(v)}`).join(",\n")}\n}\n`;
// (and builds.json: each build's language, compiler and compilation,
// and whether it carries ethdebug: what the page knows before it loads
// a build; src/engine/scene.ts)
const only = process.env.ONLY;
const index = only ? JSON.parse(fs.readFileSync(path.join(out, "..",
  "builds.json"), "utf8")) : {};
const write = (id, b) => {
  fs.mkdirSync(path.join(out, id), { recursive: true });
  fs.writeFileSync(path.join(out, id, "build.json"), text(b));
  index[id] = { language: b.language, compiler: b.compiler,
    compilation: b.compilation, ethdebug: !!b.programs };
  console.log(id, b.compiler, `${(text(b).length / 1024).toFixed(0)} KB`);
};

if (!only) {
  const sol = solidity({ solc: process.env.SOLC,
    file: path.join(demo, "contracts", "Arcade.sol"), name: "Arcade" });
  write("sol", {
    language: "solidity", compiler: `solc ${sol.compiler} (walnut #10)`,
    create: sol.bytecode + ctor, programs: sol.programs,
    resources: sol.resources,
    sources: sol.compilation.sources.map((s) =>
      ({ id: String(s.id), path: s.path, text: s.contents })),
    compilation: "arcade-sol",
  });

  const vy = vyper({ vyper: process.env.VYPER,
    file: path.join(demo, "contracts", "Arcade.vy") });
  write("vy", {
    language: "vyper", compiler: `vyper ${vy.compiler}`,
    create: vy.bytecode + ctor,
    sources: [{ id: "0", path: vy.file, text: vy.source }],
    compilation: "arcade-vy-rule",
  });
}

for (const level of [0, 2]) {
  const b = await bug({ bugc: process.env.BUGC, level,
    file: path.join(demo, "bug", "arcade.bug"), rel: "bug/arcade.bug" });
  write(`bug-O${level}`, {
    language: "bug", compiler: b.compiler, create: b.create,
    programs: b.programs,
    sources: [{ id: b.file, path: b.file, text: b.source }],
    compilation: `arcade-bug-O${level}`,
  });
}

fs.writeFileSync(path.join(out, "..", "builds.json"),
  JSON.stringify(index, null, 2) + "\n");
