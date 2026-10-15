# A ten-line stepper

[`step.ts`](step.ts) prints the source lines a transaction ran. It reads
an ethdebug program, the transaction's trace, and the source file. The
same code works on solc's output and Fe's.

These steps go from a local dev node to that output. Follow them by
hand, or give this page to your AI coding tool. You need
[Foundry](https://getfoundry.sh) (anvil, cast), Node 22.18 or later, and
solc 0.8.37 or Fe 26.4.1. [`run.sh`](run.sh) does all five steps for the
example in [`inputs/`](inputs/).

## 1. Start a local dev node

The node must serve `debug_traceTransaction` with a trace of each step.

    anvil --steps-tracing

Hardhat: `npx hardhat node` serves the same method on the same port,
with the same accounts, so the steps below work unchanged.

## 2. Compile with ethdebug output

solc writes the ethdebug program for the deployed code (via-IR; the
optimizer is off by default):

    solc --via-ir --experimental --ethdebug-program-runtime --bin -o out Calls.sol

Fe writes the bytecode, then its ethdebug file. That file holds two
programs; the script picks the `call` one.

    fe build counter.fe --out-dir out -e bytecode
    fe dev trace emit counter.fe --out out/counter.trace.jsonl
    fe dev debug emit --format ethdebug --from out/counter.trace.jsonl --out out/counter.ethdebug.json

## 3. Deploy and send one transaction

Deploy from anvil's first account, then call `run(5)`. For Fe, send
`Bump { n: 7 }` as raw calldata: selector `0x00000001`, then `n`.

    key=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
    cast send --private-key $key --create $(cat out/Calls.bin)
    cast send --private-key $key <contractAddress> "run(uint256)" 5

## 4. Fetch the trace

The trace gives the program counter of each step.

    cast rpc debug_traceTransaction <transactionHash> > trace.json

## 5. Step

    npm install
    node step.ts out/Calls_ethdebug-runtime.json trace.json Calls.sol

Output for the example inputs:

    $ node step.ts inputs/solc/program.json inputs/solc/trace.json inputs/solc/Calls.sol
    12: function run(uint256 x) external {
    13: total = twice(x) + add(x, 1);
    12: function run(uint256 x) external {
    13: total = twice(x) + add(x, 1);
    9: function twice(uint256 x) internal pure returns (uint256) {
    ...

    $ node step.ts inputs/fe/program.json inputs/fe/trace.json inputs/fe/counter.fe
    14: let doubled: u256 = x * 2
    15: return doubled + 1
    24: if step > 10 {
    25: store.total = store.total + step
    29: store.last = step
    30: return store.total
