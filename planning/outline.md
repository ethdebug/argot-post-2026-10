# Outline

Working plan for the post; [verify] marks claims still to check.

**Structure** (decided 2026-10-13, from Lea's notes): the landscape,
the problem, what changed this year, ethdebug pointers, what comes
next, build on it, and a call to action. The figures stay in their
current order and sections.

**Framing,** quoted from the ethdebug docs' goals page: *"Reading the
blockchain shouldn't require manually working backwards through those
layers"* (the layers are optimization and compilation).

**Lens:** on par today, and improving. §2 gives the dated progress so
far; §4 looks ahead.

**Figures:** each post figure is its own scene, named by its job in
the post. The figure carries the explanation; the prose around it
stays short.

**Written for people:** each section opens with why the reader should
care, then shows the proof. Numbers only where they persuade; the rest
goes to the companion page. Short sentences, plain words. Name the
format's objects as "ethdebug programs", "ethdebug pointers" and
"ethdebug context".

**Length:** about 2,100 to 2,300 words of prose (decided 10-13).

**Key:** **[verify]** = verify before publishing · **[P]** = planned work;
no dates given · **[open]** = not decided · (~N) = prose word budget

---

- **Standfirst** (one italic line, under the title): compilers can now
  better explain their bytecode to tools; what that looks like today,
  how to build on it, and what comes next.
- **Intro** (~200, untitled, before §1)
  - What ethdebug is, in one line: an open specification for the debug
    data a compiler writes next to its EVM bytecode. Like DWARF for
    native code, designed for smart contract languages. An Argot
    Collective project; its first introduction on this blog.
  - Adoption: solc, Fe and Solar write ethdebug data; Walnut's soldb
    reads it, and Runtime Verification's Simbolik uses it internally.
  - **The landscape** (decided 10-13, Lea's ask; two or three concrete
    sentences):
    - AI writes tools fast, and ethdebug output lets LLMs build tools
      quickly. Our LLM test tied on speed against solc's older
      outputs, so say nothing that implies ethdebug made the LLM
      faster. What the data adds: the result is checkable.
    - Security needs claims you can check. In the Solidity Developer
      Survey 2025, 88% of developers use AI at least monthly, and 45%
      distrust its output.
  - The point: tools can stop guessing what the compiler meant.

1. **Tools have always worked backwards** (~600)
   - *Why you care:* every tool that shows you a transaction in source
     terms guesses what the compiler meant. When it guesses wrong,
     nothing warns it, and the wrong answer looks right.
   - The compiler serves two sides: readable abstractions for people,
     cheap machine code for the EVM. With modern optimizers, the raw
     machine state is hard to read, even for experts.
   - People have always needed to see through it: before, during and
     after a security incident. In the Solidity Developer Survey 2025,
     a third of developers name debugging a recurring problem, at
     every level of experience. "ethdebug is where that work is going"
     (our own claim; "the Solidity team prioritized ethdebug" needs
     Lea's source **[open]**).
   - Compilers give tools enough to succeed only with guesswork: rules
     learned by watching the compiler, special cases per version.
     Tenderly, in its own documentation (archived via-IR page,
     Wayback copy of 2026-06-08): solc's AST and source maps "can hold
     only some of the data needed to write a quality debugger".
     Tenderly is not an ethdebug user; we hope it will fund future solc
     work for ethdebug, so quote it respectfully. Lea gives Tenderly
     advance notice.
   - **Figure `reveal`:** the game's storage as a tool sees it, then as
     the compiler's data describes it.
   - The guessing never ends: compilers change, optimizers make rules
     unpredictable, and old contracts live forever. Tools fall behind.
   - A wrong guess looks like a right one. Nesting (a record in a
     mapping) becomes a hash and packed fields.
   - **Figure `pitfall-nesting`:** Alice's record, six fields packed
     into one slot, her name in the next.
   - Each language needs the rules again. Vyper hashes slot then key
     and reserves full capacity, so `players` is at slot 108, not 3. A
     tool with Solidity's rule reads an empty slot and reports a score
     of 0. The fault is the tool's assumption, not either language.
   - **Figure `pitfall-compiler`:** the same Vyper storage read two
     ways: 0, then the real 30.
   - With ethdebug, the compiler writes the rule down, and a tool
     follows it without knowing the language. The Vyper side of the
     figure works that way, from hand-written ethdebug data.
   - Finding the bytes is half the job; what they mean is the format's
     type schemas, being reworked (ethdebug/format issue #282) **[P]**.
     Until then, the figures decode values with their own code.

2. **What changed this year** (~550; decided 10-13; it replaces "Three
   compilers produce ethdebug data today")
   - *Why you care:* ethdebug is no longer a design. Compilers write
     it, a real debugger reads it, and the format ships versioned
     releases. This section gives progress as much visible space as
     the problem.
   - Opens from gnidan's Solidity Summit 2025 talk ("ethdebug format
     overview (2025)", https://youtu.be/KKvkXFv-GXM) as the last full
     update. **[verify: the talk was at Devconnect Buenos Aires,
     announced for 2025-11-18; 2025-12-04 is the recap post's date]**
   - Dated progress since then:
     - **The format:** 0.1.0-draft.0 (2026-09-21), draft.1
       (2026-10-03, the stamp required) and draft.2 (2026-10-07, the
       `~` sigil). The changelog says, for each change, whether
       compilers and tools must act ("required", "optional", "no change
       needed").
     - **solc:** source ranges are in released solc, the same
       information as its older source maps, in a simpler shape.
       Walnut (the team building solc's support) adds the rest in
       stages, in public pull requests: storage pointers are in review
       (argotorg/solidity #16990); every state variable works on
       Walnut's fork (walnuthq/solidity #5, #7 to #10). The post's
       figures use a preview build, and say so.
     - **Limits, stated plainly:** solc writes ethdebug behind an
       experimental flag, only for via-IR builds with the optimizer
       off: about 0.1% of verified mainnet contracts.
     - **Fe and Solar:** Fe (a separate contract language, another
       Argot project) writes ethdebug as its only debug output, with
       the optimizer on. Solar (a second Solidity compiler, from
       Paradigm) writes it on its main branch, optimizer on, with the
       same bytecode with or without the debug data.
     - **soldb:** Walnut's debugger, written for Solidity, steps a Fe
       contract too, unchanged, because it reads ethdebug.
     - **Implementers:** the work found four bugs in our packages; each
       was fixed within days.
   - **Figure `real-debugger`:** soldb in the page, on one game
     transaction compiled from Solidity and from Fe.
   - Ends briefly on what soldb reads: ethdebug programs (one per piece
     of bytecode; one entry per instruction, with its offset, its
     operation and its ethdebug context). The context says what holds
     once the instruction has run. The simplest kind is a source range;
     others describe variables, calls, and code the optimizer moved.
   - **Figure `program-xray`:** part of `play()` as solc and Fe each
     wrote it.
   - Bridge: the harder part is where each value lives.

3. **ethdebug pointers: the compiler states the rule, and any tool
   applies it** (~200; trimmed, decided 10-13)
   - *Why you care:* finding where each value lives is the hardest part
     of reading a contract's state; with ethdebug pointers, tools stop
     re-deriving it for each compiler.
   - An ethdebug pointer is a recipe: a location (storage, memory, the
     stack, ...) and positions computed from what is already there.
     Common shapes are templates, written once.
   - **Figure `pointer-walkthrough`:** the pointer for `players`, step
     by step. The figure carries the explanation.
   - The figure ran on `@ethdebug/pointers`, which knows nothing of
     the game or of Solidity. For Vyper, only the pointer differs; the
     tool doesn't. **[verify: any pointer snippet shown uses the sigil
     of the release we link to: `~` since draft.2; solc writes `$`]**

4. **Next: variables in optimized code** (~350; heading decided 10-13;
   "Today, the format is real" is cut)
   - *Why you care:* debuggers lose local variables in optimized code.
     The format can say where each local is at each step.
   - solc's ethdebug data doesn't yet say more than its older outputs
     (ranges match the source map at every step we tested). The format
     can say more.
   - No production compiler writes local variables yet. bugc, our
     reference compiler for BUG (a small language made to test the
     format), does, at every optimization level.
   - **Figure `optimized-locals`:** the game in BUG at optimization
     level 2; where each local lives comes from bugc's ethdebug
     pointers; the page decodes the bytes itself.
   - bugc tests the format; it does not replace solc. solc adds support
     one public pull request at a time **[P]**.
   - Open problem: a value the optimizer turned into an expression
     (ethdebug/format issue #291).
   - Contracts already deployed: their layout rules can be written
     once as ethdebug data (backfilling). Runtime Verification started
     a tool for existing solc output; nobody has finished this yet.

5. **Build on it** (~200; short, decided 10-13; heading still a
   placeholder)
   - *Why you care:* one small piece of code reads every compiler's
     output.
   - The ten-line stepper: for each step, look up the source range the
     compiler recorded and print that line. The same lines work on solc
     and Fe output (tested 10-03).
   - LLMs build tools from ethdebug data: a tool that shows each storage
     value a transaction changed, by name, from public material only.
     Honest about the tie: without ethdebug, from solc's older outputs,
     the model was as fast. The specification and schemas let us check
     the tool. Pointer to the appendix (prompt, rules, judge; re-run
     when solc emits local variables; no date).

6. **Pick one guess, and replace it with data** (~120; a call to
   action, not a summary)
   - Pick one thing your tool guesses today, and replace the guess with
     data the compiler wrote down. Then tell us what you built.
   - Links: the specification, the packages, the Matrix chat, the
     companion page.
   - Who "we" are, said once; thanks to Walnut, the Fe team, Runtime
     Verification and Paradigm's Solar team **[open: consent; notes
     audit]**.

---

**Moved to the companion page:** the solc settings snippet and the
hosted builds, Fe's three commands, exact timings and build sizes, the
per-model challenge table, the solc pull-request stages in detail, the
mainnet check, Fe's adapter details, the full "why not DWARF"
comparison.

**Open:**
- Whether the post may say "the Solidity team prioritized ethdebug"
  (needs Lea's source).
- The publish date: none set (quality over speed).
- Whether one-slot pointer walks need a "found" step.
- Follow the post's own order, or the goals page's order (universal
  format, real-life debugging, adoption, understanding deployed code)?
