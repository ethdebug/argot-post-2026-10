// A static server that sends files as GitHub Pages does: every file
// gzipped (Content-Encoding: gzip, Content-Length the compressed size),
// with Cache-Control: max-age=600. run.mjs uses it to measure loading
// over a slow link with the bytes Pages would send.
// Usage: const { url, close } = await pagesServer(root)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".wasm": "application/wasm",
  ".png": "image/png", ".svg": "image/svg+xml",
};

export function pagesServer(root) {
  const cache = new Map();
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    let file = path.join(root, p);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (fs.statSync(file).isDirectory()) {
        if (!p.endsWith("/")) {
          res.writeHead(301, { location: p + "/" }).end();
          return;
        }
        file = path.join(file, "index.html");
      }
      let body = cache.get(file);
      if (!body) {
        body = zlib.gzipSync(fs.readFileSync(file));
        cache.set(file, body);
      }
      res.writeHead(200, {
        "content-type": TYPES[path.extname(file)]
          ?? "application/octet-stream",
        "content-encoding": "gzip", "content-length": body.length,
        "cache-control": "max-age=600", vary: "Accept-Encoding",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" }).end("not found");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () =>
    resolve({ url: `http://127.0.0.1:${server.address().port}/`,
      close: () => new Promise((r) => {
        server.closeAllConnections();
        server.close(r);
      }) })));
}
