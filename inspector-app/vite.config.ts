import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { isLibrary, loaderPage } from "./bin/vite-loader";

// (the dev server's own port: 5180, or `--port`; the live-reload client
// connects to it straight, not through a proxy in front of the page)
const at = process.argv.indexOf("--port");
const port = (at >= 0 && Number(process.argv[at + 1])) || 5180;

// (a re-pin of the vendored library, vendor/PIN and the lockfile, takes
// effect in a running dev server too: it restarts and pre-bundles its
// dependencies again, so no old copy of the library stays in its cache.
// A server started later sees the new lockfile and pre-bundles anyway.
// REPIN_FILES: other files to watch instead, for its test, which must
// not restart every other server on this checkout.)
const repin = {
  name: "repin",
  configureServer(server: import("vite").ViteDevServer) {
    const files = (process.env.REPIN_FILES?.split(",") ??
      ["vendor/PIN", "package-lock.json"]).map((f) =>
      path.resolve(server.config.root, f));
    server.watcher.add(files);
    server.watcher.on("change", (f) => {
      if (files.includes(path.resolve(f))) void server.restart(true);
    });
  },
};

export default defineConfig({
  base: "/demos/inspector-next/",
  publicDir: "static",
  plugins: [react(), repin, loaderPage()],
  server: { port: 5180, strictPort: true, fs: { allow: [".."] },
    hmr: { clientPort: port } },
  build: {
    rollupOptions: { input: { index: "index.html", shell: "shell.html" },
      // (the decoder bundle: one chunk the loader fetches with progress)
      output: {
        manualChunks: (id) => isLibrary(id) ? "pointers" : undefined,
        chunkFileNames: (c) => c.name === "pointers" ? "vendor/pointers.js"
          : "assets/[name]-[hash].js" } },
  },
});
