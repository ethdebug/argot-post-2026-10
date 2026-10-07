# Storage, by name

A browser demo for the ethdebug/format blog post. One contract, Scores
(`contracts/Scores.sol`, shown at the top of the page), in a list of
scenes. Its main point is linking both ways: click a byte inside a
word of storage (a packed slot too), and the variable that owns it
lights up; click a variable, and its bytes light up. "How this was
found" shows each step from the variable to its bytes: the template
solc wrote, each expression evaluated, and the final regions. Diffs
come in only where a scene needs "this changed".

Values are decoded by `@ethdebug/pointers` (ethdebug's reference
TypeScript library) from the ethdebug output of Walnut's solc fork
(walnuthq/solidity PR #10): each state variable's base slot, offset and
type from the program context, and the rules for non-value types from
the pointer templates. This page does not use soldb.

Serve the repo root over HTTP and open `demos/inspector/`. The page needs no
node: everything comes from `fixtures/`.

## Scenes

`fixtures/index.json` lists the scenes. Each has a title, a fixture,
its points (one: `["before"]` or `["after"]`, the state on that side of
the fixture's transaction; or two: `["before", "after"]`), what each
point is called (`when`), a summary line, the variable selected first
(`select`), and for two points the mode shown first. Each scene's intro
is in `index.html` (`#intros`, one `<p data-scene>` per scene), and so
are the picker's buttons, with `data-fixture` and `data-single` (one
point), so that the page does not move when the data comes;
`bin/run.mjs` checks that they match.

1. A packed slot: `total` and `rounds` share slot 3. One point, after
   Alice's `record(7)`. Nothing selected.
2. Alice's entry: `players[alice]`, her `Player` packed in one slot at
   keccak(alice . 0), and the derivation. One point, after
   `record(7)`. `players[alice].streak` selected.
3. Same slot, new values: before and after Alice's `record(30)` (her
   streak bonus makes her score 67, streak 2). `players[alice]`
   selected.
4. A string outgrows its slot: before and after
   `setMotto("play fair, keep score, and write the scores down")` (48
   bytes), after `setMotto("play fair")`. `motto` selected. This scene
   also shows the calldata (below).
5. Vyper reads it differently: see "Vyper" below. One point.

A scene with one point has no other state: no Before | After, no "show
other state", no change marks or cards, no popover facts ("read,
written"), and its dump shows only the slots of the values on the page.
The details say "Holds" for the value. The page makes such a scene from
the fixture by using the one side's words as both sides (`atPoint()` in
`main.js`).

## Vyper

Vyper emits no ethdebug, so the page has no rule from Vyper. The Vyper
scene is the smallest honest version: `contracts/Scores.vy` (Vyper
0.4.3), deployed, then `record(7)` and `record(30)` from Alice. The page
applies solc's rule for `players` (from Scores.sol's ethdebug output,
`players` only) to the Vyper contract's real storage, with Alice's key.
keccak256(key . slot 0) =
`0x7230…a722` holds nothing, so the tree shows `score` 0, with no error:
what a tool built on Solidity's rules reads. Vyper's own rule,
keccak256(slot 0 . key) = `0x5c63…fee4`, puts each member in its own
slot: 67, 2 and 1. Those three words (from the trace of Vyper's
`record(30)`) are in the dump, named "Vyper's keccak(slot 0, …)", and no
value owns them. "How this was found" ends with "Vyper's rule, for
contrast: not from ethdebug", one step per word, each lighting its word.
The script checks those values against the node and the getter.

## Calldata (the setMotto scene)

`setMotto(string calldata m)`: `m` stays in the transaction's input.
solc's ethdebug output here gives no pointer for a parameter (its
instructions carry `code` contexts only) and no calldata types or
templates, so the page cannot ask ethdebug where `m` is, and says so.
`calldata.js` shows the input like the other dumps (the selector line,
then words by offset) and labels the parts by the ABI encoding rules:
the selector, `m`'s head word (the offset, 32), its length (48) and its
bytes. The linking works both ways: click a byte to select its part, a
part (or `m`) to light its bytes; "How this was found" lists the ABI
steps, each lighting its bytes. The scene names its function and
parameter in `fixtures/index.json` (`calldata`).

