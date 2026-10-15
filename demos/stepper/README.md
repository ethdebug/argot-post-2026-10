# A ten-line stepper

[`step.ts`](step.ts) prints the source lines a transaction ran. It reads
only an ethdebug program, an anvil `debug_traceTransaction` struct log,
and the source file. The same code works on solc's output and Fe's.
It needs Node 22.18+ (it runs TypeScript as is) and no packages.

## Run

Solidity (`Calls.run(5)`):

    node step.ts inputs/solc/program.json inputs/solc/trace.json inputs/solc/Calls.sol
    12: function run(uint256 x) external {
    13: total = twice(x) + add(x, 1);
    12: function run(uint256 x) external {
    13: total = twice(x) + add(x, 1);
    9: function twice(uint256 x) internal pure returns (uint256) {
    10: return add(x, x);
    ...

Fe (`Counter` `Bump { n: 7 }`):

    node step.ts inputs/fe/program.json inputs/fe/trace.json inputs/fe/counter.fe
    14: let doubled: u256 = x * 2
    15: return doubled + 1
    24: if step > 10 {
    25: store.total = store.total + step
    29: store.last = step
    30: return store.total

## Inputs

- [`inputs/solc/`](inputs/solc/): solc built from PR
  [#16990](https://github.com/argotorg/solidity/pull/16990), via-IR,
  optimizer off, `experimental`, `debugInfo: ["ethdebug", "ast-id"]`.
  The program is `evm.deployedBytecode.ethdebug`.
- [`inputs/fe/`](inputs/fe/): Fe 26.4.1 at `-O1`, `fe dev trace emit`
  then `fe dev debug emit --format ethdebug`. The file holds two
  programs; the script picks the `call` one.
- The traces: [`scripts/deploy.mjs`](scripts/deploy.mjs) deploys on anvil
  (`--steps-tracing --port 8547`), sends one transaction, and saves
  its struct log. [`scripts/compile.cjs`](scripts/compile.cjs) makes
  solc's output.
