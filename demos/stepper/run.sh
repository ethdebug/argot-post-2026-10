#!/bin/sh
# The README's steps 1-5, for solc and Fe: remakes inputs/. Needs anvil,
# cast, jq, solc 0.8.37 and fe 26.4.1 on PATH, and `npm install` here.
set -e
cd "$(dirname "$0")"

# 1. A local dev node
anvil --steps-tracing --silent & trap 'kill $!' EXIT
sleep 2
key=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# 2. Compile
solc --via-ir --experimental --ethdebug-program-runtime --bin \
  --overwrite -o out inputs/solc/Calls.sol
cp out/Calls_ethdebug-runtime.json inputs/solc/program.json
fe build inputs/fe/counter.fe --out-dir out -e bytecode
fe dev trace emit inputs/fe/counter.fe --out out/counter.trace.jsonl
fe dev debug emit --format ethdebug --from out/counter.trace.jsonl \
  --out inputs/fe/program.json

# 3 and 4. Deploy, send one transaction, fetch its trace
transact() { # <dir> <creation bytecode file> <call arguments...>
  dir=$1 bin=$2 && shift 2
  address=$(cast send --json --private-key $key --create "$(cat "$bin")" |
    jq -r .contractAddress)
  tx=$(cast send --json --private-key $key "$address" "$@" |
    jq -r .transactionHash)
  cast rpc debug_traceTransaction "$tx" > "$dir/trace.json"
}
transact inputs/solc out/Calls.bin "run(uint256)" 5
transact inputs/fe out/Counter.bin \
  0x000000010000000000000000000000000000000000000000000000000000000000000007

# 5. Step
node step.ts inputs/solc/program.json inputs/solc/trace.json \
  inputs/solc/Calls.sol
node step.ts inputs/fe/program.json inputs/fe/trace.json inputs/fe/counter.fe