## Files

- `index.html`, `main.js`, `style.css`: the page. `index.html` also
  holds the loader (below, "Loading on a slow link"), the scenes'
  intros and the contract's source.
- `decode.js`: the decoding, shared by the page and the fixture script.
- `panel.js`: the words panel (below).
- `calldata.js`: the calldata view of the setMotto scene.
- `vendor/pointers.js`: `@ethdebug/pointers` bundled with esbuild from
  ethdebug/format `origin/main` at commit
  `ec7a81386` (includes #317, the scoping fix, not yet released),
  minified. Rebuild with `bin/build-pointers.sh <checkout>` after
  `yarn install` and building `packages/format` and `packages/pointers`,
  then run `bin/sizes.mjs`.
- `bin/sizes.mjs`: writes the size of the bundle and of each fixture
  into the loader in `index.html` (for "n KB of m KB"). Run it after
  changing any of them; `bin/run.mjs` fails when the sizes are stale.
- `bin/make-fixtures.mjs`: compiles, deploys, runs the transactions,
  writes `fixtures/` (not `index.json`) and puts the contract's source
  into `index.html`.
- `bin/run.mjs`: Playwright check in Chromium, Firefox and WebKit;
  writes `screenshots/` (only `desktop-packed.png` is committed:
  the first scene, `total` selected by a click on its byte;
  `desktop-dark.png`: Same slot, `streak` selected, with "How this was
  found"; `insets.png`: Same slot, After, Alice's entry lit, with its
  "before" card; `memory.png`: the memory section, `names[1]` selected,
  A = array built, B = name replaced; `memory-phone.png`: the memory
  section on a phone; `phone.png`: the motto scene on a phone, `motto`
  selected). It also checks the loading (below): the sizes, the picker
  and the intros in `index.html`, the contract in `index.html`, no local
  paths in the files, a failed load and Retry in each browser, and, in
  Chromium, the page on "Slow 3G" (it prints each request with its
  size). Run it with `PAGE=<the page's URL>`; the slow-link check
  serves the repo itself.
- `mem.js`, `bug/rename.bug`, `bin/make-memory-fixture.mjs`,
  `fixtures/memory.json`: the memory section (below).
- `contracts/`: `Scores.sol` and `Scores.vy` (the program of the blog
  post's painful examples).

## How the fixtures were made

1. `anvil --steps-tracing --port 8555 --silent`
2. `SOLC=<solc> VYPER=<vyper> RPC_URL=http://127.0.0.1:8555 node
   bin/make-fixtures.mjs`, then `node bin/sizes.mjs`. `<solc>` is a
   native solc built from Walnut's fork, walnuthq/solidity PR #10 (head
   `c434b2ea`, reports `0.8.38-develop.2026.10.5+commit.c434b2ea`);
   stock solc 0.8.37 gives ethdebug types and templates but no program
   context with the state variables, which the page needs. `<vyper>` is
   Vyper 0.4.3. Without them, the script runs `solc` and `vyper` from
   your PATH. It compiles Scores.sol with `--standard-json`, viaIR,
   optimizer off, `experimental: true`, `debug.debugInfo: ["ethdebug",
   "ast-id"]`, and outputs `ethdebug.resources` and
   `ethdebug.compilation` (together they give the global
   `ethdebug.resources`), `evm.deployedBytecode.ethdebug` (the program,
   with the program-level context), bytecode and the AST. No
   storageLayout.
3. Transactions, all from Alice (anvil account 0), on a fresh anvil:
   - Scores: deploy; `record(7)`; `record(30)` (fixture
     `scores-record`: the scenes with one point use its before side);
     `setMotto("play fair")`; `setMotto("play fair, keep score, and
     write the scores down")` (fixture `scores-motto`; its mapping key
     comes from the trace of `record(7)`, as setMotto hashes none).
   - Scores.vy: deploy; `record(7)`; `record(30)` (fixture
     `scores-vyper`; see "Vyper").
4. For each transaction the script saves:
   - the trace steps the page needs from `debug_traceTransaction`
     (with memory): KECCAK256 steps with memory (mapping keys), SLOAD
     with the loaded value, SSTORE. The full trace is not kept; the
     fixture records its step count.
   - every storage word the decoder reads, before (block − 1) and after
     (block), from `eth_getStorageAt`, plus every slot the trace
     touched. The script checks that the first SLOAD and last SSTORE of
     each slot agree with the node.
   - the source, the program-level context's `variables` (one per
     state variable: name, pointer, type id), ethdebug `resources`
     (types, pointers), and state variable source ranges from the AST.
   - `keys` and `keysFrom` when the mapping keys come from elsewhere
     than the transaction's own KECCAK256 inputs.

