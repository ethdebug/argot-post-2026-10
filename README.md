# ethdebug post: figures and demos

The interactive figures for the ethdebug post on the
[Argot blog](https://www.argot.org/blog), and the demos behind them.
The post introduces [ethdebug/format](https://github.com/ethdebug/format).

Site: <https://ethdebug.github.io/argot-post-2026-10/>

- [inspector-app/](inspector-app/): the post's figures. The site
  serves them at `demos/inspector/embed.html`; see
  [demos/inspector/README.md](demos/inspector/README.md).
- [demos/debugger/](demos/debugger/): soldb, Walnut's debugger, for
  Solidity and Fe. The real-debugger figure loads its engine and data
  from here. Its saved
  Solidity trace leaves out the flat copies of each step's state, which
  soldb drops on reading; see
  [SOURCE.md](demos/debugger/SOURCE.md#the-saved-trace-one-change).
- [demos/stepper/](demos/stepper/): a source stepper in about ten lines
  of code, with its output for Solidity and Fe.

## Run locally

The figures: in `inspector-app/`, run `npm ci` and `npm run dev`, then
open <http://localhost:5180/demos/inspector/embed.html#scene=reveal>
(or another scene in `inspector-app/scenes/`). See the other scripts in
[inspector-app/package.json](inspector-app/package.json).
