// Writes the walkthrough goldens (test/golden/*.json) from the engine as
// it is now; review the diff before committing. Usage: node bin/goldens.mjs
import { execFileSync } from "node:child_process";
import { app } from "./vanilla.mjs";

execFileSync("npx", ["vitest", "run", "src/engine/walkthrough/golden"],
  { cwd: app, stdio: "inherit", env: { ...process.env,
    UPDATE_GOLDENS: "1" } });
