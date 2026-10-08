# Storage, by name

A browser demo for the ethdebug/format blog post. One contract, Arcade
(`contracts/Arcade.sol`, shown at the top of the page, collapsed), in a list of
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


## About this demo

This is the text the page used to carry; the page keeps one line a
scene so the inspector is on the first screen, and links here.

### What the page shows

One contract, Arcade, in a few scenes. Click a byte in a word of
storage, and the variable that owns it lights up; click a variable,
and its bytes light up. "Show how it was found" walks from the
variable to its bytes. Some scenes compare two points (Before | After)
and mark what changed.

Decoded by ethdebug's reference library from solc's ethdebug output (a
preview build of Walnut's solc fork, walnuthq/solidity PR #10), with
the optimizer off. Each variable's base slot, offset and type come
from the program context; the rules for mappings, structs, arrays and
strings come from the pointer templates in the resources.
`@ethdebug/pointers` is from ethdebug/format main (see
`vendor/pointers.js` below), pending release.

### The contract

Every scene shows one contract, Arcade: the scoreboard of a big
multiplayer game. A player calls `join(name)` once, then `play()`,
which rolls a hit or a miss. A hit adds 1 to the player's combo and
scores 10 × combo (at most 5×); a miss sets the combo back to 0, and
the score stays. Each player's `Player` in `players` is one full
packed slot (score, combo, bestCombo, plays, hits, lastBlock) and
a name in the next slot; `playerList` lists who joined, since a mapping
cannot list its keys; `totalScore` and `totalHits` count all points
and hits; `setMotd` sets the message of the day. The story: deploy
with a 50-byte motd; alice, bob and carol join; alice hits twice, bob
hits, carol hits four times (a best combo of 4), then misses (the
middle of the game); alice hits a third time; then
the motd becomes "gl hf". Each player is an anvil account.

### The scenes

- The middle of the game: alice, bob and carol have joined and played.
  Each player's record is found by hashing the player's address with
  the mapping's slot, keccak256(address . slot 3), so the three
  records land far apart. Each is one word with six counters packed in
  it. The name is in the next slot: alice's and bob's fit in it;
  carol's is 34 bytes, so its bytes move to keccak256(that slot).
  `playerList` keeps its length in slot 0 and its items from
  keccak256(slot 0); `motd` is slot 1; `totalScore` and `totalHits`
  share slot 2. carol's record shows combo 0 beside bestCombo 4. alice's
  record is selected.
- Alice plays: alice hits a third time: combo 3, so she scores
  10 × 3 = 30. In her one slot, score goes from 30 to 60, combo,
  bestCombo, plays and hits from 2 to 3, and lastBlock to this
  block; `totalScore` goes from 140 to 170 and `totalHits` from 7 to 8.
  Before
  is the middle of the game, After is after her hit. Beside the lit
  word, a card shows it in the other state.
- A string moves into its slot: Arcade was deployed with a 50-byte
  message of the day. A string that long keeps only 2 × its length + 1
  in its slot, slot 1, and its bytes at keccak256(slot 1) and the slot
  after it. `setMotd("gl hf")` makes it 5 bytes: short enough that
  Solidity stores it in slot 1 itself, its bytes from the high end and
  2 × its length in the last byte. solc writes zeros to the two old
  data slots; they are in the dump After. The walkthrough shows where
  the two rules part. The call's calldata is under the storage.
- Vyper reads it differently: the same three players, in the same game
  compiled by Vyper 0.4.3 (`contracts/Arcade.vy`), at the same middle
  of the game. The rule from the first scene, keccak256(address .
  slot 3), is Solidity's; it finds nothing here: the tree shows each
  player with zeros and no name, with no error. Vyper does not pack
  and keeps its arrays inline, so its `players` is slot 108, not 3; it
  hashes the slot first, keccak256(108 . address), and puts each
  counter in its own slot, then the name's length and bytes. So the
  real records sit elsewhere: those words are in the dump, and no
  value shown owns them. Vyper emits no ethdebug, so the page has no
  rule from Vyper; the walkthrough lists the selected player's Vyper
  words for contrast.

How to read the dump: one 32-byte word per row, byte 0 at the left;
"⋯" skips addresses.

### What is not done yet

- Mapping keys. A mapping does not list its keys. The page shows only
  keys read from the KECCAK256 inputs in a trace (the players'
  addresses, from their `join` and `play` calls; `playerList` lists them
  too). Other entries may exist but are not shown.
- Nested mappings. A mapping inside a struct or another mapping needs
  one template applied after another, with a key for each level. The
  page does not do that yet; Arcade has none.
- Vyper. Vyper emits no ethdebug. Its scene applies solc's rule to
  Vyper's storage, to show what a tool built on Solidity's rules reads;
  Vyper's own slots come from its trace.
- Names in the templates. Template and type names such as
  `t_mapping$_t_address_$…` are solc's internal names. ethdebug does
  not require them.

### Inside one play (the memory section)

Each data location is its own panel, drawn by the one location panel
(`panel.js` `renderLocation`, with `regionBytes` for every location):
the section shows a Memory panel and, at the last point, a Storage
panel for alice's record slot, each with its own header and gutter,
both lit by the same selection and walkthrough and painted the same
way (`paint`, with its popovers and cards). The calldata of the motd scene is the
same panel too: its parts are owners of calldata regions (the
selector's row, then rows of 32 bytes from byte 4), painted by `paint`.

BUG is ethdebug's teaching language, and bugc is ethdebug's reference
compiler. Arcade has a BUG port, and the section shows alice's third
hit again, paused at three points inside `play()`. At each point,
bugc's debug data lists the local variables in scope, and gives most
of them a pointer: bugc keeps them in memory. Compile it without
optimization (O0) or with it (O2): at O0, `_applyCombo` is a real call,
and its locals are in a frame whose address is in the word at 0x80; at
O2 it is inlined, so its locals are at fixed offsets, with no frame. A
local that bugc lists with its type only has no location at that
point. The byte ranges come from ethdebug's reference library
(@ethdebug/pointers), which follows bugc's pointers against the memory
at each point. Only the decoding into numbers is the page's own. The
program is compiled by bugc from ethdebug/format main (the commit is in
`fixtures/memory.json`).

The memory dump shows memory at the paused step, one 32-byte word to a
line, by offset: the words a local lives in; "⋯" marks words left out.
At the last point, alice's record slot in storage comes last. Point at
a value, a byte or an address to light it up.

- "no location at this point": bugc lists the local with its type and
  no pointer. This happens with optimization (a value the optimizer
  folded away) and without it (at O0, `hit` after its `if`).
- Inside `_applyCombo`, `mult = combo` moves `mult`: after it, bugc points
  `mult` at a word that holds `combo`'s bytes too.
- Alice's record slot is the page's own: bugc's pointer for `players`
  gives only its base slot, so the slot (keccak256 of the key and 4)
  and the packed members follow BUG's rules, which are Solidity's.

### Credits and links

Part of the ethdebug post appendix, with "ethdebug in depth"
(`../../companion/`) and "Step through a transaction"
(`../debugger/`).

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

1. The middle of the game: one point, after alice's two hits, bob's
   hit, carol's four hits and carol's miss. All three players: each
   record is one full packed slot at keccak(address . slot 3) (score,
   combo, bestCombo, plays, hits, lastBlock), the name in the next slot
   (alice's and bob's inline; carol's 34-byte name at keccak of that
   slot, over two slots); `playerList` (slot 0) at keccak(slot 0) + i;
   `motd` in slot 1; `totalScore` and `totalHits` packed in slot 2.
   `players[alice]` selected.
2. Alice plays: the middle of the game → after her third hit (combo 3,
   +30): score 30 → 60, combo, bestCombo, plays and hits 2 → 3,
   lastBlock; `totalScore` 140 → 170, `totalHits` 7 → 8.
   `players[alice]`
   selected.
3. A string moves into its slot: before and after `setMotd("gl hf")`.
   The motd was deployed with 50 bytes ("season 2 starts friday, see you
   on the leaderboard": slot 1 holds 0x65, the bytes at keccak(slot 1)
   and the next slot); after, slot 1 holds the 5 bytes and 0x0a, and
   solc has zeroed the two old data slots (shown After). `motd`
   selected. This scene also shows the calldata (below).
4. Vyper reads it differently: the same three players in Vyper's build,
   at the middle of the game (see "Vyper" below). One point.

A scene with one point has no other state: no Before | After, no "show
other state", no change marks or cards, no popover facts ("read,
written"), and its dump shows only the slots of the values on the page.
The details say "Holds" for the value. The page makes such a scene from
the fixture by using the one side's words as both sides (`atPoint()` in
`main.js`).

## Vyper

Vyper emits no ethdebug, so the page has no rule from Vyper. The Vyper
scene is the smallest honest version, and follows from the first scene:
`contracts/Arcade.vy` (Vyper 0.4.3), deployed, then the same joins and
plays to the middle of the game. The page applies solc's rule for
`players` (from Arcade.sol's ethdebug output, `players` only) to the
Vyper contract's real storage, with the three players' keys.
keccak256(key . slot 3) holds nothing for any of them (alice:
`0x9c35…aa80`), so the tree shows each with zeros and no name, with no
error: what a tool built on Solidity's rules reads. Vyper's own rule,
with `players` at slot 108 (its arrays are inline, nothing is packed),
keccak256(108 . key), puts each counter in its own slot, then the
name's length and bytes: alice at `0xb306…0446` (30, 2, 2, 2, 2, her
lastBlock, length 5, "alice"); bob at `0x87c6…f242` (10, 1, 1, 1, 1, …,
length 3, "bob"); carol at `0x51eb…c89e` (100, 0, 4, 5, 4, …, length 34,
two words of name). Those words are in the dump, named "Vyper's
keccak(slot 108, …)", and no value owns them. "How this was found" ends
with "Vyper's rule, for contrast: not from ethdebug", one step per word
of the selected player, each lighting its word. The script reads those
words from the node and checks them against the getter. How to show
this point is still to be decided.

## Calldata (the setMotd scene)

`setMotd(string calldata text)`: `text` stays in the transaction's
input. solc's ethdebug output here gives no pointer for a parameter (its
instructions carry `code` contexts only) and no calldata types or
templates, so the page cannot ask ethdebug where `text` is, and says so.
`calldata.js` shows the input like the other dumps (the selector line,
then words by offset) and labels the parts by the ABI encoding rules:
the selector, `text`'s head word (the offset, 32), its length (5) and
its bytes ("gl hf"). The linking works both ways: click a byte to select its
part, a part (or `text`) to light its bytes; its "How this was found" lists
the ABI steps, each lighting its bytes. The scene names its function
and parameter in `fixtures/index.json` (`calldata`).

