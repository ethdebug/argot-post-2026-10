// Runs vanilla's bin/run.mjs (patched: bin/make-run.mjs) against the
// port: builds, writes bin/run.gen.mjs, starts Vite on PORT (default
// 5181) unless PAGE is set, and runs the checks. Exits with their code.
// Usage: npm run check   (PAGE=<url> to use a running server)
import { spawn, execFileSync } from "node:child_process";
import { app } from "./vanilla.mjs";
import { writeRun } from "./make-run.mjs";

const port = process.env.PORT ?? "5181";
execFileSync("npm", ["run", "build"], { cwd: app, stdio: "inherit" });
const run = writeRun();

let vite = null;
let page = process.env.PAGE;
if (!page) {
  page = `http://localhost:${port}/demos/inspector-next/`;
  vite = spawn("npx", ["vite", "--port", port, "--strictPort"],
    { cwd: app, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok, no) => {
    vite.stdout.on("data", (d) => String(d).includes("ready") && ok());
    vite.on("exit", (c) => no(new Error(`vite exited (${c})`)));
  });
}
const code = await new Promise((ok) => spawn("node", [run],
  { cwd: app, stdio: "inherit", env: { ...process.env, PAGE: page } })
  .on("exit", ok));
vite?.kill();
process.exit(code ?? 1);
