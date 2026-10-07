# Source of the soldb builds

`pkg-lean/` and `pkg-replay/` are `wasm-pack --target web` builds of
soldb, the debugger by Walnut, from pull request
[walnuthq/soldb#181](https://github.com/walnuthq/soldb/pull/181), which
adds `state(i)`: the contract's state at a step, read through solc's
ethdebug pointers. Their license is `GPL-3.0-only OR MIT` (see
`pkg-*/package.json`, `LICENSE.md` and `LICENSE-MIT.md`; `LICENSE` here
is the GPL-3.0 text).

Source: <https://github.com/walnuthq/soldb>, commit
[`d3bd8e8f927a214caa84459772977f735994943f`](https://github.com/walnuthq/soldb/tree/d3bd8e8f927a214caa84459772977f735994943f)
(the head of PR #181), crate `crates/soldb-wasm`.

Both are built with soldb's own `make wasm-lean` and `make wasm-replay`
recipes, from the root of the soldb checkout:

```sh
export CARGO_PROFILE_RELEASE_OPT_LEVEL=z CARGO_PROFILE_RELEASE_LTO=fat \
  CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1 CARGO_PROFILE_RELEASE_PANIC=abort
# pkg-lean/ (no REVM):
wasm-pack build crates/soldb-wasm --target web --no-default-features
# pkg-replay/ (default features, `replay` on):
wasm-pack build crates/soldb-wasm --target web --out-dir pkg-replay
```

with one addition, `RUSTFLAGS`, which keeps local build paths out of
the binaries (`<soldb>` is the checkout). Toolchain: rustc 1.99.0,
wasm-pack 0.15.0.

```sh
R=--remap-path-prefix
export RUSTFLAGS="$R=$HOME/.cargo/registry/src=/cargo/registry/src \
$R=$HOME/.rustup=/rustup $R=$HOME/.cargo=/cargo $R=<soldb>=/soldb"
```

## The data: one contract, one transaction

Every tab steps `Scores` and the same transaction. `make-scores.sh`
makes all of it, on a fresh `anvil --steps-tracing --port 8556` (anvil
1.2.3):

- `sol/ethdebug/`: solc 0.8.37 (official build,
  `0.8.37+commit.f401782d`), `--via-ir --experimental --debug-info
  ethdebug` with ethdebug output, optimizer off (solc writes ethdebug
  only without the optimizer). From `sol/Scores.sol`.
- `old/combined.json`: the same solc, `--via-ir --optimize
  --combined-json bin,bin-runtime,srcmap-runtime,ast`: no ethdebug.
- `fe/`: Fe 26.4.1 at `-O 0` (`fe build`, `fe dev trace emit`, `fe dev
  debug emit --format ethdebug`) from `fe/scores.fe`. Fe writes the
  source's absolute path into its file; the script replaces the local
  directory with `/work/`. `fe/src/` holds the standard-library files
  that Fe's file names, from the Fe repository at tag v26.4.1
  (`dbb291dbc`); their blake3 hashes match the ones in Fe's file.
- `bug/scores-O0/`, `bug/scores-O2/`: bugc at `-O 0` and `-O 2`, from
  `bug/scores.bug` (`bug/compile.mjs`).
- The transactions (`make-scores-txs.mjs`, from `scores-txs.json`): each
  build is deployed, then gets the plan's setup calls and its
  transaction, from the same anvil accounts. The script saves the
  node's responses (`fe/`, `bug/scores-O*/`: with each step's memory,
  and the storage before, for the pointers), the old way's traces
  (`old/`: each step's pc, op and depth only), and, for the old way, a
  traced `eth_call` of the plan's view call after the transaction.
- `sol/record.trace.json`: `soldb trace --save-trace` (soldb CLI built
  from the commit above), changed as below.

### The saved trace: one change

`sol/record.trace.json` is the file that `soldb trace --save-trace`
writes, with one change: each step's flat `stack`, `memory` and
`storage` fields are removed, and the JSON is on one line
(`jq -c '.steps[] |= del(.stack, .memory, .storage)'`, in
`make-scores.sh`).

soldb writes each step's state twice: in `snapshot`, and again in the
flat fields, for older readers. When soldb reads a step whose
`snapshot` is not empty, it keeps the `snapshot` and drops the flat
fields (soldb-core, `TraceStep::normalized`, at the commit above). In
this trace, every step's `snapshot` is not empty, and its `stack`,
`memory` and `storage` are equal to the flat fields. Everything else,
including every `snapshot`, is unchanged.

`replay/transfer.json` and `art/walnut10-Token/` (the replay check in
the details) come from `make-sol.sh`: solc from pull request
walnuthq/solidity#10 (head `c434b2ea`) and this PR's soldb CLI.

`sizes.js` (from `make-sizes.sh`) lists each data file's size, for the
loading bars: GitHub Pages sends the files gzipped, with the compressed
size in `Content-Length`. Run `make-sizes.sh` after a data file
changes; `run.mjs` checks that it matches.

## The BUG tab: ethdebug's reference implementation

`vendor/ethdebug-ref.js` bundles, from ethdebug/format at commit
`8714233076eb5de594de4a070b36d9bbd5363e86` (main): `@ethdebug/pointers`
(`dereference`, `Data`), `@ethdebug/evm`'s Machine.State adapter
(`createMachineState`, without its executor) and the trace
reconstruction utilities of `@ethdebug/programs-react` (no React; with
#342, which reads variables across `gather` and `pick`, and #349, which
no longer pops a frame after its `return`). It
is made by `make-ref-vendor.sh <checkout>` after `yarn install` in that
checkout. `ref-worker.js` uses it.

The BUG data comes from bugc built from ethdebug/format main at
`db7d0e4ee` (`make-scores.sh`, above). The details' soldb check uses
`bug/tally.bug` and its saved transaction (`bug/compile.mjs`,
`bug/make-tx.mjs`).
