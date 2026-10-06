#!/bin/bash
# Makes the Solidity data: compiles Shop and Token with solc (Walnut's
# solidity PR #10) into art/walnut10-*, runs Shop.place and
# Token.transfer on a fresh anvil node, and saves what the page loads:
#   shop-debug-rpc.trace.json  soldb's saved trace (debug_traceTransaction)
#   shop-code.json             eth_getCode of Shop, for its immutables
#   replay/transfer.json       soldb's replay file for Token.transfer
# Usage: SOLC=<solc> SOLDB=<soldb CLI> ./make-sol.sh, with
# `anvil --port 8547 --steps-tracing` running (fresh) at $RPC.
set -euo pipefail
cd "$(dirname "$0")"
RPC=${RPC:-http://127.0.0.1:8547}
FROM=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
TO=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
for C in Shop Token; do
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
S=$(deploy Shop)
t1=$(tx $T "transfer(address,uint256)" $TO 25)
t2=$(tx $S "place(string,uint128,uint256)" widget 5 3)
"$SOLDB" trace $t2 -r $RPC --backend debug-rpc -e $S:Shop:art/walnut10-Shop \
  --save-trace shop-debug-rpc.trace.json > /dev/null
"$SOLDB" trace $t1 -r $RPC -e $T:Token:art/walnut10-Token \
  --save-replay replay/transfer.json > /dev/null
jq -n --arg a $S --arg c "$(cast code --rpc-url $RPC $S)" \
  '{address: $a, code: $c}' > shop-code.json
echo "Shop $S place $t2; Token $T transfer $t1"
