#!/bin/sh
# Assembles the site GitHub Pages serves, in _site/ (or $1): the repo's
# tracked files (no node_modules, no inspector-app/ sources), and the
# built storage inspector (inspector-app/dist, `npm run build` first)
# at demos/inspector/, over the files kept there (its fixtures tooling,
# screenshots, README).
set -e
here="$(cd "$(dirname "$0")/.." && pwd)"
root="$(git -C "$here" rev-parse --show-toplevel)"
out="${1:-$root/_site}"
[ -f "$here/dist/index.html" ] || { echo "no dist: npm run build" >&2; exit 1; }
rm -rf "$out"
mkdir -p "$out"
git -C "$root" ls-files -z | grep -zv '^inspector-app/' |
  (cd "$root" && xargs -0 tar cf -) | tar xf - -C "$out"
mkdir -p "$out/demos/inspector"
cp -R "$here/dist/." "$out/demos/inspector/"
echo "site: $out"
