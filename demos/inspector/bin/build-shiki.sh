#!/bin/sh
# Bundle the syntax colouring for the contract's source: Shiki's core
# with its JavaScript regex engine, the Solidity and YAML grammars and the two
# themes (as the debugger demo uses them), minified. Needs `npm install`.
# Usage: bin/build-shiki.sh, then node bin/sizes.mjs
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
entry="$here/.shiki-entry.js"
cat > "$entry" <<JS
export { createHighlighterCore } from "shiki/core";
export { createJavaScriptRegexEngine } from "shiki/engine/javascript";
export { default as solidity } from "@shikijs/langs/solidity";
export { default as yaml } from "@shikijs/langs/yaml";
export { default as light } from "@shikijs/themes/github-light";
export { default as dark } from "@shikijs/themes/github-dark";
JS
cd "$here"
npx esbuild "$entry" --bundle --format=esm --platform=neutral \
  --main-fields=module,main --outfile="$here/vendor/shiki.js" \
  --legal-comments=none --minify --log-level=warning
rm "$entry"
