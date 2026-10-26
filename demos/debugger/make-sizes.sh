#!/bin/sh
# Writes sizes.js: the size in bytes of each data file the engines
# fetch. GitHub Pages serves every file gzipped, and then the
# Content-Length header gives the compressed size, so the loading bars
# take each file's total from here. Run it after any data file changes.
# Usage: ./make-sizes.sh
set -e
cd "$(dirname "$0")"
{
  echo "// Made by make-sizes.sh: each data file's size in bytes."
  echo "export default {"
  find fe sol pkg-lean -type f \
    \( -name "*.json" -o -name "*.wasm" -o -name "*.bin" -o -name "*.js" \
    -o -name "*.sol" -o -name "*.fe" -o -name "*.bug" \) \
    ! -name package.json | LC_ALL=C sort | while read -r f; do
    printf '  "%s": %s,\n' "$f" "$(wc -c < "$f" | tr -d ' ')"
  done
  echo "};"
} > sizes.js
