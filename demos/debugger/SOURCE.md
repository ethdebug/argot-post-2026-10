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

The Solidity data (`art/walnut10-*`, `shop-debug-rpc.trace.json`,
`shop-code.json`, `replay/transfer.json`) comes from `make-sol.sh`:
solc from pull request walnuthq/solidity#10 (head `c434b2ea`) and this
PR's soldb CLI, on a local anvil node.

## The BUG tab: ethdebug's reference implementation

`vendor/ethdebug-ref.js` bundles, from ethdebug/format at commit
`ac1164cd96f8259fc1a0391f9c31776520ec5e01` (main): `@ethdebug/pointers`
(`dereference`, `Data`), `@ethdebug/evm`'s Machine.State adapter
(`createMachineState`, without its executor) and the trace
reconstruction utilities of `@ethdebug/programs-react` (no React). It
is made by `make-ref-vendor.sh <checkout>` after `yarn install` in that
checkout. `ref-worker.js` uses it.

The BUG data (`bug/scores.bug`, `bug/scores-O0/`, `bug/scores-O2/`)
comes from bugc built from ethdebug/format at the same commit,
`ac1164cd9` (main, with PR #328: local variables at every level), with
`bug/compile.mjs <bugc> scores.bug <0|2> scores-O<0|2>` and, on
`anvil --steps-tracing --port 8549`, `PORT=8549 bug/make-tx.mjs Scores
scores-O<0|2> memory` (anvil 1.2.3). The trace has each step's memory;
`tx.storage-before.json` has the storage before the transaction.
