// The app's sources against the demo's data: what needs no browser
import { expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const app = path.join(__dirname, "..");
const read = (...p: string[]) => fs.readFileSync(path.join(...p), "utf8");

// The base slots come from the program context, never a compiler's
// storageLayout (by name, or as a contract's `layout`)
it("no build has a storage layout", () => {
  const dir = path.join(app, "scenarios", "arcade", "builds");
  const has = fs.readdirSync(dir).filter((b) =>
    read(dir, b, "build.json").includes("storageLayout"));
  expect(has).toEqual([]);
});

// (no native tooltips: the page's popovers say it)
it("no title attribute in the embeds' markup or code", () => {
  const files = ["embed.html", "embed-panel.html", ...fs.readdirSync(path.join(app, "src"),
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