## Files

The page is the app in `inspector-app/` (React + TypeScript, Vite).
Its build goes to `demos/inspector/` on the site (`inspector-app/bin/
site.sh`; the Pages workflow runs it), beside the files here. The app
reads its fixtures from here. The text below describes the page as it
was before the app took its place (tag `pre-port-2026-10`); the
behaviour is the same, the file names are the app's now.

- `decode.js`: the decoding for the fixture scripts (node).
- `vendor/pointers.js`: `@ethdebug/pointers` bundled with esbuild from
  ethdebug/format `origin/main` at commit
  `d7cb421a3` (#323: expressions take `~`, not `$`), minified, for
  `decode.js`. Rebuild with `bin/build-pointers.sh <checkout>` after
  `yarn install` and building `packages/format` and `packages/pointers`.
- The sigil: ethdebug/format writes a pointer expression's operator
  with `~` (`~keccak256`), and the library takes no other; solc still
  writes `$` (ethdebug/format#324). `decode.js` `solcTilde` rewrites
  solc's pointers and templates as each storage fixture is read
  (`bin/make-fixtures.mjs`; the app does the same). bugc writes `~`:
  `fixtures/memory.json` was made with bugc at `d7cb421a3`.
- `bin/make-fixtures.mjs`: compiles, deploys, runs the transactions,
  writes `fixtures/` (not `index.json`) and puts the contract's source
  into the app's `index.html`.
- `screenshots/`: from `inspector-app/bin/run.mjs` (`npm run check` in
  `inspector-app`; only `desktop-packed.png` is committed).
- `bug/arcade.bug`, `bin/make-memory-fixture.mjs`,
  `fixtures/memory.json`: the lower section, "Inside one play" (below).
  `bug/arcade.bug` is a copy of `private/arcade/arcade.bug`.
- `contracts/`: `Arcade.sol` and `Arcade.vy`, copied from the post's
  shared example (`private/arcade/`).
- The walkthrough oracle is retired (2026-10-08). It was
  `inspector-app/test/oracle/vanilla.json`, the vanilla page's
  walkthroughs captured step by step, compared by
  `test/e2e/oracle.spec.ts`. The Arcade renames (`roster` →
  `playerList`, `total` → `totalScore`, `rounds` → `totalHits`,
  `hitCount` → `hits`) change its captions, and the vanilla page is
  deleted, so it cannot be captured again. `bin/run.mjs` and
  `test/e2e/` check the walkthroughs.

## How the fixtures were made

1. `anvil --steps-tracing --port 8555 --silent`
2. `SOLC=<solc> VYPER=<vyper> RPC_URL=http://127.0.0.1:8555 node
   bin/make-fixtures.mjs`. `<solc>` is a
   native solc built from Walnut's fork, walnuthq/solidity PR #10 (head
   `c434b2ea`, reports `0.8.38-develop.2026.10.5+commit.c434b2ea`);
   stock solc 0.8.37 gives ethdebug types and templates but no program
   context with the state variables, which the page needs. `<vyper>` is
   Vyper 0.4.3. Without them, the script runs `solc` and `vyper` from
   your PATH. It compiles Arcade.sol with `--standard-json`, viaIR,
   optimizer off, `experimental: true`, `debug.debugInfo: ["ethdebug",
   "ast-id"]`, and outputs `ethdebug.resources` and
   `ethdebug.compilation` (together they give the global
   `ethdebug.resources`), `evm.deployedBytecode.ethdebug` (the program,
   with the program-level context), bytecode and the AST. No
   storageLayout.
3. The story, on a fresh anvil (deployer: account 0; alice, bob,
   carol: accounts 1, 2, 3): deploy with the 50-byte motd; alice, bob
   and carol join (names "alice", "bob", "carol, the unstoppable combo
   queen"); alice hits; alice hits; bob hits; carol hits four times,
   then misses (the middle of the game); alice hits (combo 3); `setMotd("gl hf")`, after a
   deploy with the motd "season 2 starts friday, see you on the
   leaderboard". A play rolls from prevrandao,
   which anvil draws at random and cannot be told, so each play is sent
   in an `evm_snapshot`; on the wrong outcome the script reverts, mines
   an empty block and sends again (as `private/arcade/tools/story.py`
   does). Hashes and block numbers differ from run to run; outcomes do
   not. Fixtures: `arcade-mid` (carol's miss: its after side is the
   middle of the game), `arcade-alice` (alice's third hit),
   `arcade-motd` (setMotd); mapping keys from the joins' and plays'
   traces.
   - Arcade.vy: deploy, the same joins and plays to the middle of the
     game (fixture `arcade-vyper`; see "Vyper").
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
wrote (at the middle of the game alice 30 / combo 2 / best 2 / plays 2
/ hits 2, bob 10 / 1 / 1 / 1 / 1, carol 100 / 0 / 4 / 5 / 4, the
names, `playerList`, totalScore 140, totalHits 7; after alice's third
hit 60 / 3 / 3 / 3 / 3, totalScore 170, totalHits 8; and the Vyper
storage values).

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
  The byte size follows the panel's width; on a phone each word is two
  lines of 16 bytes (the address once, the second line under the
  bytes), so every byte shows and nothing scrolls sideways. The details
  panel is then a sheet fixed to the bottom of the screen.
- Order and gaps: one flat list of slots by numeric address, strictly
  ascending (a mapping's records land where their hashes put them, so
  related slots may be far apart), so a run of
  hashed slots (a long string's data) reads as one block. A "⋯" gap
  line comes first (unless the first slot is slot 0, which then sits at
  the top of the box) and wherever the next slot is not the address + 1,
  and last. A gap line is tall enough for a slot popover (one line and
  its arrow); a hashed slot that starts a value right after another
  slot gets an empty line of the same height first, so its popover has
  room too.
- Gutter: only the end of the slot's address (`…0002`), right-aligned
  against the bytes like a hex dump's line labels. The one mark at rest
  is a small ring beside the address for a slot the transaction wrote
  without changing it (nothing else would show that; none of the
  current fixtures has one). Pointing at an address puts the full
  address and what the transaction did to the slot in the details
  under the dump (and in the address's `aria-label`). The page sets no
  `title` anywhere, so it shows no native tooltips.
- No names in the dump: names stay in the tree, and the two relate by
  highlighting only.
- Popover: for each run of lit slots (below), and for a run the value
  uses only in the other state, a dark label with an arrow says how
  the slots were found, what the transaction did to them ("read only",
  "written", "read, written", "written, same value", "cleared (written
  to zero)"), e.g. `keccak(0x7099…79c8, slot 3) · read, written`. It sits over the run in Before and under it in
  After, its left edge at the gutter's, its arrow on the address. Like
  a card, it may cover unlit rows (addresses included), never a lit
  row, a lit row's address or another annotation; nothing shows at
  rest. The name comes from
  the `~keccak256` defines in the replayed steps, not from new hashing.
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
  step of a replay, and the value's bytes light up
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
- Selecting a composite colours its immediate children apart, the same
  in the tree and the dump: a mapping's entries, an array's elements, a
  struct's members (a packed slot then shows its fields as bands).
  Everything under a child takes its colour. The selection colour (the
  plain highlight, `--mark`) is the selected item's own: its row, and
  its own bytes (an array's length, a long string's length word); a
  child never gets it. Eight child colours (`--pk1` … `--pk8`, light and
  dark); only a ninth child repeats one. A leaf keeps the one colour. Mapping keys show
  the key only. With a composite selected, pointing at one child (its
  row or its bytes, or keyboard focus) mutes the other children (not
  the selected item's own row and bytes) in the tree and the dump (`.muted`, 120 ms, none with reduced motion).
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
- Each section (the storage scenes, the calldata, the memory section)
  keeps its own view: its controls, clicks and Escape act on it only.
  With nothing focused, Escape clears the selection of the section the
  pointer was last pressed in. The Before | After toggle is shown only
  in a scene with two points.
- The URL hash keeps the view, e.g.
  `#ex=motd&mode=before&sel=motd&mopt=2&mpt=mult&mmode=after`
  (`insets=0` when the cards are off)
  (`ex`: the scene id: `mid`, `alice`, `motd`, `vyper`;
  `mode`: only for a scene with two points; `sel`: the tree path, empty
  when the scene's default selection was cleared, absent for the
  scene's default; `mopt`, `mpt`, `mmode`, `msel`: the lower section, which has its own keys; storage
  keys never change it). The
  format is the old one; only the `ex` values changed, and an old one
  (`token`, `strings`, `packed`, `combo`, …) is stale. It is updated with
  `history.replaceState`, only when it changes; a stale hash falls back
  to the first scene with its defaults.
  `#storage` and `#memory` link to the sections.

## The layout, the bar, the panel, and the replay

Top to bottom: the contract (collapsed), the scene picker, the scene's
intro, one line on how to read the dump, the bar, then two equal
columns that start at one height: the storage dump (left; the
calldata under it in the motd scene) and the variables (right). The
selected value's declaration is marked (its lines) in the contract's
source at the top of the page, the one source block. The tree's top padding is set so its first row and
the dump's first line share a height (`alignColumns()`).

Every group in the tree (an array, a mapping, a struct, an entry)
shows a summary at the right end of its row (`length 3`, `3 entries`,
`7 fields`) and a chevron button after it, in one column; the button
expands or collapses the group (a click on the row still selects). All
groups start open; the state is kept per scene while on the page. A
toggle animates the tree's height briefly (at once with reduced
motion); the dump never moves. Colours are a legend only where their
rows show: a collapsed selection lights its bytes all in the selection
yellow, as does a replay step whose coloured rows are hidden. A
selection or a replay step inside a collapsed group opens the path to
it. With a composite selected, its children's blocks are the targets:
a click or hover anywhere in alice's block (in the tree or the dump)
targets alice's entry; with alice selected, her members are the
blocks. With nothing selected, the most specific value is the target.

When lit tree rows are out of the tree box's view (it scrolls inside
itself), a yellow circle button, centred on the box's edge past which
they are (bottom or top), shows an arrow and no text (its aria-label
gives the first row's path and how many more); a click scrolls the
tree, inside itself, to the first of them. Hover alone never scrolls
the tree. The buttons are overlays that fade in and out: no row moves.

Where a step's formula is byte ranges within one slot (the packed
fields, a string's flag byte, `totalScore` or `totalHits`), the details draw
them as a one-line strip of 32 equal cells (no group gaps: those are
the dump's), each value a
span over its cells in its colour, named, the byte positions under it
(two rows of 16 on a phone, as the phone's dump); a name too long for
its span stands over it in a row kept for it, with a tick down to its
cells. Its aria-label gives the ranges in words.

A slot's label (a black popover) reads "how it is found : what it
holds": the names of the values in its slots as the pointer names
them, in byte order, " · " within a slot and " / " between slots
(`slot 2 : totalHits · totalScore`; `keccak(0x7099…79c8, slot 3) : lastBlock ·
… · score / name · name.length, 2 slots`); a value's other regions by
their role under its name (`name.length`; an array's own word alone,
`length`); a run of several slots in one colour, by the path of the
value they make up. A name lit now is a light badge in its colour's
text tone (the selection's yellow too); the rest are plain. The label
stays inside the dump's box; when it must be shorter, panel.js
`fitWhat` drops plain names first, then badges from the middle (each
slot keeping its first and last), then middle slots, then shortens the
"how" part's addresses; "…" marks each cut, and CSS never cuts it. A
selection inside a mapping or an array also tints the own slot of the
variable it is in (its gutter and popover; its bytes stay plain).

Nothing moves when a value is selected, pointed at or stepped through:
emphasis is lighting and muting only. The bar (`#details`) is one line
over both columns, in the page's flow (nothing on the page is sticky
or fixed for the replay): the selection in a fixed-width spot, the
controls (⏮ ◀ ▶ ⏭ and "n / m", or "Show how it was found" at rest),
the step's short caption and ✕ Exit. During a replay the details
(`#dpanel`) are joined under the bar, in its tint, as one panel with
the bar as its header row. A click, focus or key anywhere in that
panel stays in the walkthrough; only ✕ Exit or Escape leave it. A
click in the tree or the dump re-targets it: each step has an identity
(its pointer node and kind, whatever the instance), the old and new
steps are aligned by their longest common subsequence, and the
walkthrough stays on the matching step, or the nearest earlier one
that matches, or the first; a short cue in the bar ("→ step 5") says
when the place moved. At entry the page scrolls the bar to
the top while the details unfold from under it (about 280 ms, the
columns moving down with them); at exit they fold back. These are the
only movements, instant with reduced motion; while they run, the
replay takes no step. The details, at one size, each part in its own
room: the step in full (caption, formula, the pointer constructs it
uses with one footnote marker, where its input came from), the
footnote (a link to the spec page of the step's construct), the focus
picker (a mapping's replay only), the chips (one a rule, with its
storage noun), and the ethdebug data from the compiler (the pointer),
as YAML (keys in the spec's
order: a conditional's if, then, else; a region's name, location,
slot, offset, length; a line too long for the box in block style;
template names shortened, solc's ids listed under it), Shiki-coloured,
the step's lines in a band with a rule and the rest muted, the box
scrolled inside so the band's top is a third of the way down (clamped
at the ends), inset under its header, with no fade. On a phone the
same panel is compact (the caption, the formula, the picker, a few
lines of the pointer). During a replay, the bytes of a lit slot that
no value owns stay muted.

The walkthrough follows general rules, built from the raw steps that
`decode.js` `replay()` records for every value under the selection (in
the state shown), each with its place in the pointer (its block: the
variable's pointer or a template; and its path of keys). Nothing is
computed by the page but a flag byte read from the state.

1. Inputs first: facts the page supplies, not ethdebug (a mapping's
   keys, from `playerList` or the trace), with no band; the source lights.
2. Then the pointer's nodes in the YAML's document order: the band
   only moves down.
3. Every template entered is a step: its frame (name, `expect`,
   `for:`) and the inputs it takes, the bound slot's gutter.
4. The define that hands off into a nested template is a step of its
   own (its define, `in:` and `template:` lines; the computed slot's
   gutter).
5. Every region read by an expression (an array's `length`, a
   string's `length-flag`) and every `if` is a step; the `if` takes in
   the reads and defines in its branch (`long-length`, `length`);
   other defines and a list fold into the region that uses them.
   Sibling regions in one group (a record's packed fields) are one
   step.
6. Several instances (a mapping's entries, an array's items) share
   each step; where they take different branches, the `if` is one
   fork step showing both, followed by each branch's steps.

The last step, "found", shows the selection as it rests (its colours,
rows and labels), with a plain caption ("That's `players`: 3 records,
found."): with step 0, it bookends the walkthrough. It counts in
`n / N` and has its own identity for re-targeting. One constant in
`main.js`, `FOUND`, turns it off.

Carol's record: the key from `playerList[2]`; players declared at slot 3;
the mapping template takes slot = 3 and her key; her record at
keccak(key, 3) = …9978; the `Player` template; the six packed fields;
the next slot holds `name`, a string (…9979); the `string` template;
the length flag, 0x45; odd → long, length 34; the text at
keccak(…9979). `players` as a whole: the same, for all three, with the
fork (alice and bob short, carol long): 12 steps. `playerList`: 4 steps;
`motd`: 5; `totalScore`: 1; bob's `plays`: 6. In the packed-fields step the
focus entry is at full strength and the others echo it, muted; the
picker (alice, bob, carol) changes the focus and moves nothing. A row a
step has derived keeps its label (a muted popover) at later steps.

## Annotations in the dumps

Lit rows are grouped into runs (consecutive addresses; a gap ends a
run). Each run gets two annotations, which float over the neighboring
rows. They never move the rows, grow a box or add a scrollbar (on a
wide page the words column has no scroll box of its own):

- The slot popover (dark, with an arrow on the address): how the slots
  were found and what the transaction did to them, e.g.
  `keccak(0x7099…79c8, slot 3), 2 slots · read, written` (one line; a
  run of several slots says how many; the full address is in the
  details and in the replay). Over the run in Before, under it in
  After, always at the gutter (its left edge 6 px left of it, its arrow
  on the address); if that would cover lit bytes, a lit row's address
  or another annotation, the other way; if both would, it is not drawn.
  It may cover unlit rows, addresses included.
- The card (light, labeled "after" or "before"): a picture of the same
  whole words in the other state, made by cloning those rows of the
  hidden dump (addresses, tints, highlight, change marks), muted a
  little, gutter plus all 32 bytes, at the same size and in the same
  columns; its addresses sit in a tinted strip of their own. Only words
  where a lit byte differs in the other state are in a card; a run
  with none gets no card. The "after" card goes under the run in Before; the
  "before" card over it in After.
- A word the value uses only in the other state (`motd`'s old long
  data in After, zeroed by solc) is in the dump too, and gets a
  card, with no other mark.
- Fallback: a card may cover rows that are not lit (they are dimmed),
  but not lit bytes or another annotation, and it may not leave the
  content of a box that scrolls. A card that cannot be placed
  is not moved around: it goes, labeled, to a tray fixed at the bottom
  of the window, which takes no room in the page. The tray is the same
  in Before and After: if a run's card cannot be placed in one state,
  it goes to the tray in both (the page lays the hidden dump out for a
  moment to find out).

Highlights whose cards may use the tray (desktop and phone): two lit
runs with only a "⋯" line between them, where one run's popover and the
next run's card need the same space: `motd` (slot 1, then its long
data).

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
  Arcade has none.
- No calldata pointer from solc: the calldata view uses the ABI rules.

## The raw lens: one moment, bytes with no names

The post's first figure shows bytes the way tools have always had
them: no names, no colours, no popovers, no tree. The lens
`src/lenses/raw.ts` composes four bare dumps (the Dump's `display`
parameters: `bare`, `shape: "strip"`, `abbreviate`, `density:
"flow"`, `perLine`, `scale`) of one frozen moment, in three
compositions to pick from: `raw-hero` (V1: storage top left, the
stack a full-height strip on the right, memory under storage, a
corner open for a caption), `raw-spine` (V2: the stack down the left,
memory and calldata in a narrow column on the right) and
`raw-sheets` (V3: overlapping sheets). Each is a lens in the shell's
picker (`shell.html#lens=raw-hero`).

The moment (`fixtures/raw.json`, made by `bin/make-raw-fixture.mjs`):
the same build as the storage fixtures, on a fresh anvil; deploy,
alice joins, bob joins, then carol's
`join("carol, the unstoppable combo queen")`. Her name is 34 bytes,
so its text takes two words, at keccak256(her name's slot) + 0 and
+ 1. The moment is step 569 of 868: the step just after the SSTORE of
the first text word (step 568), before the second (step 627). Her
name is half in storage: its first 32 bytes are there, its last two
bytes and its length word are not yet. The instruction there is pc
2908, ADD, in solc's helper that copies a string from calldata to
storage; its source range is the whole contract (lines 4–46). The
helper is called at step 442 from line 22,
`players[msg.sender].name = name;`.

The state is the machine's as the node reports it for that step,
before its instruction runs: the stack (14 items; among them her name's
slot, the length 0x22, the loop's counters and the data slot being
written), memory (96 bytes: the hash inputs at 0x00 and 0x20, the
free-memory pointer at 0x40; the name is not in memory, because
`join` takes it as `calldata`), the call's calldata, and the
contract's whole storage then (9 slots: every slot the deployment and
the joins before wrote, with her join's SSTOREs before the step).

To make it again: `anvil --steps-tracing --port 8556 --silent`, then
`SOLC=<solc> RPC_URL=http://127.0.0.1:8556 node
bin/make-raw-fixture.mjs` (solc as for `bin/make-fixtures.mjs`).
No play is sent, so nothing is rolled: the step, the pc and the
bytes depend only on the build and the calls.
The moment is one parameter: `AT`, the step of her join to freeze
(unset: the step above). `AT=442 … node bin/make-raw-fixture.mjs`
freezes another; so does changing its default in the script.

## Inside one play: locals in memory, with BUG (bugc from ethdebug/format main)

A separate section under the storage demo shows alice's third hit
(combo 3, +30) in Arcade's BUG port, `bug/arcade.bug`, paused at three
points inside `play()`, with memory at each point and the locals bugc
lists there as a tree. bugc (ethdebug/format main, from PR #368 on)
compiles the port as written: the roll is
`keccak256(block.prevrandao, msg.sender) % 3 != 0`, as in Solidity;
`!hit`; `playerList.push(msg.sender)`; names and the motd as text. Each
instruction's `variables` context gives each local in scope, and a
pointer for those it has a location for. bugc keeps play()'s locals in
memory, at -O0 and at -O2 (it gives a stack pointer only to a value it
never stores in memory; in Arcade, only `len` in `join` and
`setMotd`).

Two pickers: Compiled (O0 | O2) and Paused (the three points). Each
point is picked by how many locals have a location there, not by line
(`bin/make-memory-fixture.mjs`):

- After the roll: the first step where `hit` has a location (`true`).
  It is the only local listed; at O0 for 11 steps, at O2 for 10.
- Inside _applyCombo: two steps, with all three of `points` (10),
  `combo` (3) and `mult` located: the last with `mult` = 5, the first with
  `mult` = 3 (around `mult = combo`). A two-step point has Show: Before |
  After and the cards, as the storage scenes with two points. At O0,
  `_applyCombo` is a real call: each local's pointer reads the frame's
  address from the word at 0x80 (region `-frame`) and adds an offset.
  At O2 it is inlined: fixed offsets, no frame. In the tree,
  `_applyCombo` holds the three; selected, its own bytes (the frame
  pointer, at O0) take the selection colour, and each local a child
  colour. After `mult = combo`, bugc points `mult` at a word that holds
  `combo`'s bytes too, so those bytes have two owners.
- Before the writes: `gained` = 30, at the last step before the SSTORE
  of `score`, and `hit` listed with no location. Alice's record slot is
  at the end of the dump, as the trace has it at that step (every
  counter but `score` written). It is the page's own: bugc's pointer
  for `players` gives only its base slot (4), so the slot,
  keccak256(alice . 4), and the six packed members (low-order bytes
  first, as Solidity) follow BUG's rules. Its members each get a child
  colour.

A one-step point shows one dump ("Memory") and no Before | After, no
cards, no change marks. A local listed with no pointer shows its type
and "no location at this point". That is not only the optimizer: at
O0, bugc also lists `hit` with no pointer after its `if`. Linking,
selecting, child colours and muting work as in the storage scenes.
The URL hash keys are `mopt`, `mpt`, `mmode` (at a two-step point)
and `msel`.

How the fixture was made:

1. A detached worktree of ethdebug/format main (at `1d45fea4c`, #368),
   `yarn install --frozen-lockfile` (it builds the packages).
2. `anvil --steps-tracing --port 8558 --silent` (without
   `--steps-tracing`, anvil returns no steps).
3. `BUGC=<worktree>/packages/bugc node bin/make-memory-fixture.mjs`
   (`RPC_URL` defaults to `http://127.0.0.1:8558`), then
   `node bin/sizes.mjs`. For -O0 and -O2, it compiles `bug/arcade.bug`,
   deploys it, plays the story to alice's third hit (each play in a
   snapshot, as `bin/make-fixtures.mjs` does), traces it with memory,
   and saves each point: the step, its instruction's locals (as bugc
   emitted them, with the source path made relative), its code range,
   and memory after the step (a context describes the state after its
   instruction). It checks the values by hand (above), the record's
   members (score 30, combo 3, bestCombo 3, plays 3, hits 3,
   lastBlock = the block), and that `playerList` holds three players.
   Hashes and blocks differ from run to run; values and steps do not.

The page dereferences each pointer with `@ethdebug/pointers` against
that point's memory (`decode.js` `decodeLocals`). "How this was found"
replays it with the library's evaluator, as for storage: the frame
pointer, if any, then the local's region.

## Loading on a slow link

What the page fetches (GitHub Pages gzips text):

| File | gzip | size |
| --- | ---: | ---: |
| `index.html` (with the loader) | 9.5 KB | 28.2 KB |
| `main.js`, `panel.js`, `decode.js`, `mem.js`, `calldata.js` | 46.3 KB | 137.1 KB |
| `style.css`, `../../shared/appendix.css` | 9.9 KB | 33.9 KB |
| `vendor/pointers.js` (minified) | 69.0 KB | 272.1 KB |
| `fixtures/index.json`, `memory.json` | 2.9 KB | 35.6 KB |
| the first scene's data (`arcade-mid.json`) | 3.3 KB | 13.8 KB |
| the other three fixtures, idle-time | 10.3 KB | 49.2 KB |
| total | 151.3 KB | 569.8 KB |
| `vendor/shiki.js`, only when the source is opened | 58.6 KB | 196.7 KB |

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
is usable at about 3.9 s, a prefetched scene shows in under 0.1 s,
and nothing moves (layout shift 0.000).


## Performance on a slow phone

`npm run perf` in `inspector-app` (`bin/perf.mjs`) builds the app,
serves it gzipped as GitHub Pages does (port 8774), and opens it in
Chromium over CDP as two readers would: low-end (6x CPU slowdown,
DevTools' "Slow 4G", 390x844) and mid (4x CPU, "Fast 4G"). For each it
prints the load (bytes per kind of file, cold and warm; first paint,
LCP, the time until the page is usable, blocking time, layout shift),
each interaction's time to the next paint (p50, p95: hovers over the
dump and the tree, selections, a walkthrough, the scenes, All |
Related, the memory section), the JS heap and the DOM. It exits 1 when
a number is over its budget (`BUDGETS` in the script). Options:
`--profiles low,mid,desktop`, `--runs N` (cold loads, the median),
`--soak S` (S seconds more of interactions, then the heap again),
`--frames N` (the blog case: N frames of the page on one page, added
one after another), `--url URL` (another page, e.g. the live one),
`--trace DIR` (Chrome traces), `--json FILE`. The CPU slowdown is
relative to the machine it runs on: 6x on an Apple-silicon laptop
(Lighthouse benchmark index about 3400) is about a budget Android
phone (index about 600). Run it on an idle machine: other work
slows the throttled page as much again.
