# The post's figures

The interactive figures of the ethdebug post. The app is in
`inspector-app/` (React + TypeScript, Vite). Its build goes to
`demos/inspector/` on the site (`inspector-app/bin/site.sh`; the Pages
workflow runs it), beside the files here.

- `embed.html#scene=<id>`: one scene, drawn by its lens alone. It posts
  its height to the host page (`ethdebug:height`) and takes the host's
  theme (`theme=light|dark`).
- `embed-panel.html#scene=<id>&channel=<c>`: a walkthrough's panel, in
  a frame of its own beside its figure's (`embed.html` with
  `panel=external` and the same channel).
- `posters/<scene>-<theme>-<width>.webp`: each figure as a picture, for
  readers without the live figure (`inspector-app/bin/posters.mjs`,
  run by the Pages workflow).

The scenes (`inspector-app/scenes/<id>.json`): `reveal`,
`pitfall-nesting`, `pitfall-compiler`, `pointer-walkthrough`,
`optimized-locals`, `real-debugger` and `program-xray`.

## The data

Values are decoded by `@ethdebug/pointers` (ethdebug's reference
TypeScript library) from the ethdebug output of Walnut's solc fork
(walnuthq/solidity PR #10): each state variable's base slot, offset and
type from the program context, and the rules for non-value types from
the pointer templates. Mapping keys come from the KECCAK256 inputs in
the trace. Vyper emits no ethdebug: `pitfall-compiler` applies solc's
rule for `players` to the Vyper contract's storage, beside Vyper's own
layout, written by hand.

solc still writes a pointer expression's operator with `$`; the app
rewrites it to `~` as it reads a build
(`inspector-app/src/engine/run/build.ts` `solcTilde`). bugc writes `~`.

The files here are the builds' inputs: `contracts/Arcade.sol`,
`contracts/Arcade.vy` and `bug/arcade.bug`.

1. The builds: `SOLC=<solc> VYPER=<vyper> BUGC=<bugc>
   inspector-app/bin/build-arcade.sh` compiles them into
   `inspector-app/scenarios/arcade/builds/` (`sol`, `vy`, and `bug-O2`,
   bugc at -O 2). `<bugc>` is `packages/bugc` of an ethdebug/format
   checkout at the commit `inspector-app/vendor/PIN` names.
2. The story, `inspector-app/scenarios/arcade/scenario.json`: deploy;
   alice, bob and carol join and play; the message of the day changes.
   Each play's prevrandao is chosen so the roll comes out as the story
   says (`inspector-app/bin/scenario-roll.mjs`).
3. The runs: `@ethdebug/evm` runs the story for each build
   (`inspector-app/src/engine/run/`);
   `scenarios/arcade/digests.json` holds each run's digest, which the
   build checks.
4. The scenes: each a run, a lens and its moments (transaction and
   trace step). The build saves each scene's snapshot, its moments'
   state cut to what the scene reads (`inspector-app/bin/vite-scenes.ts`).

`real-debugger` runs soldb from `demos/debugger/`. `program-xray`
reads `inspector-app/src/figures/xray-data.json`, which
`inspector-app/bin/xray-data.mjs` makes from that folder's data.

## Tests

In `inspector-app`:

- `npm test`: tsc, the unit tests (vitest, `src/**/*.test.ts(x)`, each
  beside the module it tests, on the scenario's runs: `test/project.ts`)
  and the scripts' node tests (`bin/*.test.mjs`).
- `npx playwright test`: the e2e (`test/e2e/`), in Chromium, Firefox
  and WebKit, on the dev server, each on a scene's embed (`ready` in
  `test/page.ts`). `@chromium`: Chromium only; `@slow`: not in
  `npm run test:fast`.
- `test/golden/`: pointer-walkthrough's walkthroughs as recorded, the
  engine's (`npm run golden` records them again) and the embed's
  (`UPDATE_GOLDEN=1 npx playwright test test/e2e/walkthrough/golden.spec.ts
  --project=chromium`). Review the diff.

CI (`.github/workflows/test.yml`) runs them on every push to main and
every PR.