To change the contract: edit `contracts/`, the transactions in
`bin/make-fixtures.mjs`, the scenes in `fixtures/index.json` and their
intros and buttons in `index.html`, and the expected values in
`bin/run.mjs`; then rerun the script, `bin/sizes.mjs` and `bin/run.mjs`.

`bin/run.mjs` checks the decoded values against the values the calls
wrote (score 7 then 67, streak 1 then 2, history `[7, 60]`, total 67,
rounds 2; and the Vyper storage values 67, 2 and 1).

## Which data is ethdebug, which is not

From ethdebug (emitted by Walnut's solc fork, walnuthq/solidity #10):

- state variables (the program-level context, `context.variables` of
  the deployed code's program): for each one, its name, its type id,
  and a pointer. A value type's pointer is its region (slot, and for a
  value narrower than the word its offset and length, counted from the
  high end of the word); with no offset it starts at byte 0, and with no
  length it fills the word. A mapping's pointer is its base slot; a string's or dynamic
  array's gives the base slot to its type's template.
- types (`resources`): kinds, bit widths, struct members, enum values, and
  `definition.location` (used to mark a struct in the source).
- pointer templates (`resources`): the rule for each non-value type
  (mapping, struct, dynamic array, string), with slot arithmetic,
  keccak256, packed offsets and lengths, and the short/long string
  condition.

Not from ethdebug:

- mapping keys: from KECCAK256 inputs in the trace.
- variable declarations marked in the source: solc's AST.

## The words panel

Beside the tree (under it, on a narrow screen), the panel shows one
dump of storage: before or after the transaction (the Before | After
toggle; After by default). A dump is one column of words in address order, one
32-byte word to a line, as
in a hex dump. Relevant slots: every slot a value on the page lives in,
and every slot the transaction read or wrote (SLOAD/SSTORE in the
trace). Byte 0 is the most significant byte, as ethdebug counts
offsets.

- Lines: each word is one line of 32 bytes, in four groups of eight.
  The byte size follows the panel's width; on a phone the words scroll
  sideways inside the panel, the address gutter
  stays in view, and the page does not scroll sideways.
- Order and gaps: slots by numeric address, ascending, so a run of
  hashed slots (a long string's data) reads as one block. A "⋯" gap
  line comes first and wherever the next slot is not the address + 1,
  and last.
- Gutter: only the end of the slot's address (`…0002`), right-aligned
  against the bytes like a hex dump's line labels. The one mark at rest
  is a small ring beside the address for a slot the transaction wrote
  without changing it (nothing else would show that; none of the
  current fixtures has one). The full address and what the transaction
  did to the slot are in the address's tooltip.
- No names in the dump: names stay in the tree, and the two relate by
  highlighting only.
- Popover: for each run of lit slots (below), and for a run the value
  uses only in the other state, a dark label with an arrow says how
  the slots were found, what the transaction did to them ("read only",
  "written", "read, written", "written, same value", "cleared (written
  to zero)"), and the full address, e.g. `keccak(0xf39f…2266, slot 0) +
  1 · read, written`. It sits over the run in Before and under it in
  After, its left edge at the gutter's, its arrow on the address. Like
  a card, it may cover unlit rows (addresses included), never a lit
  row, a lit row's address or another annotation; nothing shows at
  rest. The name comes from
  the `$keccak256` defines in the replayed steps, not from new hashing.
- Bytes: each byte belongs to the value whose region covers it. Regions
  are the ones the library returned (`value.region`); for a string,
  also its `length-flag` and `long-length` regions (`value.parts`,
  added in `decode.js`). A region longer than the rest of its word goes
  on into the next slots. Each value in a slot has a subtle tint, the
  same in both states; bytes no shown value owns are dim; changed bytes
  are underlined (red in Before, green in After); a word that did not
  change is muted.
- Zebra: every other word line has a very light stripe, which fades
  further while something is lit.
- Linking: hover or focus a tree row, a byte, an address, or a region
  step of "How this was found", and the value's bytes light up
  (`--mark`), with its tree row. A byte outlines its byte positions;
  an address outlines its whole word. A lit run's addresses get one
  soft rounded tint in the gutter (the slot popover points at it).
- Details: under the dump, a short list for what is lit (selected, or
  hovered with nothing selected): Value (path and type), Where (slot
  and bytes, per state when they differ), Before and After (value and
  hex); for a byte, the bytes pointed at. It grows with its content and
  never scrolls; at rest it shows a hint.

## Selecting, and the mode (scenes with two points)

- Selection lives on the variable. Click a tree row (or Enter or Space
  on a focused row) to select it, changed or not; click it again,
  press Escape, or click empty space to clear it. Clicking a byte
  selects the variable that owns it (a byte no value owns clears).
- While a variable is selected, the view stays on it: hovering other
  bytes, rows or addresses changes nothing. Hovering its own bytes
  only puts byte detail in the details; a chip beside the Before |
  After toggle says "viewing … · Esc to clear". Clicking another
  variable's byte
  switches the selection. With nothing selected, hover previews.
- Show: Before | After (the scene's mode first), under the scene
  picker. It picks the dump shown, the values in the tree (a row still
  says whether it changed), and the state every derivation is for.
- "show other state" (on by default), beside the toggle, turns all the
  cards off and on: those in the dump and those in the tree. While a
  changed value is lit, a card by its tree row gives its value in the
  other state (under the row, or under a parent's members, in Before;
  over the row in After); a lit parent gets one card with its changed
  members. There is never a card for what did not change, in the tree
  or the dump. Highlighting works the same with the cards off.
- The URL hash keeps the view, e.g.
  `#ex=motto&mode=before&sel=motto&a=built&b=replaced&mmode=after`
  (`insets=0` when the cards are off)
  (`ex`: the scene id: `packed`, `alice`, `streak`, `motto`, `vyper`;
  `mode`: only for a scene with two points; `sel`: the tree path, empty
  when the scene's default selection was cleared, absent for the
  scene's default; `a`, `b`, `mmode`, `msel`: the memory section). The
  format is the old one; only the `ex` values changed, and an old one
  (`token`, `strings`, …) is stale. It is updated with
  `history.replaceState`, only when it changes; a stale hash falls back
  to the first scene with its defaults.
  `#storage` and `#memory` link to the sections.

## How this was found

One panel, under the tree (on a phone: between the tree and the
words), shows the selected variable's derivation: where it starts, the
template, each define with its inputs and value, the branch each `if`
took, the list item and count, and each region (a string's
`length-flag` and `long-length` regions go in where the template
reaches them). Hover or focus a region step to light its bytes.

The panel follows the toggle and says whose derivation it is. With
"show other state" on, it also shows the other state's derivation:
steps the two share appear once; a step that evaluates differently
shows both evaluations on two lines ("before …", "after …"); and where
the two take different branches (for `motto`, the If on
the length flag), the rest splits into two lists, one per branch,
labeled with state and branch (e.g. "after · then (short-string
layout)"), this state's first and the other muted. Step numbers go on
in each list, and each list's region steps light their bytes. When
the two are the same, one list says so. The toggle is the switch
between the two states. A value that exists in one
state only says so
(e.g. `xs[0]` before: "no such value (xs has 0 items)").

## Annotations in the dumps

Lit rows are grouped into runs (consecutive addresses; a gap ends a
run). Each run gets two annotations, which float over the neighboring
rows. They never move the rows, grow a box or add a scrollbar (on a
wide page the words column has no scroll box of its own; on a phone
annotations stay inside the words' sideways scroll):

- The slot popover (dark, with an arrow on the address): how the slots
  were found and what the transaction did to them, e.g.
  `keccak(0xf39f…2266, slot 0) + 0 … + 1 · read, written`. Over the run
  in Before, under it in After.
- The card (light, labeled "after" or "before"): a picture of the same
  whole words in the other state, made by cloning those rows of the
  hidden dump (addresses, tints, highlight, change marks), muted a
  little, gutter plus all 32 bytes, at the same size and in the same
  columns; its addresses sit in a tinted strip of their own. Only words
  where a lit byte differs in the other state are in a card; a run
  with none gets no card. The "after" card goes under the run in Before; the
  "before" card over it in After.
- A word the value uses only in the other state (`motto`'s long data
  in Before) is in the dump too, and gets a
  card, with no other mark.
- Fallback: an annotation may cover rows that are not lit (they are
  dimmed), but not lit bytes or another annotation, and it may not
  leave the content of a box that scrolls. One that cannot be placed
  is not moved around: it goes, labeled, to a tray fixed at the bottom
  of the window, which takes no room in the page. The tray is the same
  in Before and After: if a run's card cannot be placed in one state,
  it goes to the tray in both (the page lays the hidden dump out for a
  moment to find out).

Highlights that still use the tray (desktop and phone): two lit runs
with only a "⋯" line between them, where one run's popover and the
next run's card need the same space: `motto` (slot 2, then its long
data after a "⋯" line), in both states.

## How the derivation is found

`dereference()` gives the regions and `view.read()` the bytes; those are
the values on the page. The library does not report the steps it took,
so `decode.js` `replay()` walks the same template (group, list, if,
define, template reference) and calls the library's own `evaluate()` for
each expression. Each replayed region must equal the region
`dereference()` returned, or decoding stops with an error. `evaluate()`
is imported from the package's dist (it is not a public export).

## Known gaps (also on the page)

- Only mapping keys hashed in the transaction are shown.
- Nested mappings need chaining templates (one per level); not done.
  Scores has none.
- No calldata pointer from solc: the calldata view uses the ABI rules.

## Memory, with BUG (preview: bugc from ethdebug/format main)

A separate section under the storage demo shows memory at two points
of one run of a BUG program, as the same kind of dumps (A, then B), with
the program's local variables as a tree. It works like the storage
demo: a Show control (A | B, B by default), "How this was found" for
the selected value, cards beside the lit words with the same words at
the other point, and its own URL keys (`a`, `b`, `mmode`, `msel`).
Since PR #328 (`ac1164cd9`, merged, not yet released), bugc on `main`
emits, for each instruction, a pointer for each local in scope; since
PR #343 (with the bounds checks of #344 and the bytes-literal fix of
#345, at `2fd7e781b`), it compiles writes to memory array elements. For a
dynamic array, the pointer names the local's word, a length region at
the address the word holds (`{"$read": "names"}`), and a `list` of
element words at `base + 32 + 32*i`; for a string or `bytes`, a length
region and a data region sized by the length. Element references
compose the same way. Structs and fixed-size arrays in memory have
types only (bugc cannot build them in memory yet).

The program, `bug/rename.bug`, replaces one name in
`["ada", "grace", "alan"]` with a longer one: `names[1] = "grace
hopper"`. `names` is an `array<string>`. Its word (0xa0) holds the
address of its length (0x140), and the element words follow (0x160,
0x180, 0x1a0); each holds the address of a string: a length word, then
the bytes. bugc writes `"grace hopper"` at free memory (0x280) and
then puts that address in the element's word (0x180). `"grace"` stays
at 0x200, and no value owns it any more (its bytes are dim at B).
Like the storage section's `motto`, the value moved: the element's word
changed, and the old data was left behind. The points:

- "Array built" (A by default): the first step of the literal
  `"grace hopper"`, with `names` listed; `names[1]` = "grace" at 0x220.
- "New string written": the last step of the literal: the new length
  and bytes are at 0x280 and 0x2a0, and `names[1]` is still "grace".
- "Name replaced" (B by default): the MSTORE to the element's word;
  `names[1]` = "grace hopper" at 0x2a0. (bugc's code range for this
  instruction is `names[1] `, the target of the assignment.)

`names[1]`'s derivation: the array's word, its length (3), item 1, the
element's word (0x200 at A, 0x280 at B), the string's length (5, then
12), its bytes. With `names[1]` selected, a card beside the element's
word shows it at A.

How the fixture was made:

1. A detached worktree of ethdebug/format main at `2fd7e781b`, `yarn
   install --frozen-lockfile && yarn build`.
2. `anvil --steps-tracing --port 8547 --silent` (without
   `--steps-tracing`, anvil returns no steps).
3. `BUGC=<worktree>/packages/bugc RPC_URL=http://127.0.0.1:8547 node
   bin/make-memory-fixture.mjs`. It compiles `bug/rename.bug` (`OPT`
   sets the level; 0 by default; levels 1 to 3 give the same values
   and pass the script's checks, at other steps), deploys it, calls it
   once, traces with memory, and saves the three points: the step, its
   instruction's `variables` context (as bugc emitted it, with the
   source path made relative), its code range, and memory after the
   step (a context describes the state after its instruction). It
   checks the values, that the element's word changed, and that the old
   string's bytes did not.

The page dereferences each memory pointer with `@ethdebug/pointers`
against that point's memory (`decode.js` `decodeLocals`), and walks
the regions by name: the local's word, `-length`, `-element` for each
item, `-data` for a string's bytes. Each value keeps the regions read
to find it (its parts); "How this was found" replays the pointer with
the library's evaluator, as for storage, and each step names what its
region holds (an address, a length, the bytes). Each region is owned
by the first value that reads it, so an array's word and length belong
to the array, and an element's word and length to the element.
`size` is in storage and is not shown. Shown words: those a value
lives in at A or B, and those that changed; other words are a "⋯" gap.

## Loading on a slow link

What the page fetches (GitHub Pages gzips text):

| File | gzip | size |
| --- | ---: | ---: |
| `index.html` (with the loader) | 8.0 KB | 24.2 KB |
| `main.js`, `panel.js`, `decode.js`, `mem.js`, `calldata.js` | 41.8 KB | 124.2 KB |
| `style.css`, `../../shared/appendix.css` | 8.9 KB | 30.0 KB |
| `vendor/pointers.js` (minified) | 69.0 KB | 272.1 KB |
| `fixtures/index.json`, `memory.json` | 1.5 KB | 9.7 KB |
| the first scene's data (`scores-record.json`) | 2.3 KB | 11.4 KB |
| the other two fixtures, idle-time | 4.5 KB | 18.3 KB |
| total | 136.0 KB | 489.9 KB |

The bundle was 86.8 KB gzip (411 KB) before it was minified.

- Progress: a bar at the top and a line at the bottom left say "Loading
  the decoder and the data: n KB of m KB" (sizes after gzip is undone,
  from `bin/sizes.mjs`). The stylesheets do not block it: they load
  with `media="print"` and the page stays hidden until both are in,
  then shows in its final layout. The loader is inline at the end of
  `index.html`, so it starts the bundle, the index, the first scene's data
  and the memory data at once; `modulepreload` fetches the page's
  modules beside them. The bundle is imported from the text it fetched
  (a `blob:` URL), and `decode.js` takes it from
  `globalThis.ethdebugPointers`.
- No jumps: until the data comes, the tree shows gray lines, and the
  picker, the Show buttons, the meta line, the summary and the words
  have their room (the picker's buttons are in `index.html`;
  `bin/run.mjs` checks that they match `fixtures/index.json`).
- A scene's data is fetched when it is shown. Once the page is
  usable, the other fixtures are fetched one at a time while the
  browser is idle and nothing else is loading. Picking one that is
  still loading shows its progress in the bar.
- A load that fails says which file and why ("HTTP 503", "the network
  request failed"), in the bar and where the content would be, each
  with a Retry button. Retry loads the failed files again.

On Chromium's "Slow 3G" (400 ms latency, 400 kbit/s, over CDP; text
gzipped as on GitHub Pages; `bin/run.mjs` measures it): before, the
page painted nothing until 1.3 s, showed "Loading…" with no progress,
and was usable at 5.3 s (all four examples decoded at 6.6 s). Now
progress shows at about 0.6 s (first paint 0.46 s), the first scene
is usable at about 3.8 s, a prefetched scene shows in under 0.1 s,
and nothing moves (layout shift 0.000).

