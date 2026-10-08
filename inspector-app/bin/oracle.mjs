// The oracle for the walkthroughs: vanilla's page at sync-base, served
// from its committed files, walked step by step (test/oracle/
// capture.mjs); written to test/oracle/vanilla.json, which the port's
// e2e (test/e2e/oracle.spec.ts) compares with.
// Usage: node bin/oracle.mjs
import { execSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { app, syncBase } from "./vanilla.mjs";
import { captureAll } from "../test/oracle/capture.mjs";

const PORT = 8771;
const sha = syncBase();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "oracle-"));
execSync(`git archive ${sha} | tar -x -C ${dir}`,
  { cwd: path.dirname(app) });
const types = { ".html": "text/html", ".js": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml",
  ".woff2": "font/woff2", ".wasm": "application/wasm" };
const server = http.createServer((req, res) => {
  let f = path.join(dir, decodeURIComponent(new URL(req.url, "http://x")
    .pathname));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) {
    f = path.join(f, "index.html");
  }
  if (!fs.existsSync(f)) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": types[path.extname(f)] ??
    "application/octet-stream" });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(PORT, r));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`http://localhost:${PORT}/demos/inspector/`);
  const out = await captureAll(page);
  if (errors.length) throw new Error(errors.join("\n"));
  fs.writeFileSync(path.join(app, "test", "oracle", "vanilla.json"),
    JSON.stringify({ sha, walks: out }, null, 1) + "\n");
  console.log(`vanilla ${sha.slice(0, 7)}: ${Object.keys(out).length} ` +
    "walkthroughs");
} finally {
  await browser.close();
  server.close();
  fs.rmSync(dir, { recursive: true });
}
