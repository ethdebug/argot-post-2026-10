import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// (the dev server's own port: 5180, or `--port`; the live-reload client
// connects to it straight, not through a proxy in front of the page)
const at = process.argv.indexOf("--port");
const port = (at >= 0 && Number(process.argv[at + 1])) || 5180;

export default defineConfig({
  base: "/demos/inspector-next/",
  publicDir: "static",
  plugins: [react()],
  server: { port: 5180, strictPort: true, fs: { allow: [".."] },
    hmr: { clientPort: port } },
  build: {
    rollupOptions: { input: { index: "index.html", shell: "shell.html" } },
  },
});
