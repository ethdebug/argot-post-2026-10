# ethdebug post: figures and demos

The interactive figures for the ethdebug post on the
[Argot blog](https://www.argot.org/blog), and the demos behind them.
The post introduces [ethdebug/format](https://github.com/ethdebug/format).

Site: <https://ethdebug.github.io/argot-post-2026-10/>

- [inspector-app/](inspector-app/): the post's figures. The site
  serves them at `demos/inspector/embed.html`.
- [demos/debugger/](demos/debugger/): step through a transaction in
  the browser with soldb, Walnut's debugger, for Solidity and Fe. The
  real-debugger figure loads its engine and data from here. Its saved
  Solidity trace leaves out the flat copies of each step's state, which
  soldb drops on reading; see
  [SOURCE.md](demos/debugger/SOURCE.md#the-saved-trace-one-change).
- [demos/inspector/](demos/inspector/): a storage inspector that shows
  each variable's bytes, found through solc's ethdebug pointers.
- [demos/stepper/](demos/stepper/): a source stepper in about ten lines
  of code, with its output for Solidity and Fe.
- [companion/](companion/): the companion page, with more detail.

## Run locally

The demo pages are static. Serve the repo root over HTTP:

    python3 -m http.server

Then open <http://localhost:8000/>. The figures need a build first; see
the scripts in [inspector-app/package.json](inspector-app/package.json).
