// Fetches for the engines' workers, with progress: each file reports
// the bytes received of its total as they arrive. The total is the
// Content-Length when the server sends the file as is. A server that
// compresses the file (GitHub Pages gzips every file) gives the
// compressed length there, so the total comes from sizes.js instead
// (make-sizes.sh). Without either, the total is null.

import SIZES from "./sizes.js";

const BASE = new URL("./", import.meta.url).href;

/**
 * Progress of one file, as the worker reports it.
 * @typedef {Object} FileProgress
 * @property {string} path    the file, relative to this directory
 * @property {string} label   what the file is, in plain words
 * @property {number} loaded  bytes received
 * @property {number|null} total  bytes in all, or null if unknown
 * @property {boolean} done
 */

/**
 * @param {(p: FileProgress) => void} report  called when a file starts,
 *   at most every 100 ms while it arrives, and when it is complete
 * @returns {(url: string, label: string) => Promise<Uint8Array>}
 */
export function fetcher(report) {
  return async (url, label) => {
    const href = new URL(url, BASE).href;
    const path = href.startsWith(BASE) ? href.slice(BASE.length) : href;
    const p = { path, label, loaded: 0, total: SIZES[path] ?? null,
      done: false };
    report({ ...p });
    let r;
    try {
      r = await fetch(href);
    } catch (e) {
      throw new Error(`Could not load ${label}: the network request ` +
        `failed (${e.message})`);
    }
    if (!r.ok) {
      throw new Error(`Could not load ${label}: the server answered ` +
        `${r.status}${r.statusText ? ` ${r.statusText}` : ""}`);
    }
    const encoding = r.headers.get("content-encoding");
    const length = Number(r.headers.get("content-length"));
    if ((!encoding || encoding === "identity") && length > 0) {
      p.total = length;
    }
    const chunks = [];
    let last = 0;
    try {
      const reader = r.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        p.loaded += value.length;
        const t = performance.now();
        if (t - last > 100) {
          last = t;
          report({ ...p });
        }
      }
    } catch (e) {
      throw new Error(`Could not load ${label}: the connection broke ` +
        `after ${p.loaded} bytes (${e.message})`);
    }
    const bytes = new Uint8Array(p.loaded);
    let at = 0;
    for (const c of chunks) {
      bytes.set(c, at);
      at += c.length;
    }
    p.total = p.loaded;
    p.done = true;
    report({ ...p });
    return bytes;
  };
}

/**
 * A worker's message handler for `ops`: { id, op, args } in; { id,
 * value }, { id, error, stack } or, while it works, { id, progress }
 * out. Each op gets a `report` function first, then its arguments, and
 * returns [value, transferable buffers].
 */
export function serve(ops) {
  self.onmessage = async ({ data: { id, op, args } }) => {
    const report = (progress) => self.postMessage({ id, progress });
    try {
      const [value, buffers = []] = await ops[op](report, ...args);
      self.postMessage({ id, value }, buffers);
    } catch (e) {
      self.postMessage({ id, error: e?.message ?? String(e),
        stack: String(e?.stack ?? e) });
    }
  };
}

const decoder = new TextDecoder();
export const textOf = (bytes) => decoder.decode(bytes);
