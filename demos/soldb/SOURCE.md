# Source of the soldb builds

`pkg-lean/` and `pkg-replay/` are `wasm-pack --target web` builds of
soldb, the debugger by Walnut, made with soldb's own `make wasm-lean`
and `make wasm-replay` recipes, unchanged except for
`--remap-path-prefix` flags that keep local build paths out of the
binaries. Their license is
`GPL-3.0-only OR MIT` (see `pkg-*/package.json`, `LICENSE.md` and
`LICENSE-MIT.md`; `LICENSE` here is the GPL-3.0 text).

Source: <https://github.com/walnuthq/soldb>, commit
[`45873a3b9e0e72bfaf7da97d2a3dc1fa7fdd7db5`](https://github.com/walnuthq/soldb/tree/45873a3b9e0e72bfaf7da97d2a3dc1fa7fdd7db5),
crate `crates/soldb-wasm`:

- `pkg-replay/`: built with the default features (`replay` on);
- `pkg-lean/`: built with `--no-default-features`.
