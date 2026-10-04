# Topic sentences

Working plan for the post; [verify] marks claims still to check.

One sentence per planned paragraph: what that paragraph argues. Read
only the **bold** sentences, top to bottom: they should carry the
whole post. *Italic notes* say what the paragraph uses (an exhibit,
evidence) and its rough length.

---

**Standfirst** (one italic line)
- **Compilers can now tell tools what their bytecode means. Here is
  what that looks like today, what you can build on it, and what comes
  next.** *(Carries the post's main claim.)*

**Opening** (~90, untitled)
- **ethdebug is an open specification for that information: the debug
  data a compiler writes next to its EVM bytecode.** *(What each
  instruction means in the source, and where each value lives; the
  role DWARF plays for native code. Who we are: the ethdebug team at
  Argot; first introduction here. Momentum: three compilers write it,
  independent tools read it. Who it's for: anyone who builds tools, or
  wants to.)*

---

**1. Tools have always worked backwards** (~400)

- **Every tool that shows you a transaction in Solidity terms guesses
  what the compiler meant, and nothing tells you when it guesses
  wrong.** *(Where variables live in storage, which bytes came from
  which line; the rules change by compiler and version; the Vyper
  example of a plausible wrong number. ~100)*
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

- **You can get this data in a few minutes, from three compilers, with
  tools you already have.** *(Answers a common newcomer question: "what
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

- **Reading the data takes about ten lines of code, and the same ten
  lines work for Solidity and Fe.** *(Exhibit: step.mjs, and its real
  output from both languages side by side. ~150 plus code)*
- **Before you try it, know two details; each needs one or two more
  lines of code.** *(Most solc steps point at compiler-generated code;
  Fe wraps its file a little differently today. ~90)*
- **On solc, this gives what the older source map already gave, in a
  simpler form; what is new is that the same code also reads another
  language.** *(8 lines instead of 19; the goals page names Solidity,
  Vyper and Fe, and two work today. ~90)*

**4. Pointers: the compiler states the rule, and any tool applies
it** (~220)

- **Pointers do the main work in ethdebug: a pointer is the compiler's
  own statement of where each value lives, and how to find it.**
  *(The post's main claim in its plainest form. ~50)*
- **Here is solc's actual rule for finding an entry of a mapping, and
  two independent tools read it the same way.** *(Exhibit: the mapping
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
- **Without ethdebug, the same model was just as fast, because for
  storage on solc the older outputs say the same thing; today,
  ethdebug ties.** *(Said plainly. ~60)*
- **So we publish the contest now, with its rules and judge: anyone
  can re-run it, and we will too, once solc emits local variables.**
  *(Why a checkable tool matters: 45% of Solidity developers distrust
  AI output [verify]. No date; the re-run follows the milestone. ~100)*

**6. A real debugger already runs on it, offline, in your browser**
(~270)

- **soldb, Walnut's open-source debugger, already reads ethdebug: it
  replays transactions offline and steps through them in your
  browser.** *(Exhibit: the demo page; a replay file of a few
  kilobytes, attached to an audit finding, lets anyone step through
  it. ~100)*
- **Switch the demo to Fe, and the same debugger steps through a
  contract in a different language, because both compilers emit the
  same format.** *(Exhibit: the Solidity | Fe switch; say plainly that
  the page only adapts Fe's file layout. ~70)*
- **Three independent teams now read the format, in three programming
  languages.** *(Our TypeScript packages, soldb in Rust, Runtime
  Verification's Python reader; link the storage inspector, with one
  clause: it decodes values itself, a stand-in for the format's
  planned interpretation layer. ~50)*
- **For solc, this works only on contracts compiled with via-IR and
  without the optimizer, and those are rare on mainnet today.**
  *(Under 0.1%: 0.06% of verified deployments; 0.15% for solc 0.8.29
  and later. Fe and Solar already handle optimized code. ~70)*

**7. Today it matches the old outputs; next, it goes where they
can't** (~380)

- **Today, solc's ethdebug output matches what tools already had; the
  next stages give them what they never had.** *(~50)*
- **First comes every state variable as data, then local variables,
  which tools have long struggled to show.** *(Compilers give where
  each variable lives. Every state variable works on Walnut's branch;
  local variables are designed; Foundry's request has been open since
  2022 [verify]. ~90)*
- **To show values, the format must also say what the bytes mean, and
  that is its next big piece.** *(Signed or not, scale, byte order,
  field names: the type schema rewrite, issue #282, right after this
  release. Until then, no tool shows values from ethdebug the same way
  for every compiler. ~60)*
- **The format is already built for optimized code; solc is the part
  still catching up.** *(81% of verified mainnet deployments are
  optimized; `transform`, `gather` and `pick`; Solar and Fe emit
  ethdebug for optimized builds; gap: values in optimized code. ~70)*
- **BUG already shows what calls and optimized code can look like
  after solc's next stages.** *(A real call stack from `invoke` and
  `return`, with no guessing from jump markers. Inlined code is marked
  `transform: ["inline"]` and still linked to its call: the inlined
  `ADD` still names `dbl(src)`. All tested. No variable values. BUG is
  a small teaching language and bugc is not a production compiler, so
  this previews the format. Link: ethdebug's own reference debugger
  (the trace playground); soldb tracks what solc emits today. ~90)*
- **Fe's compiler already models variables, scopes and inlining
  internally, so a second language is within reach for these too.**
  *(~25)*
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
