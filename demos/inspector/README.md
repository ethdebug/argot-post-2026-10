# Storage, by name

A browser demo for the ethdebug/format blog post. Pick a transaction and
see the contract's storage by Solidity name, before and after, with
changed values marked. Click any value, changed or not, to see how it
was found: the template solc wrote, each expression evaluated, and the
final regions.

Values are decoded by `@ethdebug/pointers` (ethdebug's reference
TypeScript library) from the ethdebug output of Walnut's solc fork
(walnuthq/solidity PR #10): each state variable's base slot, offset and
type from the program context, and the rules for non-value types from
the pointer templates. This page does not use soldb.

Serve the repo root over HTTP and open `demos/inspector/`. The page needs no
node: everything comes from `fixtures/`.

## Files

- `index.html`, `main.js`, `style.css`: the page.
- `decode.js`: the decoding, shared by the page and the fixture script.
- `panel.js`: the words panel (below).
- `vendor/pointers.js`: `@ethdebug/pointers` bundled with esbuild from
  ethdebug/format `origin/main` at commit
  `ec7a81386` (includes #317, the scoping fix, not yet released). Rebuild with `bin/build-pointers.sh <checkout>` after
  `yarn install` and building `packages/format` and `packages/pointers`.
- `bin/make-fixtures.mjs`: compiles, deploys, runs the transactions and
  writes `fixtures/`.
- `bin/run.mjs`: Playwright check in Chromium, Firefox and WebKit;
  writes `screenshots/` (only `desktop-packed.png` is committed;
  `desktop-packed.png`: Packed, `b` selected;
  `desktop-dark.png`: Token, the sender's nonce selected, with "How
  this was found"; `insets.png`: Token, After, the sender's `Account` (a
  run of two slots) lit, with its "before" card;
  `memory.png`: the memory section, `longest` selected, A = loop
  starts, B = loop done; `memory-phone.png`: the memory section on a
  phone, `longest` selected; `phone.png`: Strings, `grows` (short → long) selected, the
  panel saying the before and after derivations differ).
- `mem.js`, `bug/longest.bug`, `bin/make-memory-fixture.mjs`,
  `fixtures/memory.json`: the memory section (below).
- `contracts/`: Token, Shop and Packed (also used by the debugger demo)
  and Strings (written for this page).

## How the fixtures were made

1. `anvil --steps-tracing --port 8548 --silent`
2. `SOLC=<solc> RPC_URL=http://127.0.0.1:8548 node
   bin/make-fixtures.mjs`. `<solc>` is a native solc built from Walnut's
   fork, walnuthq/solidity PR #10 (head `c434b2ea`, reports
   `0.8.38-develop.2026.10.5+commit.c434b2ea`); without `SOLC`, the
   script runs `solc` from your PATH. It
   compiles each contract with `--standard-json`, viaIR, optimizer off,
   `experimental: true`, `debug.debugInfo: ["ethdebug", "ast-id"]`, and
   outputs `ethdebug.resources` and `ethdebug.compilation` (together
   they give the global `ethdebug.resources`),
   `evm.deployedBytecode.ethdebug` (the program, with the program-level
   context), bytecode and the AST. No storageLayout.
3. Transactions (from anvil account 0):
   - Token: deploy with supply 1000; `transfer(0x7099…79C8, 25)`.
   - Shop: deploy; `place("widget", 5, 3)` (fixture made, not shown;
     see below).
   - Packed: deploy; `set(7, 300, 123456789)`.
   - Strings: deploy; `setAll("short", "this one starts long, then
     becomes a short one", "exactly thirty-one bytes, short",
     "thirty-two bytes, the least long")` (setup, not shown);
     `update("a string longer than thirty-one bytes, stored long",
     "now short")`. In one transaction `grows` goes short → long and
     `shrinks` long → short (solc zeroes its two old data slots, which
     the page shows); `most` (31 bytes, the longest short string) and
     `least` (32 bytes, the shortest long string) do not change.
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

