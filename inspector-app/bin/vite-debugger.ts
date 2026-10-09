// The old debugger demo's files (demos/debugger: soldb's engine, worker,
// WebAssembly and data), served by the dev server at /demos/debugger/,
// where the site has them: the real-debugger figure loads soldb from
// there (src/figures/soldb.ts), never from the app's bundle.
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const TYPES: Record<string, string> = { ".js": "text/javascript",
  ".json": "application/json", ".wasm": "application/wasm",
  ".sol": "text/plain", ".fe": "text/plain" };

export function debuggerDemo(): Plugin {
  return {
    name: "debugger-demo",
    configureServer(server) {
      const dir = path.resolve(server.config.root, "..", "demos",
        "debugger");
      server.middlewares.use((req, res, next) => {
        const u = decodeURIComponent((req.url ?? "").split("?")[0]);
        if (!u.startsWith("/demos/debugger/")) return next();
        const f = path.join(dir, u.slice("/demos/debugger/".length));
        if (!f.startsWith(dir + path.sep) || !fs.existsSync(f) ||
          !fs.statSync(f).isFile()) return next();
        res.setHeader("content-type", TYPES[path.extname(f)] ??
          "application/octet-stream");
        fs.createReadStream(f).pipe(res);
      });
    },
  };
}
