import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/demos/inspector-next/",
  publicDir: "static",
  plugins: [react()],
  server: { port: 5180, strictPort: true, fs: { allow: [".."] } },
  build: {
    rollupOptions: { input: { index: "index.html", shell: "shell.html" } },
  },
});