Cross-check before anvil stopped: `cast storage` on the Token at
`keccak256(sender . 0)` gave `0x…03cf` (975) and the next slot `0x…01`
(nonce 1), as the page shows. `cast call` gave the same `name()`,
`xs(0)` = 307 and `b()` = 300 for Packed. `bin/run.mjs` checks the
decoded values against the values the calls wrote.

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

## Selecting, and the mode

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
- Show: Before | After (After by default), under the transaction
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
  `#ex=strings&mode=after&sel=grows&a=before&b=loop&mmode=after`
  (`insets=0` when the cards are off)
  (`ex`: the fixture id's first word; `sel`: the tree path; `a`, `b`,
  `mmode`, `msel`: the memory section). It is updated with
  `history.replaceState`, only when it changes; a stale hash falls
  back to the defaults (an old `mode=compare` shows After).
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
the two take different branches (for `grows` and `shrinks`, the If on
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
- A word the value uses only in the other state (`grows`' new data in
  Before, `shrinks`' old data in After) is in the dump too, and gets a
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
next run's card need the same space. Token `accounts` (both entries);
Shop `orders`, `orders[1]` (its struct and its string data) and
`orders[1].quantities`; Packed `xs` (length slot and data slot).
Strings `grows` and `shrinks` render in place.

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
  These contracts have none.
- Shop was held back until a scoping bug in `@ethdebug/pointers` was fixed
  (ethdebug/format #317, merged 2026-10-03): a `define` inside a group
  member leaked into later members. The page now bundles a build with
  the fix, and Shop decodes correctly.

## Memory, with BUG (preview: bugc from ethdebug/format main)

A separate section under the storage demo shows memory at two points
of one run of a BUG program, as the same kind of dumps (A, then B), with
the program's local variables as a tree. It works like the storage
demo: a Show control (A | B, B by default), "How this was found" for
the selected value, cards beside the lit words with the same words at
the other point, and its own URL keys (`a`, `b`, `mmode`, `msel`).
Since PR #328 (`ac1164cd9`, merged, not yet released), bugc on `main`
emits, for each instruction, a pointer for each local in scope. For a
dynamic array, the pointer names the local's word, a length region at
the address the word holds (`{"$read": "names"}`), and a `list` of
element words at `base + 32 + 32*i`; for a string or `bytes`, a length
region and a data region sized by the length. Element references
compose the same way. Structs and fixed-size arrays in memory have
types only (bugc cannot build them in memory yet).

The program, `bug/longest.bug`, finds the longest name in
`["ada", "grace", "alan"]` and stores its length. `names` is an
`array<string>`; `longest` is a `string` local that starts as
`names[0]` and becomes `names[1]`. bugc copies no bytes: `longest`'s
word holds the address of the element's string, so `longest` and that
element light the same bytes. The points: "Loop starts" (the first
`i < names.length`, i = 1, `longest` = "ada"), "Longer name found"
(after `longest = names[i]`), "Loop done" (the last test, i = 3,
`longest` = "grace"). At "Longer name found", bugc (without
optimization) keeps `longest` in another word, so its derivation parts
from the other points'.

How the fixture was made:

1. A detached worktree of ethdebug/format main at `ac1164cd9`, `yarn
   install --frozen-lockfile && yarn build`.
2. `anvil --steps-tracing --port 8547 --silent` (without
   `--steps-tracing`, anvil returns no steps).
3. `BUGC=<worktree>/packages/bugc RPC_URL=http://127.0.0.1:8547 node
   bin/make-memory-fixture.mjs`. It compiles `bug/longest.bug` (`OPT`
   sets the level; 0 by default; levels 1 to 3 give the same values
   and pass the same checks), deploys it, calls it once, traces with
   memory, and saves three points: the step, its instruction's
   `variables` context (as bugc emitted it, with the source path made
   relative), its code range, and memory after the step (a context
   describes the state after its instruction). It checks the values
   and that `longest` is at the expected element's bytes.

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
