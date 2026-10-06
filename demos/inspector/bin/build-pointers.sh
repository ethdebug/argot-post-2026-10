#!/bin/sh
# Bundle @ethdebug/pointers for the browser from a built checkout of
# ethdebug/format (origin/main). Usage: bin/build-pointers.sh <checkout>
set -e
src="$1"
here="$(cd "$(dirname "$0")/.." && pwd)"
commit="$(git -C "$src" rev-parse HEAD)"
dist="$src/packages/pointers/dist/src"
entry="$(mktemp -d)/entry.js"
cat > "$entry" <<JS
export { dereference, Data } from "$dist/index.js";
// The library's own expression evaluator, used by "show how" to display
// each step. Not part of the package's public exports.
export { evaluate } from "$dist/evaluate.js";
export const commit = "$commit";
JS
npx esbuild "$entry" --bundle --format=esm --platform=neutral \
  --main-fields=module,main --outfile="$here/vendor/pointers.js" \
  --legal-comments=none --minify
