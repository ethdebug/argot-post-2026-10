#!/bin/sh
# The vanilla commits since sync-base (on main, demos/inspector only);
# exits 1 if any is missing from sync-ledger.tsv.
here="$(cd "$(dirname "$0")/.." && pwd)"
base="$(cat "$here/sync-base")"
log="$(git -C "$here" log --oneline "$base..main" -- :/demos/inspector)"
[ -n "$log" ] && echo "$log"
missing=0
for sha in $(echo "$log" | cut -d' ' -f1); do
  if ! cut -f1 "$here/sync-ledger.tsv" | grep -q "^$sha"; then
    echo "not in the ledger: $sha"
    missing=1
  fi
done
exit $missing
