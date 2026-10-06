# Topic sentences

Working plan for the post; [verify] marks claims still to check.

One sentence per planned paragraph: what that paragraph argues. Read
only the **bold** sentences, top to bottom: they should carry the
whole post. *Italic notes* say what the paragraph uses (an exhibit,
evidence) and its rough length.

---

**Standfirst** (one italic line)
- **Compilers can now tell tools what their bytecode means. This
  post shows what tools can build on that data today, and what comes
  next.** *(Carries the post's main claim.)*

**Opening** (~90, untitled)
- **ethdebug is an open specification for that information: the debug
  data a compiler writes next to its EVM bytecode.** *(What each
  instruction means in the source, and where each value lives; the
  role DWARF plays for native code. Who we are: the ethdebug team at
  Argot; first introduction here. Adoption: three compilers write it,
  independent tools read it. Who it's for: anyone who builds tools,
  or wants to, and auditors.)*

---

**1. Tools have always worked backwards** (~400)

*Exhibit: one slot, two answers. A real Vyper contract holds a balance
of 1234; Solidity's rule reads another slot and prints 0. Three-row
table; caption states the 0. Hook: the storage inspector, where the
compiler's own rule is visible.*

- **Every tool that shows you a transaction in Solidity terms guesses
  what the compiler meant, and nothing tells you when it guesses
  wrong.** *(Where variables live in storage, which bytes came from
  which line; the rules change by compiler and version; the Vyper
  example of a plausible wrong number; for an auditor, a wrong
  conclusion in a finding. ~100)*
- **For years, each team wrote its own guessing code, and each team
  hit the same limits.** *(Remix, Truffle with the disclosure, hevm,
  Tenderly, Foundry; Tenderly's "heuristics and educated guesses";
  turning the optimizer off. ~110)*
- **With ethdebug, the compiler writes down what its bytecode means,
  in a shared, specified format, so tools do not guess.** *(One short
  paragraph, where the post moves from the problem to the answer.
  ~40)*
- **ethdebug is a set of JSON schemas for the debug data a compiler
  writes next to its bytecode.** *(A program per bytecode,
  instructions with contexts; shared types and pointers; versioned and
  checkable; today's compilers emit parts of it. ~100)*

**2. You can get the data today, from three compilers** (~350)

*Exhibit: one instruction, explained: about six lines of solc 0.8.37
output (offset, opcode, its source range) next to the highlighted source
line. The settings snippet moves to the companion or a collapsible
block. Hook: the companion's settings and the hosted builds.*

- **Three compilers emit this data today, and you need no new tools to
  get it.** *(Answers a common newcomer question: "what
  is in this storage slot?" ~60)*
- **For Solidity, a few lines of compiler settings turn it on; storage
  layouts need a preview build, which we host.** *(Exhibit: the solc
  settings snippet. Solar, a second Solidity compiler by Paradigm,
  emits it too on its main branch. ~120)*
- **Fe writes ethdebug as its only debug output, and BUG, our teaching
  language, runs in your browser with nothing to install.** *(Exhibit:
  Fe's three commands; link to the playground; bugc, BUG's compiler, is
  our reference implementation; one clause: BUG also previews what
  comes next. ~90)*
- **solc is adding support one stage at a time, in public.** *(Source
  ranges are released, storage templates are in review, the next
  stages are written or designed. ~80)*

**3. Ten lines of code step through Solidity and Fe alike** (~300)

*Exhibit: the soldb demo stepping `Shop.place` in Solidity, then the
same page in Fe (a GIF, or two screenshots); step.mjs stays as code.
Hook: "step it yourself" on the soldb demo.*

- **Reading the data takes about ten lines of code, and the same ten
  lines work for Solidity and Fe.** *(Exhibit: step.mjs, and its real
  output from both languages side by side. ~150 plus code)*
- **Two details each need one or two more lines of code.** *(Most solc steps point at compiler-generated code;
  Fe wraps its file a little differently today. ~90)*
- **On solc, this gives what the older source map already gave, in a
  simpler form; what is new is that the same code also reads another
  language.** *(8 lines instead of 19; the goals page names Solidity,
  Vyper and Fe, and two work today. ~90)*

**4. Pointers: the compiler states the rule, and any tool applies
it** (~220)

*Exhibit: the inspector's "How this was found" for
`accounts[sender].nonce`: keccak256(key, slot 0) = `0x7230…a722`, then
bytes 24–31. A second option: the Strings example, one variable in two
layouts, both found by one rule. Hook: "click any value to see its
derivation" in the inspector.*

- **Pointers do the main work in ethdebug: a pointer is the compiler's
  own statement of where each value lives, and how to find it.**
  *(The post's main claim in its plainest form. ~50)*
- **solc writes its rule for finding an entry of a mapping as data,
  and two independent tools read it the same way.** *(Exhibit: the mapping
  template, about six lines; @ethdebug/pointers and soldb's draft
  reader. ~70 plus snippet)*
- **Because the rule is data, a tool needs no knowledge of a
  compiler's storage layout, and a compiler with different rules
  writes different pointers.** *(One line on "why not DWARF,
  storageLayout or source maps?"; the full comparison is on the
  companion page. ~60)*
- **Today this covers storage, where solc's older outputs already gave
  the same facts; the next stages extend it to every variable.**
  *(Pointers say where the bytes are, not yet what they mean; that is
  the format's next piece, in section 7. The gaps in one sentence.
  ~50)*

**5. An LLM builds a working tool from it in minutes** (~250)

- **We asked an LLM to build a tool on this data, and it had a working
  one in under four minutes.** *(The task: show each storage value a
  transaction changed, by name; passed hidden tests; we report every
  run, including the one that failed. ~90)*
- **Without ethdebug, the same model was as fast, because for
  storage on solc the older outputs say the same thing; today,
  ethdebug ties.** *(Said plainly. ~60)*
- **So we publish the contest now, with its rules and judge: anyone
  can re-run it, and we will too, once solc emits local variables.**
  *(Why a checkable tool matters: 45% of Solidity developers distrust
  AI output. No date; the re-run follows the milestone. ~100)*

**6. A real debugger already runs on it, offline, in your browser**
(~270)

*Exhibit: a GIF of soldb stepping `Shop.place` while its state panel
fills in (`nextId 1`, `revenue 30`), from ethdebug alone. Hook: "step it
yourself", and the 6.5 KB replay file an auditor can attach to a
finding.*

- **soldb, Walnut's open-source debugger, already reads ethdebug: it
  replays transactions offline and steps through them in your
  browser.** *(Exhibit: the demo page; a replay file of a few
  kilobytes, attached to an audit finding, lets anyone step through
  it. ~100)*
- **With Walnut's next solc stage, soldb shows a contract's whole
  state from ethdebug alone, with the same values it gets from
  storageLayout.** *(Exhibit: the demo's state panel. Pointers for
  storage, the deployed code for immutables. Say plainly: reading one
  value by path still uses the layout, and both pull requests are
  open. For auditors: the state at each step of a finding comes from
  the compiler's own data. ~60)*
- **Switch the demo to Fe, and the same debugger steps through a
  contract in a different language, because both compilers emit the
  same format.** *(Exhibit: the Solidity | Fe switch; say plainly that
  the page only adapts Fe's file layout. ~70)*
- **Three independent teams have written readers for the format, in
  three programming languages.** *(Our TypeScript packages and soldb
  in Rust read solc's output today; Runtime Verification's Python
  reader does not yet. Link the storage inspector, with one
  clause: it decodes values itself, a stand-in for the format's
  planned interpretation layer. ~50)*
- **For solc, this works only on contracts compiled with via-IR and
  without the optimizer, and those are rare on mainnet today.**
  *(Under 0.1%: 0.06% of verified deployments; 0.15% for solc 0.8.29
  and later. Fe and Solar already handle optimized code. ~70)*

**7. Today it matches the old outputs; next, it goes where they
can't** (~480)

*Exhibit: the BUG trace playground: a call stack from `invoke`/`return`,
and an inlined `ADD` still naming `dbl(src)`. Hook: the BUG playground,
editable in the browser.*

- **Today, solc's ethdebug output matches what tools already had; the
  next stages give them what they never had.** *(~50)*
- **First comes every state variable as data, then local variables,
  which tools have long struggled to show.** *(Compilers give where
  each variable lives. Every state variable works on Walnut's fork
  (walnuthq/solidity #10), and soldb reads state through it;
  local variables are designed; Foundry lists them by name without
  values, and the request is open since 2022 (#927). ~90)*
- **To show values, the format must also say what the bytes mean, and
  that is its next big piece.** *(Signed or not, scale, byte order,
  field names: the type schema rewrite, issue #282, right after this
  release. Until then, no tool shows values from ethdebug the same way
  for every compiler. ~60)*
- **The format is already built for optimized code; solc is the part
  still catching up.** *(81% of verified mainnet deployments are
  optimized; `transform`, `gather` and `pick`; Solar and Fe emit
  ethdebug for optimized builds; gap: values in optimized code. ~70)*
- **Under optimization, debug data may lose precision but never
  accuracy.** *(Precision: a range may gather several statements; a
  folded variable has a type but no location. Accuracy: a pointer
  never reads the wrong bytes. bugc gathers, never drops (#266); its
  open locals work lists folded locals with no pointer and tests every
  pointer at every level (#328); a missing value is a compile error
  (#327, merged). ~30)*
- **ethdebug does not have to wait for every compiler: a backfill tool
  can generate it from what older compiler versions already write.**
  *(Answers section 6's "about 0.1% of mainnet": contracts already on
  chain, built by older compilers. Inputs: source maps, storageLayout,
  the AST; tools adopt one format for old and new code. Runtime
  Verification is building one for solc (ethdebug.py pull request #15,
  open, work in progress; optimizer off, like solc). A direction with
  an early example, not working today: their reader does not yet read
  solc's output (our run, 2026-10-05). A debugger can also recompile
  verified contracts from the inputs Sourcify stores. ~70)*
- **BUG already shows what calls and optimized code can look like
  after solc's next stages.** *(A real call stack from `invoke` and
  `return`, with no guessing from jump markers. Inlined code is marked
  `transform: ["inline"]` and still linked to its call: the inlined
  `ADD` still names `dbl(src)`. All tested. No variable values. BUG is
  a small teaching language and bugc is not a production compiler, so
  this previews the format. Link: ethdebug's own reference debugger
  (the trace playground); soldb tracks what solc emits today. ~90)*
- **Fe's compiler already models variables, scopes and inlining
  internally, so Fe could export them with no format change; that is
  the Fe team's decision.** *(~25)*
- **The format changes as more people implement it, and every change
  says who has to act on it.** *(Four bugs found and fixed within
  days; a spec change used in Walnut's solc build within two weeks.
  ~60)*
- **When solc emits local variables, the contest we published shows
  the difference, and you can run it yourself.** *(~40)*

**Close: pick one guess, and replace it with data** (~150)

- **Pick one thing your tool guesses today, and replace the guess with
  data the compiler wrote down.** *(~50)*
- **Then tell us what you built.** *(Links: the specification, the
  packages, the Matrix chat, the companion page. ~50)*
- **This work is shared across teams, and we thank them.** *(Who "we"
  are, once: the ethdebug team at Argot; thanks to Walnut, the Fe team,
  Runtime Verification and Paradigm's Solar team. ~50)*

---

**Skimmer test** (title, standfirst, opening, the bold sentences
only): they carry the post's main claim (standfirst, §1's third
sentence, §4's first sentence), the tie with solc's older outputs
(§5), and what comes next (§7). Weakest sentence: §2's first sentence
repeats the heading; it could carry the newcomer's question instead.
