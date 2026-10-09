// A build from its JSON (scenarios/<scenario>/builds/<id>/build.json,
// written by bin/build-arcade.mjs): one compiler's output for the
// scenario's contract
import type { Hex } from "../types";
import type { Build } from "./types";

// ethdebug/format writes a pointer expression's operator with "~"
// (`~keccak256`, `~wordsize`; #323), and the library takes no other.
// solc still writes "$" (ethdebug/format#324): its pointers and
// templates are rewritten here, where its output is read, and nowhere
// else (vanilla decode.js solcTilde). bugc writes "~".
export function solcTilde<T>(v: T): T {
  const re = (x: unknown): unknown => Array.isArray(x) ? x.map(re)
    : x && typeof x === "object" ? Object.fromEntries(Object.entries(x)
      .map(([k, y]) => [k.startsWith("$") ? `~${k.slice(1)}` : k, re(y)]))
    : typeof x === "string" && /^\$[a-z]/.test(x) ? `~${x.slice(1)}` : x;
  return re(v) as T;
}

const LANGUAGES = ["solidity", "vyper", "bug"];

export function buildOf(json: unknown): Build {
  const j = json as Partial<Build>;
  const need = (what: keyof Build) => {
    if (j[what] === undefined) throw new Error(`build: no ${what}`);
  };
  (["language", "compiler", "create", "sources", "compilation"] as const)
    .forEach(need);
  if (!LANGUAGES.includes(j.language!)) {
    throw new Error(`build: language ${j.language}`);
  }
  if (!/^0x([0-9a-f]{2})*$/i.test(j.create!)) {
    throw new Error("build: create is not hex bytes");
  }
  const sol = j.language === "solidity";
  return {
    language: j.language!, compiler: j.compiler!,
    create: j.create!.toLowerCase() as Hex,
    ...(j.programs ? { programs: sol ? solcTilde(j.programs)
      : j.programs } : {}),
    ...(j.resources ? { resources: sol ? solcTilde(j.resources)
      : j.resources } : {}),
    sources: j.sources!, compilation: j.compilation!,
  };
}
