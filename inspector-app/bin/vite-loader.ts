// The parity page's loader, as vanilla's (Vite plugin): the loader
// script (src/pages/loader.js) inlined at <!-- loader -->; the
// stylesheets not blocking the first paint (media="print" until they
// load; the page hidden until they are in: styled()); built, the app's
// code is the loader's to fetch (with progress, and Retry) and run: its
// module script and preloads go, its files listed in the loader; the
// decoder bundle as vendor/pointers.js (built: the library's own chunk;
// dev: bundled on the fly, for the loader's bar); and, once built, the
// loaded files' sizes in the page (bin/sizes.mjs).
import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { block } from "./sizes.mjs";

const STYLED = `<script>
  // Shows the page once its stylesheets are in (or failed)
  window.styled = (link) => {
    link.media = "all";
    if (document.querySelectorAll("link[data-css][media=print]").length)
      return;
    document.documentElement.classList.add("styled");
  };
</script>`;

// the library's modules (and theirs): one chunk, vendor/pointers.js; the
// EVM's (@ethdebug/evm, ethereumjs and its curves), never the page's: a
// chunk of their own, the runs' (isEvm)
export const isEvm = (id: string) =>
  /node_modules\/(@ethdebug\/evm|@ethereumjs|@noble\/curves)\//.test(id) ||
  (/node_modules\/ethereum-cryptography\//.test(id) &&
    !/ethereum-cryptography\/(esm\/)?(keccak|utils)\.js/.test(id));
export const isLibrary = (id: string) => !isEvm(id) &&
  /node_modules\/(@ethdebug|ethereum-cryptography|@noble|yaml|json-schema-typed)\//
    .test(id);

export function loaderPage(): Plugin {
  let root = "";
  let bundled: Promise<string> | null = null;
  return {
    name: "loader-page",
    configResolved(c) {
      root = c.root;
    },
    transformIndexHtml: {
      order: "post",
      handler(html) {
        if (!html.includes("<!-- loader -->")) return html;
        const code = fs.readFileSync(path.join(root, "src", "pages",
          "loader.js"), "utf8");
        return html
          .replace("<!-- loader -->", () => `<script>\n${code}</script>`)
          .replace(/<head>/, `<head>\n${STYLED}`)
          .replace(/<link rel="stylesheet"([^>]*)>/g, (_, a) =>
            `<link rel="stylesheet"${a} media="print" data-css ` +
            `onload="styled(this)" onerror="styled(this)">`);
      },
    },
    configureServer(server) {
      const url = `${server.config.base}vendor/pointers.js`;
      server.middlewares.use(async (req, res, next) => {
        if (req.url !== url) return next();
        bundled ??= import("esbuild").then(async (e) => (await e.build({
          entryPoints: ["@ethdebug/pointers"], bundle: true,
          format: "esm", write: false, absWorkingDir: root,
          minify: true })).outputFiles[0].text);
        res.setHeader("content-type", "text/javascript");
        res.end(await bundled);
      });
    },
    // (built: the entry's module script and preloads out of the page,
    // its files, the entry last, into the loader)
    generateBundle: { order: "post", handler(_, bundle) {
      const page = bundle["index.html"];
      const entry = Object.values(bundle).find((c) => c.type === "chunk" &&
        c.isEntry && c.name === "index");
      if (!page || page.type !== "asset" || !entry ||
        entry.type !== "chunk") return;
      const code = [...entry.imports, entry.fileName];
      page.source = String(page.source)
        .replace(/\s*<script type="module"[^>]*><\/script>/, "")
        .replace(/\s*<link rel="modulepreload"[^>]*>/g, "")
        .replace("/* code */[]/* end code */", () =>
          `/* code */${JSON.stringify(code)}/* end code */`);
    } },
    writeBundle(o) {
      const html = path.join(o.dir!, "index.html");
      if (!fs.existsSync(html)) return;
      fs.writeFileSync(html, fs.readFileSync(html, "utf8").replace(
        /\/\* sizes \*\/[\s\S]*?\/\* end sizes \*\//, () => block()));
    },
  };
}
