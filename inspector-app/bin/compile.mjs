// Arcade's compilers, one function each: Walnut's solc (walnuthq/solidity
// PR #10) with ethdebug, vyper, and bugc at an optimization level. Used
// by bin/build-arcade.mjs (the scenario's builds).
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const run = (bin, args, input) => execFileSync(bin, args,
  { encoding: "utf8", maxBuffer: 1 << 30, ...(input ? { input } : {}) });

// solc --standard-json: viaIR, optimizer off, experimental, ethdebug
// debug info. Selecting ethdebug.resources and ethdebug.compilation for
// contracts gives the global `ethdebug` output (resources.types,
// resources.pointers, the compilation's sources); the deployed code's
// program has the program-level context (`variables`).
export function solidity({ solc = "solc", file, name }) {
  const base = path.basename(file);
  const source = fs.readFileSync(file, "utf8");
  const compiler = run(solc, ["--version"]).match(/Version: (\S+)/)[1];
  const input = {
    language: "Solidity",
    sources: { [base]: { content: source } },
    settings: {
      viaIR: true,
      optimizer: { enabled: false },
      experimental: true,
      debug: { debugInfo: ["ethdebug", "ast-id"] },
      outputSelection: {
        "*": {
          "*": ["evm.bytecode.object", "evm.bytecode.ethdebug",
            "evm.deployedBytecode.ethdebug", "ethdebug.resources",
            "ethdebug.compilation"],
          "": ["ast"],
        },
      },
    },
  };
  const out = JSON.parse(run(solc, ["--standard-json"],
    JSON.stringify(input)));
  const errors = (out.errors ?? []).filter((e) => e.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.message).join("\n"));
  if (!out.ethdebug?.resources) throw new Error("no ethdebug.resources");
  const c = out.contracts[base][name];
  const runtime = c.evm.deployedBytecode.ethdebug;
  if (!runtime?.context?.variables) {
    throw new Error(`${name}: no program-level variables`);
  }
  return {
    name, file: base, source, compiler,
    bytecode: "0x" + c.evm.bytecode.object,
    programs: { create: c.evm.bytecode.ethdebug, runtime },
    resources: out.ethdebug.resources,
    compilation: out.ethdebug.compilation,
    ast: out.sources[base].ast,
  };
}

// vyper: the creation bytecode and the storage layout
export function vyper({ vyper = "vyper", file }) {
  return {
    file: path.basename(file),
    source: fs.readFileSync(file, "utf8"),
    compiler: run(vyper, ["--version"]).trim(),
    bytecode: run(vyper, ["-f", "bytecode", file]).trim(),
    layout: JSON.parse(run(vyper, ["-f", "layout", file])).storage_layout,
  };
}

// bugc (a built packages/bugc of an ethdebug/format checkout) at -O
// `level`: the create and runtime programs, their sources named `rel`
// (bugc names a source by the path it is given)
export async function bug({ bugc, file, rel, level }) {
  if (!bugc) throw new Error("set BUGC to a built packages/bugc");
  const { compile } = await import(pathToFileURL(path.join(bugc, "dist",
    "src", "index.js")).href);
  const source = fs.readFileSync(file, "utf8");
  const r = await compile({ to: "bytecode", optimizer: { level }, source,
    sourcePath: rel });
  if (!r.success) {
    throw new Error(`bugc -O ${level}: ${JSON.stringify(r.messages)}`);
  }
  const b = r.value.bytecode;
  const hex = (u8) => "0x" + Buffer.from(u8).toString("hex");
  const commit = run("git", ["-C", bugc, "rev-parse", "HEAD"]).trim();
  return {
    file: rel, source, commit, compiler: `bugc ${commit.slice(0, 9)}`,
    create: hex(b.create), runtime: hex(b.runtime),
    programs: { create: b.createProgram, runtime: b.runtimeProgram },
  };
}
