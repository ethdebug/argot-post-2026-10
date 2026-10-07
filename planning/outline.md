# Outline

Working plan for the post; [verify] marks claims still to check.

**Structure:** get it, read it, build on it, covering all four goals
from the ethdebug docs' goals page.

**Framing,** quoted from that goals page: *"Reading the blockchain
shouldn't require manually working backwards through those layers"*
(the layers are optimization and compilation).

**Lens:** on par today, and improving.

**Exhibits and hooks:** each section carries one exhibit (a picture
or a few lines, with the punchline in the caption) for the casual
reader, and one hook (something to do on a demo or the matching
companion section) for the technical reader.

**Written for people:** each section opens with why the reader should
care, then shows the proof. Numbers only where they persuade; the rest
goes to the companion page. Short sentences, plain words.

**Key:** **[verify]** = verify before publishing · **[P]** = planned work;
no dates given · (~N) = prose word budget

---

- **Standfirst** (one line, italic, under the title): what the post
  is about, in plain words. It carries the main claim: compilers now
  tell tools what their bytecode means. It also says what you can
  build on it today, and what comes next.
- **Opening** (~90, untitled, before section 1): the reader's first
  paragraph. It introduces ethdebug; it does not summarize the post.
  - What ethdebug is, in one line: an open specification for the debug
    data a compiler writes next to its EVM bytecode (what each
    instruction means in the source, and where each value lives). It
    does for the EVM what DWARF does for native code.
  - Who we are: the ethdebug team at Argot maintains it. This is its
    first introduction on this blog.
  - Adoption, for readers who stop here: three compilers write it
    today (solc experimentally, Fe, and Solar on its main branch).
    Independent tools already read it (Walnut's debugger, soldb).
  - Who the post is for: anyone who builds tools, or wants to, and
    auditors, who must explain what a transaction did.

1. **Tools have always worked backwards** (~400, incl. "What ethdebug
   is")
   - *Why you care:* every tool that shows you a transaction in
     Solidity terms guesses what the compiler meant. When it guesses
     wrong, it does not tell you. For an auditor, that is a wrong
     conclusion in a finding.
   - **Exhibit:** one slot, two answers. A real Vyper contract holds a
     balance of 1234; Solidity's rule reads another slot and prints 0.
     Three-row table; caption states the 0. **Hook:** the storage
     inspector, where the compiler's own rule is visible.
   - What a tool guesses: where each variable lives in storage, and
     which bytes came from which source line. The answers change with
     every compiler and version.
   - A wrong guess looks like a correct one. Vyper (another contract
     language) builds mapping slots in the opposite order from
     Solidity. Both rules are valid. A tool that assumes Solidity's
     rule reads the wrong slot and prints a plausible number (0, from an
     empty slot; shown on anvil). The fault is the tool's assumption,
     not either language.
   - So every team built its own decoder: Remix, Truffle, hevm,
     Tenderly, Foundry. Truffle's decoder is about 24,000 lines,
     written over five years. *(Disclose it in one of two forms,
     an open choice: within "we", "we know this first-hand: one of us
     architected the Truffle Debugger and led the design of its
     decoder"; or third person, "the ethdebug lead architected the
     Truffle Debugger and designed the interfaces of its decoder".)*
   - These decoders hit limits. Tenderly's via-IR docs page said
     solc's AST and source maps force tools "to rely on heuristics and
     educated guesses" (Wayback copy, 2026-06-08).
   - The common workaround is to turn the optimizer off. Then you
     debug code that is not the code that runs on chain.
   - With ethdebug, the compiler writes the answers down, in a shared,
     specified format.
   - **What ethdebug is** (~100 words; first introduction on this
     blog): a specification, as JSON schemas, for the debug data a
     compiler writes next to the bytecode:
     - a *program* for each piece of bytecode: its instructions, each
       with *contexts* that say what the instruction means in the
       source (source ranges, variables, function calls and returns,
       ...);
     - shared *resources*: *types* (what the program's values are) and
       *pointers* (where each value lives, and how to compute it);
     - versioned and validated by its schemas, so compilers and tools
       can check each other. Today's compilers emit parts of it (see
       below). The format covers more than any one compiler uses yet.

2. **You can get the data today, from three compilers** (~350)
   - *Why you care:* three compilers emit the data today. No new
     tools are needed to get it.
   - **Exhibit:** one instruction, explained: about six lines of solc
     0.8.37 output (offset, opcode, its source range) next to the
     highlighted source line. The settings snippet moves to the companion
     or a collapsible block. **Hook:** the companion's settings and the
     hosted builds.
   - It answers a common question on Ethereum StackExchange: "what is
     in this storage slot?"
   - **Solidity:** a short solc settings snippet. A second Solidity
     compiler, Solar (by Paradigm), also emits it on its main branch
     (unreleased). Pin solc 0.8.37; the same settings work on its
     development branch.
     - Source ranges for nearly every instruction: in released solc
       0.8.37.
     - Storage layouts: a solc build from an open pull request by
       Walnut (the team building solc's ethdebug support),
       argotorg/solidity #16990. We link it.
   - **Fe** (a separate contract language): three commands. ethdebug is
     Fe's only debug output.
   - **BUG** (our small teaching language): the playground on the
     ethdebug docs site, with nothing to install. bugc, its compiler,
     is our reference implementation. One clause says that BUG also
     previews what comes next (section 7).
   - solc adds support in steps, one pull request at a time. Source
     ranges are released. Storage is in an open pull request. Every
     state variable is written **[P]**. Local variables are designed
     **[P]**.

3. **Ten lines of code step through Solidity and Fe alike** (~300)
   - *Why you care:* one small piece of code works across languages.
     You do not write a new decoder for each compiler.
   - **Exhibit:** the soldb demo stepping `Shop.place` in Solidity, then
     the same page in Fe (a GIF, or two screenshots); step.mjs stays as
     code. **Hook:** "step it yourself" on the soldb demo.
   - The snippet: for each step of a transaction, look up the source
     range the compiler recorded and print that line.
   - Tested 10-03: one script, unchanged, steps through a real solc
     transaction and a real Fe transaction. The core is 10 lines. A
     2-line input step picks Fe's program out of its wrapper. A
     one-line check skips Fe's standard-library sources.
   - Real output from both languages, side by side.
   - Notes, briefly:
     - On solc, this gives the same result as the older source map, in
       a simpler shape (8 lines of code instead of 19).
     - Most solc steps point at the whole contract (compiler-generated
       code), so the stepper skips them with one line. Fe already
       labels that code.
     - Fe's file wraps its program differently today. The two-line
       input step handles it; stepping needs no adapter.
   - The goals page names Solidity, Vyper and Fe. Two work today.

4. **Pointers: the compiler states the rule, and any tool applies it**
   (~220)
   *(Own section for now. Later, it can be cut and folded into section
   3 as one paragraph.)*
   - *Why you care:* finding where each value lives is the hardest
     part of reading a contract's state. With pointers, tools no longer
     re-derive it for every compiler.
   - **Exhibit:** the inspector's "How this was found" for
     `accounts[sender].nonce`: keccak256(key, slot 0) = `0x7230…a722`,
     then bytes 24–31. A second option: the Strings example, one variable
     in two layouts, both found by one rule. **Hook:** "click any value
     to see its derivation" in the inspector.
   - This is the plainest evidence for the post's main claim: the
     compiler states the layout it intended, and tools only apply it.
   - A pointer is a small, declarative description of where a value
     lives (storage, memory, calldata, the stack, and so on), including
     how to compute the location. So far, solc uses pointers for
     storage. Walnut's next-stage branch also emits `code` pointers for
     immutables. Memory, calldata and the stack come with local
     variables **[P]**.
   - The example: solc's real mapping template (from Walnut's #16990
     build). The slot is the keccak256 hash of the key and the base
     slot. Then the struct's own layout applies. Our
     `@ethdebug/pointers` package and soldb's draft reader both decode
     it. Show the snippet, about six lines. **[verify: snippets must
     use the expression sigil of the release we link to (`$` today;
     `~` if ethdebug/format issue #310 lands first)]**
   - One evaluator works for every compiler. A compiler with different
     rules describes its own layout, and tools do not change. For
     example, once Vyper emits ethdebug, its different mapping order is
     only a different pointer.
   - This answers "why not DWARF, storageLayout or source maps?". Each
     of those gives one kind of fact; a pointer gives the rule. One
     line here; the full comparison goes on the companion page.
   - Pointers say where a value's bytes are. They do not yet say what
     the bytes mean (signed or not, field names, and so on). That is
     the format's next piece (section 7).
   - On par today: for solc's storage, storageLayout gives the same
     facts. Pointers give more when they cover every variable, and then
     local variables in memory and on the stack **[P]**.
   - Walnut's next stage (walnuthq/solidity #10, open on their fork)
     lists every state variable with its pointer, so no storageLayout
     is needed. Its slots and offsets match storageLayout for all 21
     variables we tested. The storage inspector uses it.
   - Gaps today: no bit-level addressing. Nested mappings need
     chaining by hand. Value types get no template yet. Released solc
     still needs storageLayout for base slots.

5. **An LLM builds a working tool from it in minutes** (~250, plus
   appendix)
   - *Why you care:* an LLM can build a tool on this data, and the
     specification lets you check that tool.
   - The task: a command-line tool that shows each storage value a
     transaction changed, by its Solidity name, from public material
     only.
   - Claude Sonnet built one that passed our hidden tests in under four
     minutes, and extended it in under a minute. (A second model's tool
     failed our hidden tests; we report every run.)
   - Without ethdebug, using solc's older outputs, the model was as
     fast. For storage on solc, those outputs carry the same
     information. Today, ethdebug ties.
   - Why it still matters: with a specification, schemas and an
     automatic judge, you can check an LLM-built tool. This matters
     because 45% of Solidity developers distrust AI output (Solidity
     Developer Survey 2025).
   - Where ethdebug gives more **[P]**: once solc emits every state
     variable, the tool needs no Solidity storage rules. Once solc
     emits local variables, the older outputs have nothing to offer.
   - So we publish the contest now: "The prompt, rules and judge are
     published, so anyone can re-run this. We will too, once solc emits
     local variables." We give no date; the re-run follows the
     milestone. The contest measures time, how many compiler rules the
     tool has to hardcode, and how much changes per new language.
     *(Full design in the appendix, outside the word budget.)*

6. **A real debugger already runs on it, offline, in your browser**
   (~270)
   - *Why you care:* you can replay and step through a transaction
     without a node. You can send someone a file that lets them do the
     same.
   - **Exhibit:** a GIF of soldb stepping `Shop.place` while its state
     panel fills in (`nextId 1`, `revenue 30`), from ethdebug alone.
     **Hook:** "step it yourself", and the 6.5 KB replay file an auditor
     can attach to a finding.
   - soldb is the open-source debugger Walnut built on ethdebug. Its
     command-line tool steps backward and stops when the program writes
     to a storage slot.
     Its WebAssembly build runs in the browser and steps through a real
     transaction in under a tenth of a second.
   - Its replay file is a few kilobytes. Attach it to an audit finding,
     and anyone can step through it, and see the contract's state at
     each step (next bullet).
   - With Walnut's next solc stage, soldb shows the contract's state
     from ethdebug alone: every state variable through solc's pointers,
     immutables from the deployed code, no storage layout. The values
     match the storage-layout reader exactly, in the command line and
     in the browser. (Reading one value by path still uses the layout;
     soldb pull request #181 is a draft.) The demo shows the state
     panel. So "on par with storageLayout" holds in a real debugger,
     not only in the format.
   - The same demo switches to Fe: soldb, unchanged, steps through a
     Fe transaction too, because both compilers emit ethdebug. The page
     only adapts Fe's file layout, and says so.
   - Three independent teams have written readers for the format: our
     TypeScript packages, soldb (Rust), and Runtime Verification's
     Python reader, used by their Simbolik debugger (ethdebug.py's
     README says so). Two of them read solc's output today;
     ethdebug.py does not yet (our run, 2026-10-05).
   - Link the storage inspector, with one clause: the page decodes
     values itself, a stand-in for the format's planned interpretation
     layer.
   - The limit: with solc today, this works only for contracts
     compiled with via-IR and with the optimizer off. That is about
     0.1% of what is on mainnet. Fe and Solar already handle optimized
     code; solc's optimizer support comes later **[P]**.

7. **Today it matches the old outputs; next, it goes where they can't**
   (~480)
   - *Why you care:* facts that tools have long struggled to show you,
     like local variables in optimized code, become data that any tool
     can read.
   - **Exhibit:** the BUG trace playground: a call stack from
     `invoke`/`return`, and an inlined `ADD` still naming `dbl(src)`.
     **Hook:** the BUG playground, editable in the browser.
     **Known:** exact for real calls since #349.
   - Next for solc **[P]**:
     - every state variable as data: the compiler gives each
       variable's location (open on Walnut's fork, walnuthq/solidity
       #10; we built it, and soldb reads state through it)
     - local variables: Foundry's debugger lists them by name without
       values; that request has been open since 2022
       (foundry-rs/foundry #927)
     - optimized code: 81% of verified mainnet deployments are
       optimized
   - **Next for the format: what the bytes mean** (~60): to show a
     value, a tool needs two things. It needs where the bytes are
     (pointers, from compilers). It needs what they mean (signed or
     not, scale, byte order, field names). The second part is the type
     schema rewrite (ethdebug/format issue #282), right after this
     release **[P]**. Until then, no tool can show values from ethdebug
     in a way that works for every compiler. Demos decode values with
     their own code.
   - **The format is ready for optimized code; solc is catching up**
     (~110): most mainnet contracts are optimized (81% of verified
     deployments). Debuggers have asked you to turn the optimizer off,
     because inlining and shared code cut the link to the source.
     ethdebug's instructions can say "I came from an inlined function"
     (`transform`), "I map to two places" (`gather`), or "I'm shared by
     several callers" (`pick`). Solar and Fe emit ethdebug for
     optimized builds today. Gaps: values in optimized code
     (ethdebug/format issue #291), and no production compiler emits
     local variables yet.
     - **Under optimization, debug data may lose precision but never
       accuracy** (~30). A range may gather several statements, and a
       folded variable may have a type but no location; a pointer
       never reads the wrong bytes. Evidence: bugc's optimizer gathers
       ranges and never drops one; in its local variables
       (ethdebug/format pull request #328, merged 2026-10-06), a folded
       local has no pointer, and tests at every level check each
       pointer against the program's real values; a missing value is
       now a compile error (#327, merged).
   - **Contracts already on chain: backfilling** (~70): this answers
     the reader's question after section 6's "about 0.1% of mainnet":
     what about contracts that older compilers built? ethdebug does not
     have to wait for every compiler to emit it. A backfill tool can
     generate it from what older compiler versions already write
     (source maps, storageLayout, the AST), so tools can adopt one
     format for old and new code. Runtime Verification is building one
     for solc, as a work in progress (ethdebug.py pull request #15,
     open); like solc's own output, it needs the optimizer off. Present
     it as a direction with an early example, not as working today:
     their reader does not yet read solc's output (our run,
     2026-10-05). A debugger can also recompile a verified contract
     from the compiler input that Sourcify stores.
   - **BUG already shows what this looks like** (~110): a preview of
     Solidity debugging after solc's next stages, for functions and
     optimization.
     - bugc, our reference compiler, gives a real call stack from its
       `invoke` and `return` markers. It does not guess from jump
       markers.
     - It marks inlined code `transform: ["inline"]`, still linked to
       its call. The inlined `ADD` still says it is `x + x` in `dbl`,
       called from `dbl(src)`. All of this is tested.
     - **BUG now shows what variables look like in optimized code:
       each local is located where its value lives, or listed by type
       where the optimizer folded it.** Evidence: since
       ethdebug/format pull request #328 (merged 2026-10-06), bugc
       lists its local variables at every optimization level, O0 to
       O3. A pointer names the exact bytes in memory or on the stack,
       and an inlined function's locals appear in its inlined code.
       Tests read every listed pointer against the real machine state
       at every step, and the tracking does not change the bytecode.
       This is "precision, not accuracy" in practice. It shows where
       the bytes are, not what they mean: no variable values.
     - BUG is a small teaching language and bugc is not a production
       compiler. So this previews the format, not any compiler's
       plans.
     - Link: ethdebug's own reference debugger, the docs site's trace
       playground. One clause says that soldb tracks what solc emits
       today. (Checked 10-04: the live viewer shows
       `weight(i: 0, n: 4) › dbl()`, marked inline.)
   - Fe's compiler already has more information than it exports
     (variables, inlining). Whether to export it is the Fe team's
     decision. With it, Fe could give the call stack and inlining with
     no format change.
   - The format changes as more people implement it. This work found
     four bugs in our own packages, and each was fixed within days.
     Every change is logged with who has to act on it.
   - When solc emits local variables, we re-run the published contest
     unchanged. Anyone can run it before then.

- **Close: pick one guess, and replace it with data** (~150)
  - Pick one thing your tool guesses today, and replace the guess with
    data the compiler wrote down. Then tell us what you built.
  - Links: the specification, the packages, the Matrix chat, the
    companion page.
  - Who "we" are, said once: the ethdebug team at Argot (the
    collective, funded by the Ethereum Foundation, that runs ethdebug,
    Solidity and Fe).
  - Thanks to the outside teams: Walnut, the Fe team, Runtime
    Verification, and Paradigm's Solar team.

---

**Hook options** for the first line of section 1:
- (a) The Solidity Developer Survey 2025: 33% of developers name
  debugging as a recurring problem, at every level of experience.
- (b) Tenderly's via-IR docs page: solc's AST and source maps force
  tools "to rely on heuristics and educated guesses"; "Evaluate
  Expression is disabled for IR-compiled contracts" (Wayback copy,
  2026-06-08).
- (c) The Vyper example: a tool built on one compiler's assumptions
  reads another's storage wrong and prints a plausible number.

**Moved to the companion page:** exact timings and build sizes, the
per-model challenge table, the solc pull-request stages in detail, the
mainnet check, Fe's adapter details, the format changes ahead (`~`,
types, modifiers).

**Open:** follow the post's own order, or the goals page's order
(universal format, real-life debugging, adoption, understanding
deployed code)?
