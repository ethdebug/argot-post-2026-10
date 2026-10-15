# Topic sentences

Working plan for the post; [verify] marks claims still to check.

One sentence per planned paragraph: what that paragraph argues. Read
only the **bold** sentences, top to bottom: they should carry the
whole post. *Italic notes* say what the paragraph uses (a figure,
evidence) and its rough length. The intro and §2 are new (decided
2026-10-13); the other sections follow the draft as it is now.

---

**Standfirst** (one italic line)
- **Compilers can now better explain their bytecode to tools; this
  post covers what that looks like today, how you can build on it, and
  what comes next.** *(Carries the post's main claim.)*

**Intro** (~200, untitled)
- **ethdebug is an open specification for the debug data compilers
  write next to their EVM bytecode: DWARF's role, designed for smart
  contract languages.** *(An Argot Collective project; its first
  introduction on this blog. ~60)*
- **Three compilers write ethdebug data today, and tools have started
  to read it.** *(solc, Fe and Solar; Walnut's soldb reads it; Runtime
  Verification's Simbolik uses it internally. ~50)*
- **AI writes tools fast, and with ethdebug data an LLM can build a
  debugging tool in minutes, but security work needs answers you can
  check.** *(The landscape, decided 10-13. Our LLM test tied on speed
  with solc's older outputs: say nothing that implies ethdebug made
  the LLM faster; the data makes the result checkable. Solidity
  Developer Survey 2025: 88% use AI at least monthly, 45% distrust its
  output. ~60)*
- **There is now enough here to show what this data makes possible:
  tools can stop guessing what the compiler meant.** *(~30)*

---

**1. Tools have always worked backwards** (~600)

- **Compilers serve both the people who read contracts and the machine
  that runs them, and modern optimizers make the machine's state hard
  to read, even for experts.** *(~50)*
- **People have always needed to see through the compiler, and many
  teams have built tools to do it; debugging is still a recurring
  problem for a third of Solidity developers.** *(Solidity Developer
  Survey 2025, at every level of experience; "ethdebug is where that
  work is going", our own claim. [open: "the Solidity team prioritized
  ethdebug" needs Lea's source.] ~60)*
- **Compilers give these tools enough to succeed only with guesswork,
  and Tenderly said so in its own documentation.** *(Rules learned by
  watching the compiler; special cases per version; each new language
  a new challenge. Quote Tenderly's archived via-IR page: "can hold
  only some of the data needed to write a quality debugger". ~60)*
- **A small game shows what a tool sees, and what the compiler's data
  adds.** *(Figure `reveal`. ~30)*
- **Without good debug data, a tool guesses, and usually the guess is
  right.** *(Where Solidity puts mapping entries, packing, string
  layout; tool authors copy the rules. ~40)*
- **Managing compiler rules this way never ends, so tools fall
  behind.** *(New versions, optimizers, contracts that live forever;
  some versions and not others, one language and not the next. ~50)*
- **When the guess is wrong, nothing warns the tool: the wrong answer
  looks as plausible as the right one.** *(~20)*
- **The compiler keeps a program's nesting, but encodes it in hashes
  and packed words that look nothing like the source.** *(Alice's
  score: hash her address with the mapping's slot, then pick one of
  six packed fields; her name's short-string layout. Figure
  `pitfall-nesting`. ~80)*
- **Each language brings its own rules, and a tool with the wrong ones
  reads an empty slot and reports a score of 0.** *(Vyper hashes slot
  then key, and `players` lands at slot 108, not 3. Figure
  `pitfall-compiler`. The fault is the tool's assumption, not either
  language. ~90)*
- **ethdebug moves the rule into the compiler's output, so a tool
  follows the rule it is given.** *(The Vyper side of the figure works
  that way, from hand-written ethdebug data; the first figure, from
  solc's own output. ~60)*
- **Finding the bytes is only half the job; saying what they mean is
  the format's next piece.** *(The type schemas are being reworked,
  ethdebug/format issue #282 [P]; until then the figures decode with
  their own code. ~60)*

**2. What changed this year** (~550; replaces "Three compilers produce
ethdebug data today")

- **Our last full update was the Solidity Summit 2025 talk; since
  then, ethdebug has moved from a design to data that compilers write
  and debuggers read.** *(gnidan, "ethdebug format overview (2025)",
  https://youtu.be/KKvkXFv-GXM. [verify: given at Devconnect Buenos
  Aires, announced for 2025-11-18; 2025-12-04 is the recap post's
  date.] ~50)*
- **The format now ships versioned releases, and each change says who
  must act on it.** *(0.1.0-draft.0 on 2026-09-21, draft.1 on 10-03
  (the stamp required), draft.2 on 10-07 (the `~` sigil); changelog
  lines for compilers and tools: "required", "optional", "no change
  needed". ~70)*
- **solc writes source ranges in its releases, and Walnut is adding
  the rest in stages, in public.** *(Same information as the older
  source maps, in a simpler shape; storage pointers in review,
  argotorg/solidity #16990; every state variable on Walnut's fork. The
  post's figures use a preview build. ~80)*
- **The limits are real: solc writes ethdebug only behind an
  experimental flag, for via-IR builds with the optimizer off, about
  one in a thousand verified mainnet contracts.** *(~50)*
- **Two more compilers write ethdebug data, both with the optimizer
  on.** *(Fe: its only debug output, another Argot project. Solar,
  from Paradigm: on its main branch, with the same bytecode with or
  without the debug data. ~60)*
- **soldb, written for Solidity, steps through a Fe contract too,
  unchanged, because it reads ethdebug.** *(Figure `real-debugger`:
  the same game transaction compiled both ways. ~70)*
- **Implementers keep the format honest: they found four bugs in our
  packages, and each was fixed within days.** *(~40)*
- **What soldb reads is simple: ethdebug programs list each
  instruction with its offset, its operation and its ethdebug
  context.** *(One program per piece of bytecode; the context says
  what holds once the instruction has run. ~70)*
- **The simplest context is a source range, and Solidity and Fe write
  it in the same shape, so one reader handles both.** *(Other kinds
  describe variables, calls and moved code; we come back to those.
  Figure `program-xray`. ~60)*
- **That covers where each instruction came from; where each value
  lives is the job of ethdebug pointers.** *(Bridge. ~25)*

**3. ethdebug pointers: the compiler states the rule, and any tool
applies it** (~200; trimmed)

- **For each variable, the compiler writes an ethdebug pointer: a
  recipe a tool follows to find the variable's bytes.** *(A location
  and positions computed from what is there; templates for repeated
  shapes. ~60)*
- **The figure follows the compiler's pointer for `players`, from its
  slot to every byte of every record.** *(Figure
  `pointer-walkthrough`; it carries the explanation. ~40)*
- **The package that ran those steps knows nothing about the game or
  about Solidity; every rule came from the compiler's data.**
  *(`@ethdebug/pointers`; the keys came from the game's list of
  players. ~60)*
- **For the Vyper version, only the pointer would differ; the tool
  following it would not.** *(~30)*

**4. Next: variables in optimized code** (~350)

- **solc's ethdebug data doesn't yet say more than its older outputs,
  but the format can.** *(Ranges match the classic source map at
  every step we tested. ~40)*
- **Local variables in optimized code are one such thing: the format
  can say where each local is at each step, and bugc, our reference
  compiler, already writes it.** *(No production compiler writes
  locals yet; BUG is a small language made to test the format. ~80)*
- **With the optimizer on, bugc's ethdebug pointers still say where
  each local's bytes are at each step.** *(Figure `optimized-locals`,
  level 2; the page decodes the bytes itself. ~60)*
- **bugc exists to test the format, not to replace solc, which is
  adding support one public pull request at a time.** *(Storage
  pointers in review now; later stages cover every state variable
  [P]. ~50)*
- **We don't know yet how to describe a value the optimizer turned
  into an expression.** *(ethdebug/format issue #291. ~20)*
- **Contracts already deployed can still get ethdebug data, written
  once from the rules tools use today.** *(Backfilling; Runtime
  Verification started a tool for existing solc output; nobody has
  finished it; we'd welcome help. ~90)*

**5. Build on it** (~200; short; heading still a placeholder)

- **Ten lines of code step through Solidity and Fe alike.** *(The
  stepper as a code block: for each step, the recorded source range,
  then the line. ~90 plus code)*
- **An LLM built a working storage tool from ethdebug data in minutes,
  and the specification let us check it; without ethdebug, it was as
  fast.** *(Honest about the tie; pointer to the appendix: prompt,
  rules, judge, re-run when solc emits local variables, no date.
  ~110)*

**6. Pick one guess, and replace it with data** (~120; a call to
action)

- **Pick one thing your tool guesses today, and replace the guess with
  data the compiler wrote down; then tell us what you built.** *(Links:
  the specification, the packages, the Matrix chat, the companion
  page. ~80)*
- **This work is shared across teams, and we thank them.** *(Who "we"
  are, once: the ethdebug team at Argot; Walnut, the Fe team, Runtime
  Verification and Paradigm's Solar team [open: consent]. ~40)*

---

**Skimmer test** (title, standfirst, intro, the bold sentences only):
they carry the main claim (standfirst; §1's "ethdebug moves the rule
into the compiler's output"; §3's first sentence), the progress (§2's
first sentence), the honest tie (intro; §5), and what comes next (§4).
Weakest: §5's heading is still a placeholder.
