#!/bin/sh
# Bundle ethdebug's reference implementation for the BUG tab's engine
# (ref-worker.js) from a built checkout of ethdebug/format: run
# `yarn install` there first (it builds the packages).
# Usage: ./make-ref-vendor.sh <checkout>
# vendor/ethdebug-ref.js holds:
# - @ethdebug/pointers: dereference, Data;
# - @ethdebug/evm: createMachineState, the Machine.State adapter (its
#   executor, and so ethereumjs, is not included);
# - @ethdebug/programs-react: the trace reconstruction utilities
#   (call stack, postcondition contexts, variables, transforms), not
#   its React components.
set -e
src="$(cd "$1" && pwd)"
here="$(cd "$(dirname "$0")" && pwd)"
commit="$(git -C "$src" rev-parse HEAD)"
p="$src/packages"
entry="$p/.ref-entry.js"
trap 'rm -f "$entry"' EXIT
cat > "$entry" <<JS
export { dereference, Data } from "./pointers/dist/src/index.js";
export { createMachineState } from "./evm/dist/src/machine.js";
export {
  buildCallStack, buildPcToInstructionMap,
  extractVariablesFromInstruction, extractTransformFromInstruction,
} from "./programs-react/dist/src/utils/mockTrace.js";
export { effectiveContextForStep }
  from "./programs-react/dist/src/utils/effectiveContext.js";
export const commit = "$commit";
JS
mkdir -p "$here/vendor"
(cd "$src" && npx esbuild "$entry" --bundle --format=esm \
  --platform=neutral --main-fields=module,main --legal-comments=none \
  --outfile="$here/vendor/ethdebug-ref.js")
# esbuild marks each module with a comment naming its path: drop them.
sed -i.bak -E '/^\/\/ .*\.(js|ts|json)$/d' "$here/vendor/ethdebug-ref.js"
rm "$here/vendor/ethdebug-ref.js.bak"
if grep -n "$HOME\|/Users/" "$here/vendor/ethdebug-ref.js"; then
  echo "local paths in the bundle" >&2; exit 1
fi
