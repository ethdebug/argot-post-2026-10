# ethdebug post: materials

Supporting material for an upcoming Argot blog post introducing
[ethdebug/format](https://github.com/ethdebug/format).

Site: <https://ethdebug.github.io/argot-post-2026-10/>

- [planning/outline.md](planning/outline.md): the post's outline.
- [planning/topic-sentences.md](planning/topic-sentences.md): one
  sentence per planned paragraph.
- [demos/debugger/](demos/debugger/): step through a transaction in
  the browser. Every tab steps the same contract, Arcade, and the same
  transaction: soldb, Walnut's debugger, for Solidity and Fe; ethdebug's
  reference implementation for BUG; and "the old way", a source-map
  stepper on an optimized Solidity build with no ethdebug. Its saved
  Solidity trace leaves out the flat copies of each step's state, which
  soldb drops on reading; see
  [SOURCE.md](demos/debugger/SOURCE.md#the-saved-trace-one-change).
- [demos/inspector/](demos/inspector/): a storage inspector that shows
  each variable's bytes, found through solc's ethdebug pointers.
- [demos/stepper/](demos/stepper/): a source stepper in about ten lines
  of code, with its output for Solidity and Fe.
- [companion/](companion/): the companion page the post links to for
  depth.

## Run locally

The pages are static. Serve the repo root over HTTP:

    python3 -m http.server

Then open <http://localhost:8000/>.
