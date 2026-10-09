// The page's sources against the demo's data: what needs no browser
// (from bin/run.mjs's file checks)
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { expected } from "./expect";

const app = path.join(__dirname, "..");
const demo = path.join(app, "..", "demos", "inspector");
const read = (...p: string[]) => fs.readFileSync(path.join(...p), "utf8");
const html = read(app, "index.html");
const all = JSON.parse(read(demo, "fixtures", "index.json")) as
  { id: string; fixture: string; title: string; points: string[];
    lens?: string }[];
// (the storage inspector's scenes; a scene of another lens, "Raw bytes",
// has a button of its own, by its lens)
const scenes = all.filter((s) => !s.lens);

describe("index.html", () => {
  it("its picker has each scene of fixtures/index.json, in order", () => {
    const picker = html.match(/<div id="picker"[^>]*>([\s\S]*?)<\/div>/)![1];
    const got = [...picker.matchAll(/<button([^>]*)>([^<]+)</g)]
      .map(([, a, t]) => ({ id: a.match(/data-id="([^"]+)"/)?.[1],
        snapshot: a.match(/data-snapshot="([^"]+)"/)?.[1],
        single: /data-single/.test(a), title: t.replace(/\s+/g, " ") }));
    expect(got.map((b) => b.id)).toEqual(all.map((s) => s.id));
    expect(got.filter((b) => b.snapshot)).toEqual(scenes.map((s) => ({
      id: s.id, snapshot: s.id, single: s.points.length === 1,
      title: s.title })));
    expect(got.filter((b) => !b.snapshot).map((b) => b.title)).toEqual(
      all.filter((s) => s.lens).map((s) => s.title));
    expect(picker).toMatch(/data-id="raw" data-lens="raw"/);
  });

  it("has one intro per scene, in order", () => {
    expect([...html.matchAll(/<p data-scene="([^"]+)" hidden>/g)]
      .map((m) => m[1])).toEqual(scenes.map((s) => s.id));
  });

  it("shows contracts/Arcade.sol as the contract", () => {
    const pre = html.match(
      /<pre id="contract-src" class="src">([\s\S]*?)<\/pre>/)?.[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    expect(pre).toBe(read(demo, "contracts", "Arcade.sol"));
  });
});

it("test/expect.ts has the values of every scene", () => {
  expect(Object.keys(expected)).toEqual(scenes.map((s) => s.id));
});

// The base slots come from the program context, never a compiler's
// storageLayout (by name, or as a contract's `layout`)
it("no fixture has a storage layout", () => {
  const dir = path.join(demo, "fixtures");
  const has = fs.readdirSync(dir).filter((f) => {
    const text = read(dir, f);
    return text.includes("storageLayout") ||
      JSON.parse(text).contract?.layout !== undefined;
  });
  expect(has).toEqual([]);
});

// (no native tooltips: the page's popovers say it)
it("no title attribute in the page's markup or code", () => {
  const files = ["index.html", ...fs.readdirSync(path.join(app, "src"),
    { recursive: true, encoding: "utf8" }).filter((f) => /\.tsx?$/.test(f))
    .map((f) => path.join("src", f))];
  expect(files.filter((f) => /\stitle="/.test(read(app, f)))).toEqual([]);
});

it("no local paths in what is published", () => {
  const home = "/" + "Users/";
  const walk = (d: string): string[] => fs.readdirSync(d,
    { withFileTypes: true }).flatMap((e) => e.name.startsWith(".") ||
    ["node_modules", "screenshots", "test-results",
      "playwright-report"].includes(e.name) ? [] : e.isDirectory()
    ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  expect(walk(app).filter((f) => read(f).includes(home))
    .map((f) => path.relative(app, f))).toEqual([]);
});
