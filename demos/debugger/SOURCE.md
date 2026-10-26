# Source of the soldb builds

`pkg-lean/` is a `wasm-pack --target web` build of
soldb, the debugger by Walnut, from pull request
[walnuthq/soldb#181](https://github.com/walnuthq/soldb/pull/181), which
adds `state(i)`: the contract's state at a step, read through solc's
ethdebug pointers. Its license is `GPL-3.0-only OR MIT` (see
`pkg-lean/package.json`, `LICENSE.md` and `LICENSE-MIT.md`; `LICENSE` here
is the GPL-3.0 text).

Source: <https://github.com/walnuthq/soldb>, commit
[`d3bd8e8f927a214caa84459772977f735994943f`](https://github.com/walnuthq/soldb/tree/d3bd8e8f927a214caa84459772977f735994943f)
(the head of PR #181), crate `crates/soldb-wasm`.

It is built with soldb's own `make wasm-lean` recipe, from the root of
the soldb checkout:

```sh
export CARGO_PROFILE_RELEASE_OPT_LEVEL=z CARGO_PROFILE_RELEASE_LTO=fat \
  CARGO_PROFILE_RELEASE_CODEGEN_UNITS=1 CARGO_PROFILE_RELEASE_PANIC=abort
# pkg-lean/ (no REVM):
wasm-pack build crates/soldb-wasm --target web --no-default-features
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

Both views of the real-debugger figure step `Arcade` and the same
transaction, alice's third `play()` (a hit at combo 3).
`make-arcade.sh` makes all of it, on a fresh
`anvil --steps-tracing --port 8556` (anvil 1.2.3):

- `sol/ethdebug/`: solc from pull request walnuthq/solidity#10 (head
  `c434b2ea`, `0.8.38-develop.2026.10.5`), `--via-ir --experimental
  --debug-info ethdebug,ast-id` with ethdebug output, optimizer off
  (solc writes ethdebug only without the optimizer). Its pointers give
  soldb the state variables (`state(i)`); stock 0.8.37 writes none.
  From `sol/Arcade.sol`.
- `fe/`: Fe 26.4.1 at `-O 0` (`fe build`, `fe dev trace emit`, `fe dev
  debug emit --format ethdebug`) from `fe/arcade.fe`. Fe writes the
  source's absolute path into its file; the script replaces the local
  directory with `/work/`. `fe/src/` holds the standard-library files
  that Fe's file names, from the Fe repository at tag v26.4.1
  (`dbb291dbc`); their blake3 hashes match the ones in Fe's file.
- The transactions (`make-arcade-txs.mjs`, from `arcade-story.json`):
  each build is deployed (a long motd: "season 2 starts friday, see you
  on the leaderboard", 50 bytes), then gets the story: alice,
  bob and carol join; alice hits twice, bob hits, carol hits four times,
  then misses; then
  the traced call, alice's third `play()`, a hit. The roll depends on
  the block, and anvil cannot set prevrandao, so each `play()` runs
  inside an `evm_snapshot`: if it does not roll the story's outcome
  (a hit changes `totalScore`, a miss does not), the script reverts, mines
  one empty block and sends it again. The script saves the node's
  responses (`fe/`).
- `sol/play.trace.json`: `soldb trace --save-trace` (soldb CLI built
  from the commit above), changed as below.

### The saved trace: one change

`sol/play.trace.json` is the file that `soldb trace --save-trace`
writes, with one change: each step's flat `stack`, `memory` and
`storage` fields are removed, and the JSON is on one line
(`jq -c '.steps[] |= del(.stack, .memory, .storage)'`, in
`make-arcade.sh`).

soldb writes each step's state twice: in `snapshot`, and again in the
flat fields, for older readers. When soldb reads a step whose
`snapshot` is not empty, it keeps the `snapshot` and drops the flat
fields (soldb-core, `TraceStep::normalized`, at the commit above). In
this trace, every step's `snapshot` is not empty, and its `stack`,
`memory` and `storage` are equal to the flat fields. Everything else,
including every `snapshot`, is unchanged.

`sizes.js` (from `make-sizes.sh`) lists each data file's size, for the
loading bars: GitHub Pages sends the files gzipped, with the compressed
size in `Content-Length`. Run `make-sizes.sh` after a data file
changes.
