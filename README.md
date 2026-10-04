# ethdebug post: materials

Supporting material for an upcoming Argot blog post introducing
[ethdebug/format](https://github.com/ethdebug/format).

Site: <https://ethdebug.github.io/argot-post-2026-10/>

- [planning/outline.md](planning/outline.md): the post's outline.
- [planning/topic-sentences.md](planning/topic-sentences.md): one
  sentence per planned paragraph.
- [demos/soldb/](demos/soldb/): soldb, Walnut's debugger, stepping a
  transaction in the browser (Solidity, Fe and BUG).
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
