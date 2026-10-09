import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { buildOf } from "./build";
import { encodeCall } from "./abi";
import { MOTD, mid } from "../../../test/expect";

const app = path.join(__dirname, "..", "..", "..");
const read = (id: string) => JSON.parse(fs.readFileSync(path.join(app,
  "scenarios", "arcade", "builds", id, "build.json"), "utf8"));
const contract = (f: string) => fs.readFileSync(path.join(app, "..",
  "demos", "inspector", f), "utf8");
const builds = Object.fromEntries(["sol", "vy", "bug-O0", "bug-O2"]
  .map((id) => [id, buildOf(read(id))]));
const motdArg = encodeCall("f(string)", [MOTD[0]]).slice(10);

describe("the arcade builds", () => {
  it("sol: the runtime program's context names every state variable", () => {
    const roots = new Set(mid.map(([p]) => p.split(/[.[]/)[0]));
    const names = builds.sol.programs!.runtime.context!;
    const listed = ((names as { variables?: { identifier: string }[] })
      .variables ?? []).map((v) => v.identifier);
    expect(listed).toEqual(expect.arrayContaining([...roots]));
    expect(roots.size).toBe(5);
  });
  it("sol: solc's $ is read as ~", () => {
    const json = JSON.stringify(builds.sol);
    expect(json).not.toMatch(/"\$[a-z]/);
    expect(json).toMatch(/"~keccak256"/);
  });
  it("bug-O0, bug-O2: instructions carry variables", () => {
    for (const id of ["bug-O0", "bug-O2"]) {
      const ins = builds[id].programs!.runtime.instructions;
      const vars = ins.filter((i) =>
        (i.context as { variables?: unknown[] })?.variables?.length);
      expect(vars.length, id).toBeGreaterThan(ins.length / 2);
    }
  });
  it("vy has no programs", () => {
    expect(builds.vy.programs).toBeUndefined();
    expect(builds.vy.language).toBe("vyper");
  });
  it("sol and vy create with the first motd; bug sets it itself", () => {
    expect(builds.sol.create.endsWith(motdArg)).toBe(true);
    expect(builds.vy.create.endsWith(motdArg)).toBe(true);
    expect(builds["bug-O0"].create.endsWith(motdArg)).toBe(false);
  });
  it("keeps the sources as they are", () => {
    expect(builds.sol.sources[0].text).toBe(contract("contracts/Arcade.sol"));
    expect(builds.vy.sources[0].text).toBe(contract("contracts/Arcade.vy"));
    expect(builds["bug-O2"].sources[0]).toEqual({ id: "bug/arcade.bug",
      path: "bug/arcade.bug", text: contract("bug/arcade.bug") });
  });
});

describe("buildOf", () => {
  it("refuses a build with no creation code or language", () => {
    expect(() => buildOf({ ...read("vy"), create: undefined }))
      .toThrow(/create/);
    expect(() => buildOf({ ...read("vy"), language: "fe" }))
      .toThrow(/fe/);
  });
});
