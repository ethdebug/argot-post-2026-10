// Runs bin/run.mjs (the page's checks, from the vanilla page's): builds,
// assembles the site (bin/site.sh, for the slow-link check), starts Vite
// on PORT (default 5181) unless PAGE is set, and runs the checks. Exits
// with their code. Usage: npm run check   (PAGE=<url>: a running page)
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.env.PORT ?? "5181";
execFileSync("npm", ["run", "build"], { cwd: app, stdio: "inherit" });
execFileSync("sh", ["bin/site.sh"], { cwd: app, stdio: "inherit" });

let vite = null;
let page = process.env.PAGE;
if (!page) {
  page = `http://localhost:${port}/demos/inspector/`;
  vite = spawn("npx", ["vite", "--port", port, "--strictPort"],
    { cwd: app, stdio: ["ignore", "pipe", "inherit"] });
  await new Promise((ok, no) => {
    vite.stdout.on("data", (d) => String(d).includes("ready") && ok());
    vite.on("exit", (c) => no(new Error(`vite exited (${c})`)));
  });
}
const code = await new Promise((ok) => spawn("node", ["bin/run.mjs"],
  { cwd: app, stdio: "inherit", env: { ...process.env, PAGE: page } })
  .on("exit", ok));
vite?.kill();
process.exit(code ?? 1);
