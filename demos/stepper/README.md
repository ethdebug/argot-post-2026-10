# One stepper, two compilers

`step.mjs` prints the source lines a transaction executed, using only an
ethdebug program and an anvil `debug_traceTransaction` struct log.
Node standard library only.

    node step.mjs <program.json> <trace.json> <source-file>

## Inputs (real, produced here)
- solc: PR #16990 build (viaIR, optimizer off, experimental, debugInfo
  ethdebug). `node compile.cjs Calls.sol Calls`; program =
  `evm.deployedBytecode.ethdebug` -> `solc-program.json`.
- Fe 26.4.1: `fe build`, `fe dev trace emit`, `fe dev debug emit --format
  ethdebug` -> `counter.ethdebug.json`.
- `deploy.mjs` deploys on anvil (port 8547, `--steps-tracing`), sends one
  tx, saves `solc-trace.json` / `fe-trace.json`.

## Run
    node step.mjs solc-program.json solc-trace.json Calls.sol
    node step.mjs counter.ethdebug.json fe-trace.json counter.fe

## Output (excerpt)
    solc (Calls.run(5))                    Fe (Counter.Bump{n:7})
    12: function run(uint256 x) external { 14: let doubled: u256 = x * 2
    13: total = twice(x) + add(x, 1);      15: return doubled + 1
    9: function twice(uint256 x) ...       24: if step > 10 {
    10: return add(x, x);                  25: store.total = store.total + step
    5: function add(...)                   29: store.last = step
    7: return a + b;                       30: return store.total
Full: `out-solc.txt`, `out-fe.txt`. Both follow the source in order
(solc enters twice -> add -> add and returns; Fe takes the `if` branch).

## Notes
- Core: 10 lines (lines 13-22). Input normalization: 2 code lines
  (9-10) plus 2 comment lines.
- Fe-specific: (1) pick the `call` program from Fe's wrapper; (2) the
  `source.id === 0` check. Fe maps steps in its std library (ids 1+,
  e.g. calldata decoding) and the script has only one source file. solc
  never leaves id 0, so the check is harmless there. Without it, Fe
  output has a wrong line (`38:`) from a std file.
- The core does not branch on compiler. The normalization does, in a
  way: it checks for Fe's `programs` key.
- Fe's extra instruction fields and missing `contract.definition` only
  matter for schema validation; stepping needs no adapter.
- Fe at O1 inlines `scale`, so no call-site line 23 appears; solc shows
  the calls. Fe's step ranges are sub-expressions, deduped to lines.
- The "compiler glue" filter (range > 80% of the file) matters for solc
  (whole-contract range, ~85% of steps). Fe does not need it here.
- One multi-source limit: this stepper handles only the user's file
  (id 0). Real use needs a source id -> file map.
