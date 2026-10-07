// The vanilla page's files at a commit: `git show <sha>:demos/inspector/
// <rel>`, with the sha from sync-base unless given.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const syncBase = () =>
  fs.readFileSync(path.join(app, "sync-base"), "utf8").trim();

export function vanillaFile(rel, sha) {
  return execFileSync("git",
    ["show", `${sha ?? syncBase()}:demos/inspector/${rel}`],
    { cwd: app, maxBuffer: 64 << 20 });
}
