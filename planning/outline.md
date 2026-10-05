# Outline

Working plan for the post; [verify] marks claims still to check.

## Approach

A walk past seven exhibits, each a different demo in a different form,
so the captions alone carry the argument, and each demo appears once.
The standfirst and opening welcome the reader; each section says why
the reader cares (auditors included), glosses its terms, and states
its limits plainly. All decisions in the notes apply: solc 0.8.37
pinned (`0.8.37+commit.f401782d`); no funding plea (Argot's funder
named once, as background); no dated commitments; the contest parked
and optional; snippets use the expression sigil (the character that
starts an expression key) of the release we link to. **Exhibits are
visual by default.** Each one names a primary form (screenshot, GIF or
video, or a live embed), a fallback still, and the exact frame. Text
stays only where text is clearly better, and the exhibit says why. The
solc settings snippet and the pointer template JSON live on the
companion, not in the post; DWARF gets one line; "what ethdebug is"
is about 80 words, beside a real instruction.

Facts settled for this outline:
- Compilers: four (solc, Solar, Fe, bugc), three source languages.
- Decoders: the verified six (Remix, Truffle, hevm, sol-dbg,
  solc-typed-ast, EDB).
- Foundry: "lists local variables by name, without values; values are
  open since 2022 (#927)".
- Three independent readers, as one claim in section 5.

Markers: **[P]** = planned, no date · **[open]** = gnidan decides ·
**[verify]** = check before publishing. Every claim is a fact-sheet
row, named in *(italics)*. Blog support for iframes, GIFs, video and
`<details>` is unknown: ask Lea. Every exhibit has a still fallback.

---

## Title, standfirst, opening

**Title** (working title, last clause [open]):
> ethdebug: a shared language for debug data, in use across projects
> today

The opening backs "in use": four compilers write it, soldb reads it.
Safe fallback: "Introducing ethdebug: a shared language for debug data".

**Standfirst** (italic, ~30): *Compilers can now tell tools what their
EVM bytecode means. On Solidity today, that matches what tools already
had. It is enough to build on, and the next stages go further.*
(Carries the key sentence's ideas, as decided.)

**Opening** (~100, untitled; welcomes, does not summarize):
- ethdebug/format is an open specification for the debug data a
  compiler writes next to its EVM bytecode: what each instruction
  means in the source, and where each value lives. It does for the
  EVM what DWARF does for native code. *(README, 2022)*
- Who we are: the ethdebug team at Argot, which maintains it. This is
  its first introduction on this blog.
- Momentum, for readers who stop here: four compilers write it (solc,
  as an experimental output; Solar, a second Solidity compiler, on its
  main branch; Fe, as its only debug output; bugc, our reference
  compiler). soldb, Walnut's open-source debugger, reads it.
  *(four compilers, three languages; Fe v26.4.1; Solar 2026-09-07;
  soldb 0.4.0)*
- Who it is for: people who build tools or want to, and auditors, who
  must explain what a transaction did.

---

## Sections

### 1. Tools guess what the compiler meant, and a wrong guess looks right (~320)

- *Why you care:* a fix you write, or a finding an auditor signs,
  rests on what the tool shows. When the tool guesses wrong, nothing
  tells you.
- **Exhibit: "One slot, two answers."**
  - *Form:* a native table, three rows. Text wins here: the punchline
    is two numbers, and a table stays sharp, searchable and readable
    by screen readers in any blog.
  - *Fallback:* none needed.
  - *Frame:* Vyper 0.4.3 contract on anvil, `balances[me] = 1234` at
    slot 1. Rows: the rule; the slot (shortened `0x…`); the value read.
    Solidity's rule, keccak(key . slot): **0**. Vyper's rule,
    keccak(slot . key): **1234**. [verify: fill both slots from the
    10-05 run]
  - *Caption:* "Same contract, same key. A tool that assumes
    Solidity's rule reads an empty slot and prints 0. Nothing warns
    you."
- **Hook:** "See each rule written as data": the companion's "Another
  language's layout", where the two rules are pointers that differ in
  one line.
- Claims:
  - Both rules are valid; the fault is the tool's assumption, not
    either language. *(Vyper storage; anvil 1234 vs 0)*
  - Every tool that shows a transaction in source terms re-derives
    rules only the compiler knows. Of 20 earlier tools surveyed, six
    open-source projects each built their own Solidity decoder.
    *(20 tools; 6 decoders)*
  - Truffle's decoder alone is about 24,000 lines, written over five
    years. Disclosure, form [open]. *(`@truffle/codec` 24,195)*
  - Tenderly's via-IR docs said solc's AST and source maps force tools
    "to rely on heuristics and educated guesses", and turned expression
    evaluation off for via-IR contracts (Wayback copy, 2026-06-08).
    [open: name Tenderly] *(Tenderly quote)*
  - The common workaround, turning the optimizer off, debugs code that
    is not what runs: 81% of verified mainnet deployments are
    optimized. *(Sourcify 81%)*
  - First line [open]: the exhibit itself, or "debugging is a recurring
    problem for 33% of Solidity developers". *(Survey 2025)*
  - Bridge (~40): with ethdebug, the compiler writes the answers down,
    in a shared, specified format.
- **To the companion:** the 20-tool survey; the Vyper run (both slots,
  the 11-line stepper and 36-line storage diff, about 15 minutes).

### 2. The compiler writes the answers down; on solc they match today (~330)

- *Why you care:* you can try it today with released solc 0.8.37, and
  you lose nothing against the outputs you use now.
- **Exhibit: "One instruction, explained."**
  - *Form:* screenshot of a small static figure page. A still is
    enough: there is nothing to do, only to see the link.
  - *Fallback:* a JSON code block plus the source line in bold.
  - *Frame:* left, one instruction from 0.8.37's runtime program for
    `Calls`, about six lines of JSON (offset, operation,
    `context.code` with source id and range); right, `Calls.sol` with
    that range highlighted; under both, the classic source map entry
    for the same instruction (`s:l:f:j`). Pick an instruction inside
    `add`, not the whole-contract range. [verify: pick from 0.8.37]
  - *Caption:* "The same answer as solc's source map, as plain data:
    identical on every executed step of six transactions. A stepper
    needs 8 lines of code instead of 19."
- **Hook:** "Get this output in five minutes": the companion's "Try
  it" (settings for 0.8.37, Fe's three commands, the BUG playground
  with nothing to install).
- Claims:
  - What ethdebug is (~80): JSON schemas for a *program* per piece of
    bytecode (each instruction with *contexts*: source ranges,
    variables, calls and returns) and shared *resources* (*types*, and
    *pointers*: where each value lives and how to compute it).
    Versioned releases; each file is stamped with its schema and
    version. The format covers more than any compiler uses yet.
    *(draft.1; stamp #305)*
  - solc has written it since 0.8.29 (March 2025), as an experimental
    output: via-IR (solc's newer pipeline) only, optimizer off.
    *(0.8.29; via-IR; optimizer refused)*
  - On par for stepping: ranges identical to the source map (541 of
    542 and 965 of 966 instructions). Argot's roadmap set this goal:
    "feature parity with source maps". *(ranges; roadmap 2026-01-15)*
  - One gap, said plainly: the source map marks jumps into and out of
    functions; solc's ethdebug does not yet. *(jump kinds)*
  - Also today: Fe in three commands; BUG, our small teaching
    language, in the docs playground. One clause: BUG also previews
    what comes next (section 6). *(Fe commands; live playground)*
- **To the companion:** full settings, hosted preview builds (which
  need an open pull request, said plainly), validation results, the
  solc stages.

### 3. One ten-line script steps through Solidity and Fe (~220)

- *Why you care:* you write a reader once, not once per compiler.
- **Exhibit: "Two languages, one script."**
  - *Form:* screenshot of two terminal panes side by side, each
    running the same `node step.mjs …` command, with real output. The
    same command line in both panes shows "unchanged" at a glance.
  - *Fallback:* the same two columns as a code block (text works as
    well here; screen readers get it).
  - *Frame:* left, solc 0.8.37 `Calls.run(5)` (entering `twice`, then
    `add`); right, Fe `Counter.Bump{n:7}` (taking the `if` branch).
    About 6 lines each; prompts visible; no scrollback.
  - *Caption:* "The same script, unchanged, prints the source lines of
    a real transaction from two compilers: a 10-line core and a 2-line
    input step."
- **Hook:** "Read all ten lines": the companion's stepper, with
  `step.mjs` as copyable text and both inputs to download. (The script
  stays text there: readers copy it.)
- Claims:
  - The 2-line input step picks Fe's program out of its wrapper; one
    line each skips compiler-generated code and other source files.
    *(10 + 2 lines)*
  - About 80% of solc's executed steps carry a whole-contract range
    (compiler-generated code); one filter line skips them.
    *(77–93%)*
  - Same 22 lines on 0.8.37 and the preview build. *(diff empty)*
  - Fe steps at expression level with its optimizer on; its file needs
    a small adapter for schema validation, not for stepping.
    *(Fe -O1; Fe file not stock)*
  - The goals page names Solidity, Vyper and Fe; two of the three
    write ethdebug today. *(Vyper emits none)*
- **To the companion:** line counts, Fe's adapter, the multi-source
  limit.

### 4. The compiler states where values live; any tool follows (~280)

- *Why you care:* finding a value's bytes is the hardest part of
  reading a contract's state, and every tool re-derives it per
  compiler. For an auditor, the derivation is evidence anyone can
  check.
- **Exhibit: "How this was found."**
  - *Form:* live embed (iframe) of the storage inspector, in an embed
    view. Interaction is the point: click any value and see its
    derivation.
  - *Fallback:* screenshot `desktop-dark.png`, cropped to the tree row
    and the derivation panel.
  - *Frame:* Token, After, the sender's `nonce` selected; the panel
    shows keccak256(key, slot 0), then bytes 24–31 of that slot.
    Deep link `?embed=1#ex=token&mode=after&sel=<nonce path>`
    [verify: `sel` path form]. Keep the example picker, so a reader
    can switch to Strings.
  - *Caption:* "The hashed slot is not a guess: solc wrote the rule,
    and a generic library followed it. For all 21 variables we tested,
    the result matches solc's storage layout."
- **Hook:** "Try the Strings example": one string goes from short to
  long in one transaction, and the derivation splits at the rule's
  `if` (`#ex=strings&mode=after&sel=grows`). One template, both
  layouts.
- Claims:
  - A pointer is a small, declarative description of where a value
    lives (storage, memory, calldata, the stack and three more),
    including how to compute it (hashes, reads, arithmetic), with
    templates reused per type. *(7 locations)*
  - Two independent readers agree: `@ethdebug/pointers` decoded
    `accounts[0xf39f…]` as `{ balance: 975, nonce: 1, frozen: false }`;
    soldb's draft reader decoded the same layout. *(two evaluators)*
  - Walnut's next solc stage, on their fork (walnuthq/solidity #10),
    lists every state variable with a pointer, so no storage layout is
    needed to find the bytes; 21 of 21 match. Upstream later [P].
  - On par today: on released solc, storageLayout gives the same facts.
  - Why not DWARF, one line: no DWARF operation hashes, so mapping
    slots would need a vendor extension every debugger implements.
  - Pointers say where the bytes are, not yet what they mean; the page
    decodes values with its own small decoder, a stand-in for the
    format's planned interpretation layer (section 6).
- **To the companion:** "Pointers, in full": templates (sigil of the
  linked release: `$` in draft.1, `~` once #323 ships), walkthroughs,
  the DWARF comparison with credit to solx and Hardhat's EDR, gaps.

### 5. A real debugger already runs on it, offline, in a browser tab (~300)

- *Why you care:* you can replay and step a transaction with no node,
  and hand someone a file that lets them do the same. An auditor can
  attach it to a finding.
- **Exhibit: "State fills in as you step."**
  - *Form:* a short muted video (MP4, looped) or GIF, about 8 s.
    Motion is the point: the source span moves and state values
    change.
  - *Fallback:* a still at the last step, the state panel with its
    change marks, plus a "see it move" link.
  - *Frame:* soldb demo, Solidity tab, `Shop.place`; crop to the
    source pane and the "State from ethdebug alone" panel; from the
    entry to `place` to the writes that set `nextId 1` and `revenue
    30` [verify values]. No timing tables in frame.
  - *Caption:* "soldb, compiled to WebAssembly, steps a real
    3,736-step transaction in under a tenth of a second, and reads the
    contract's state from ethdebug alone, with no storage layout."
- **Hook:** "Step it yourself, then switch to Fe": the same debugger
  steps a Fe transaction, unchanged. Plus the 6.5 KB replay file.
  (Link the full page, not an embed: it loads WebAssembly and its tabs
  need the room.)
- Claims:
  - soldb is Walnut's open-source Solidity debugger (0.4.0). It
    replays a transaction from a 6.5 KB file with the node off, stops
    at a storage write (the same step as live), and steps backward.
    *(v0.4.0 recheck; the replay is a Token transfer, not Shop)*
  - In Chromium, Firefox, WebKit and a phone: parse, map and step in
    about 80–95 ms; offline replay with no request leaving the page.
  - With Walnut's next solc stage and soldb pull request #181, the
    state view reads every state variable through solc's pointers;
    values match with and without the layout. Reading one value by
    path still uses the layout; both pull requests are open.
  - soldb steps Fe with no change to soldb; the page adapts Fe's file
    layout, and says so. *(soldb steps Fe)*
  - Three teams wrote readers: our TypeScript packages, soldb (Rust),
    and Runtime Verification's Python reader for their Simbolik
    debugger, which does not yet read solc's output (our run,
    2026-10-05). [open: wait for Raoul's reply]
  - A proposal to put soldb behind `forge debug` is open. *(#16557)*
- **To the companion:** timings, build sizes, the 31 claims checked.

*Optional, PARKED (~160, outside the main line):* **An LLM builds a
working tool from it in minutes; today it ties.** Exhibit: a native
table (Sonnet build 3:39 / 1:58; extend 0:44 / 0:16; Opus 3:25 failed
hidden tests / 2:24 passed); text, since readers compare numbers.
Caption: "On par today. The prompt, rules and judge are published, so
anyone can re-run this. We will too, once solc emits local variables."
No date.

### 6. Next, it shows what the older outputs cannot (~330)

- *Why you care:* facts tools have long struggled to show (a call
  stack without guessing, inlined code, local variables, optimized
  builds) become data any tool can read.
- **Exhibit: "A call stack from data."**
  - *Form:* a GIF or short video, about 6 s: step into the inlined
    call and back out, so the stack grows and shrinks.
  - *Fallback:* a still at the inlined `ADD`.
  - *Frame:* the docs site's trace playground, the `weight`/`dbl`
    program at optimization level 2, trace drawer open; crop to the
    call stack (`weight(i: 0, n: 4) › dbl()`, `dbl` marked inline) and
    the highlighted `x + x`. [verify: is this program a preset?]
  - *Caption:* "The call stack comes from the compiler's call and
    return markers, not from guessing at jumps, and inlined code still
    names its call. Shown in BUG, our teaching language: a preview of
    the format, not of any compiler's plans."
- **Hook:** "Change the program and recompile it in the page": raise
  the optimization level and watch the inlined code keep its link.
  (Link; an embed needs the docs-site work below.)
- Claims:
  - bugc writes call and return markers and marks inlined code
    (`transform: ["inline"]`); at level 2 it inlines `dbl` (85 to 33
    instructions) and the `ADD` still points to its call and body; all
    tested. No variable values here. bugc is not a production
    compiler. One clause: this is ethdebug's own reference debugger;
    soldb tracks what solc emits today.
  - Next for solc [P, no dates]: every state variable as data (built,
    works on Walnut's fork); local variables (designed, no pull
    request); optimized code (deferred). Call markers are in no plan
    we found.
  - Why locals matter: Foundry's debugger lists them by name without
    values; values are open since 2022 (#927).
  - Next for the format (~60): what the bytes mean (signed or not,
    scale, byte order, field names): the type schema rewrite (#282),
    right after this release [P]. Until then, no tool shows values
    from ethdebug the same way for every compiler.
  - Optimized code: the format has contexts for inlined and shared
    code; Solar writes ethdebug with its optimizer on and identical
    bytecode; Fe steps optimized code.
  - Fe's compiler models more than it exports (variables, inlining);
    exporting it is the Fe team's call.
- **To the companion:** "Optimized code": the `ADD`'s contexts as JSON;
  Solar and Fe details.

### 7. Where it stands today, stated plainly (~250)

- *Why you care:* you can decide what to build on now, and what to
  wait for. An auditor learns which contracts this covers.
- **Exhibit: "Where each compiler stands."**
  - *Form:* a native table. Text wins: readers scan it as reference,
    and it must stay exact when facts change before publishing.
  - *Fallback:* none needed.
  - *Frame* (no dates; "as of October 2026"):

    | compiler | source ranges | state variables | calls | optimized | locals |
    |---|---|---|---|---|---|
    | solc 0.8.37 | yes | via storageLayout | no | no | no |
    | solc, open PR #16990 | yes | partly: templates | no | no | no |
    | solc, Walnut's fork #10 | yes | yes | no | no | no |
    | Solar (main, unreleased) | yes | no | partly | yes | no |
    | Fe 26.4.1 | yes | no | no [verify] | yes | no |
    | bugc (reference) | yes | yes | yes | yes | open PR #270 |

  - *Caption:* "On par today, filling in stage by stage. On mainnet,
    solc's output matches only via-IR builds with the optimizer off:
    about 0.1% of verified contracts."
- **Hook:** "One mainnet contract, recompiled": the companion's mainnet
  section (LaunchList: code and metadata match; an 829-step
  transaction mapped on every step).
- Claims:
  - About 0.1% can match today; one real contract matched exactly.
  - Meanwhile, a debugger can recompile from the inputs Sourcify
    stores; tools that add ethdebug to existing solc output are in
    progress. [open: name Runtime Verification's annotator]
  - The format moves as implementers arrive: first coordinated release
    September 2026; draft.1 requires a stamp, and Walnut's fork wrote
    it within days (the post's demos add it to released solc's and
    Solar's output, said plainly); four bugs this work found in our
    packages, each fixed within days (#314–#317).
  - Changes ahead: the `~` sigil (#310, #323, no `$` alias) and the
    type rewrite (#282); the changelog says who has to act.
  - Blemishes: solc marks every instruction with source id 0, even
    imported code; Fe needs an adapter; no bit-level addressing.
- **To the companion:** per-compiler status, mainnet details, how the
  format changes.

---

## Close: pick one guess, and replace it with data (~130)

- Pick one thing your tool guesses today, replace the guess with data
  the compiler wrote down, and tell us what you built.
- Links: the specification, the npm packages, soldb, the Matrix chat,
  the companion page.
- Background, one line: Argot, funded by the Ethereum Foundation,
  maintains ethdebug. No request of any kind.
- Thanks, with consent: Walnut, the Fe team, Runtime Verification,
  Paradigm's Solar team.

**Word total:** 30 + 100 + 320 + 330 + 220 + 280 + 300 + 330 + 250 +
130 = **~2,290**; with the optional contest, **~2,450**. Captions count
inside their sections; tables do not count as prose.

---

## Companion, restructured

The post's deep end, in the post's order. Each section opens with the
post's exhibit at full size (the live embed itself where the post has
a still), then "Try it", then details. Hooks land at section tops.

1. **Wrong guesses:** the Vyper run, both rules as pointers; the
   20-tool survey.
2. **Try it:** settings for 0.8.37 and the hosted preview builds; Fe's
   three commands; the BUG playground; parity numbers; validation.
3. **Ten lines, two languages:** `step.mjs` as text, both inputs.
4. **Pointers, in full:** the inspector, full page; placement,
   interpretation, resolution; solc's templates; the DWARF comparison;
   gaps.
5. **soldb:** the demo; the replay file; Fe; claims checked.
6. *(Parked)* **The challenge:** prompt, rules, judge, every run.
7. **What comes next:** optimized-code contexts, the BUG preview,
   Solar and Fe.
8. **Appendix:** compiler status, mainnet, measurements.

Before this, fix the companion's stale spots (fact sheet, "Stale in the
public repo": the stamp, #5 vs #10, Foundry #410/#927, solx).

---

## Demo work this needs

1. **Inspector embed view** (§4): `?embed=1` hides the page header,
   prose and memory section; keeps the picker, tree, dump and
   derivation panel; fits ~600 px high; confirm the `sel` path for the
   sender's nonce. *Small, ~half a day.*
2. **soldb demo URL state and capture** (§5): `#ds=sol|fe&step=N` deep
   links, an `?embed=1` view (source pane and state panel only), and a
   Playwright script that records the clip and the still. *Small to
   medium, ~1 day.*
3. **"One instruction" figure page** (§2): a static page from 0.8.37
   output for `Calls`: JSON, highlighted source, source map entry.
   Seed it from the soldb page's highlighter (the planned generic range
   highlighter). *Small, ~half a day.*
4. **Trace playground capture** (§6): a Playwright script that loads
   the `weight`/`dbl` program at level 2 and records the clip and the
   still. *Small.* For a live embed later: URL state (program, level,
   step) on the docs site, an ethdebug/format pull request. *Medium;
   optional.*
5. **Terminal screenshot** (§3): render both `step.mjs` runs as two
   panes (a small HTML page, captured). *Small, ~1 hour.*
6. **One stills script** for every fallback, at 2x and in light and
   dark, re-run before publishing. *Small.*
7. **Publish the demos at public URLs** (GitHub Pages) and check that
   Argot's site allows frames from them (ask Lea). *Small.*

---

## Skimmer test

Read only the title, standfirst, opening and captions:

- **Title / standfirst:** a shared language for debug data; compilers
  tell tools what bytecode means; on par on Solidity today, more next.
- **Opening:** an open spec, like DWARF; four compilers write it,
  soldb reads it; from Argot; for tool builders and auditors.
- **1:** a tool that assumes Solidity's rule prints 0, and nothing
  warns you.
- **2:** the same answer as solc's source map, as plain data; 8 lines
  instead of 19.
- **3:** the same script, unchanged, reads two compilers.
- **4:** the hashed slot is not a guess; 21 of 21 match.
- **5:** soldb steps 3,736 steps in under a tenth of a second, with
  state from ethdebug alone.
- **6:** a call stack from markers, inlined code still named; a BUG
  preview, not a compiler's plan.
- **7:** on par today; about 0.1% of mainnet matches.

**Does it hold?** Yes: problem (1), on par (2), shared (3, 4), real
(5), better (6), limits (7). A skimmer who sees only the stills still
gets each point, because every caption states it. Weak spots: "on par"
comes before "why switch", so captions 3 and 4 must carry "one reader,
no guessing"; caption 6 must name BUG, or it reads as a solc claim.
