// The built site's smoke (bin/run.mjs): builds, assembles the site
// (bin/site.sh) and runs it. Exits with its code.
// Usage: npm run check   (STATIC_PORT: the site server's port)
import { spawn, execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
execFileSync("npm", ["run", "build"], { cwd: app, stdio: "inherit" });
execFileSync("sh", ["bin/site.sh"], { cwd: app, stdio: "inherit" });
const code = await new Promise((ok) => spawn("node", ["bin/run.mjs"],
  { cwd: app, stdio: "inherit" }).on("exit", ok));
process.exit(code ?? 1);
