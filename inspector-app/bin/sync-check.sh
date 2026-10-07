#!/bin/sh
# The vanilla commits since the pin (on main, demos/inspector only), and
# the ledger's state of each. Exits 1 if a commit is missing from
# sync-ledger.tsv, or if a "deferred: T…" entry's tasks are all in
# tasks-done (the task closed without porting it). A deferred entry is
# open (listed, not a failure) until its tasks close it: the task
# writes its port commit in the ledger's third column.
# (LEDGER, DONE: other files; UPTO: another end than main; for the tests)
here="$(cd "$(dirname "$0")/.." && pwd)"
ledger="${LEDGER:-$here/sync-ledger.tsv}"
done="${DONE:-$here/tasks-done}"

base="$(git -C "$here" rev-parse pre-port-2026-10)"
log="$(git -C "$here" log --oneline "$base..${UPTO:-main}" -- \
  :/demos/inspector)"
status=0
for sha in $(echo "$log" | cut -d' ' -f1); do
  line="$(grep "^$sha" "$ledger" | head -1)"
  if [ -z "$line" ]; then
    echo "not in the ledger: $sha"
    status=1
    continue
  fi
  port="$(printf '%s' "$line" | cut -f3)"
  case "$port" in
    deferred:*)
      tasks="$(printf '%s' "${port#deferred:}" | tr ',+' '  ')"
      open=0
      for t in $tasks; do
        grep -qx "$t" "$done" || open=1
      done
      if [ $open = 1 ]; then
        echo "open: $sha ($port)"
      else
        echo "$sha: $port: tasks done but not ported"
        status=1
      fi
      ;;
  esac
done
exit $status
