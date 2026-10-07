#!/bin/bash
# Makes the data of every tab: one contract, Scores, in Solidity, Fe and
# BUG, and one transaction, record(30) after record(7), on each build.
#   sol/ethdebug/  Walnut's solc fork (walnuthq/solidity PR #10), ethdebug
#                  output with pointers for the state variables (via-IR,
#                  optimizer off: solc emits ethdebug only without it)
#   sol/record.trace.json  soldb's saved trace of record(30), without the
#                  flat copies of each step's state (SOURCE.md)
#   old/combined.json  stock solc 0.8.37, --via-ir --optimize: bytecode,
#                  source map and AST, no ethdebug
#   fe/            Fe 26.4.1 at -O 0: bytecode and ethdebug
#   bug/scores-O0, bug/scores-O2  bugc at -O 0 and -O 2
# and the transactions (make-scores-txs.mjs).
# Usage: SOLC_WALNUT=<solc, walnuthq/solidity PR #10>
# SOLC=<solc 0.8.37> FE=<fe 26.4.1> BUGC=<ethdebug/format
# checkout>/packages/bugc SOLDB=<soldb CLI> ./make-scores.sh, with a
# fresh `anvil --port 8556 --steps-tracing` running.
set -euo pipefail
cd "$(dirname "$0")"
PORT=${PORT:-8556}
RPC=http://127.0.0.1:$PORT
# From inside sol/, so the source path is plain `Scores.sol`.
(cd sol && "$SOLC_WALNUT" --via-ir --experimental --debug-info ethdebug,ast-id \
  --ethdebug-resources --ethdebug-program --ethdebug-program-runtime \
  --abi --bin --bin-runtime --overwrite -o ethdebug Scores.sol)
(cd sol && "$SOLC" --via-ir --optimize \
  --combined-json bin,bin-runtime,srcmap-runtime,ast --overwrite \
  -o ../old Scores.sol)
# Fe writes the source's absolute path into its file; it is replaced
# with /work/ (SOURCE.md).
(cd fe && "$FE" build scores.fe --standalone -O 0 --out-dir out \
    -e bytecode,runtime-bytecode,abi > /dev/null \
  && "$FE" dev trace emit scores.fe --standalone -O 0 \
    --out scores.trace.jsonl > /dev/null \
  && "$FE" dev debug emit --format ethdebug --from scores.trace.jsonl \
    --out scores.ethdebug.json > /dev/null \
  && rm scores.trace.jsonl \
  && sed -i.bak "s#$(pwd -P)/#/work/#g" scores.ethdebug.json \
  && rm scores.ethdebug.json.bak)
(cd bug && for L in 0 2; do
  node compile.mjs "$BUGC" scores.bug $L scores-O$L > /dev/null; done)
PORT=$PORT node make-scores-txs.mjs > txs.json
A=$(jq -r .sol.address txs.json)
T=$(jq -r .sol.tx txs.json)
"$SOLDB" trace "$T" -r $RPC --backend debug-rpc -e "$A:Scores:sol/ethdebug" \
  --save-trace sol/record.trace.json > /dev/null
# Each step holds its state twice: in `snapshot`, and in the flat
# `stack`, `memory` and `storage` fields. soldb's parser keeps the
# snapshot and drops the flat copies (soldb-core, TraceStep::normalized),
# so the page's copy leaves them out, on one line (SOURCE.md).
jq -c '.steps[] |= del(.stack, .memory, .storage)' \
  sol/record.trace.json > sol/record.trace.json.tmp
mv sol/record.trace.json.tmp sol/record.trace.json
cat txs.json
rm txs.json
