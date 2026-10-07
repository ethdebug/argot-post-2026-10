#!/bin/bash
# Makes the replay check's data (the details): compiles Token with solc
# (Walnut's solidity PR #10) into art/walnut10-Token, runs
# Token.transfer on a fresh anvil node, and saves soldb's replay file,
# replay/transfer.json. The tabs' data: make-scores.sh.
# Usage: SOLC=<solc> SOLDB=<soldb CLI> ./make-sol.sh, with
# `anvil --port 8547 --steps-tracing` running (fresh) at $RPC.
set -euo pipefail
cd "$(dirname "$0")"
RPC=${RPC:-http://127.0.0.1:8547}
FROM=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
TO=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
for C in Token; do
  D=art/walnut10-$C
  # From inside the directory, so the source path is plain `$C.sol`.
  (cd $D && "$SOLC" --via-ir --experimental --debug-info ethdebug,ast-id \
    --ethdebug-resources --ethdebug-program --ethdebug-program-runtime \
    --abi --bin --bin-runtime --overwrite -o . $C.sol)
done
deploy() { # name [ctor-sig args...]
  local bin; bin=0x$(cat art/walnut10-$1/$1.bin); shift
  if [ $# -gt 0 ]; then bin=$bin$(cast abi-encode "$@" | cut -c3-); fi
  cast send --rpc-url $RPC --unlocked --from $FROM --json --create "$bin" \
    | jq -r .contractAddress
}
tx() { cast send --rpc-url $RPC --unlocked --from $FROM --json "$@" \
  | jq -r 'select(.status=="0x1") | .transactionHash'; }
T=$(deploy Token "c(uint256)" 1000)
t1=$(tx $T "transfer(address,uint256)" $TO 25)
"$SOLDB" trace $t1 -r $RPC -e $T:Token:art/walnut10-Token \
  --save-replay replay/transfer.json > /dev/null
echo "Token $T transfer $t1"
