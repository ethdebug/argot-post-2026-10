import { it, expect } from "vitest";
import { testProject } from "../../../test/project";
import { B, C, NAME_C } from "../../../test/expect";

const CAROL = `"${NAME_C}"`;
import { decode } from "../decode";
import { walkthrough, retarget, type Form, type Tok } from "./fold";

const at = async (bm = "mid", side = "after") => {
  const p = await testProject();
  const b = p.bookmarks.find((x) => x.id === bm)!;
  const d = await decode(p, p.decodings[b.decoding], `${b.timeline}:${side}`);
  const t = await p.timeline(b.timeline);
  return { d, c: await p.compilation(p.decodings[b.decoding].compilation),
    snap: t.points.find((x) => x.id === d.point)!.snapshot,
    keys: p.decodings[b.decoding].keys };
};
const plain = (s: string) => s.replace(/`/g, "");
const toks = (ts: Tok[]) => ts.map((t) => typeof t === "string" ? t
  : "code" in t ? t.code : "gloss" in t ? t.gloss : "prose" in t ? t.prose
    : "question" in t ? t.question
    : t.text).join("");
const formText = (f: Form) => f.kind === "text" ? toks(f.toks)
  : f.kind === "table" ? f.rows.map((r) => `${toks(r.a)}→${toks(r.b)}`)
    .join("\n") : f.kind === "lines" ? f.lines.map(toks).join("\n")
    : f.fields.map((x) => x.name).join(" ");

it("players: step 0, then twelve steps, one a rule", async () => {
  const w = walkthrough(await at(), "players")!;
  expect(w.steps[0]).toMatchObject({ goal: true, id: "goal" });
  const caps = w.steps.slice(1).map((s) => plain(s.cap));
  const want = [
    "The keys: the addresses in roster",
    "players is declared at slot 3; that slot holds nothing",
    "The template mapping(address => Player) takes slot = 3, key = each " +
      "address in roster",
    "Each record is at keccak(key, 3)",
    "The template Player takes slot = each record's slot",
    "The first slot packs six fields, from the right",
    "The next slot holds name, a string",
    "The template string takes slot = each name slot",
    "The last byte of each name slot is its length flag",
    'The last byte decides the form: even → short ("alice", "bob"), odd → '
      + `long (${CAROL})`,
    "Each short text is in its slot, from the left",
    "The text starts at keccak(…9979) = …c248, 34 bytes over 2 slots",
  ];
  expect(caps).toHaveLength(want.length);
  caps.forEach((c, k) => expect(c, `step ${k + 1}`).toMatch(
    new RegExp(`^${want[k].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)));
  expect(w.steps.slice(1).map((s) => `${s.chip}${s.chipLabel}`).join("|"))
    .toBe("keysroster|slot 3mapping|mapping(address => Player)template|" +
      "keccak(key, 3)record|Playertemplate|6 fieldsfields|namestring|" +
      "stringtemplate|flagstring|short | longbranch|inlinetext|" +
      "keccak(slot)text");
  expect(w.recs!.map((r) => r.who))
    .toEqual(['"alice"', '"bob"', CAROL]);
  expect(w.focus).toBe("*");
  const input = formText(w.steps[1].form);
  for (const x of ['0x7099…79c8 "alice"→[0]', '0x3c44…93bc "bob"→[1]',
    `0x90f7…b906 ${CAROL}→[2]`]) expect(input).toContain(x);
  const fork = formText(w.steps[10].form);
  expect(fork).toContain("even: 0x0a → 5 bytes inline");
  expect(fork).toContain("odd: 0x45 → 34 bytes at keccak(…9979)");
  // (the fields: a byte strip of alice's first slot)
  const f = w.steps[6].form;
  expect(f.kind).toBe("strip");
  if (f.kind === "strip") {
    expect(f.fields.map((x) => [x.name, x.from, x.to])).toEqual([
      ["lastBlock", 0, 7], ["hitCount", 8, 11], ["plays", 12, 15],
      ["bestCombo", 16, 19], ["combo", 20, 23], ["score", 24, 31]]);
  }
});

it("carol's record: step 0 and the eleven steps", async () => {
  const w = walkthrough(await at(), C)!;
  expect(w.steps[0].goal).toBe(true);
  const caps = w.steps.slice(1).map((s) => plain(s.cap));
  const want = [`key = ${CAROL}'s address, from roster[2]`,
    "players is declared at slot 3",
    'The template mapping(address => Player) takes slot = 3, key = ' +
      `${CAROL}'s address`,
    "The record is at keccak(0x90f7…b906, 3) = …9978",
    "The template Player takes slot = …9978",
    "The first slot packs six fields",
    "The next slot holds name, a string: …9978 + 1 = …9979",
    "The template string takes slot = …9979",
    "The last byte is the length flag, 0x45",
    "Odd → long: the slot holds 2 × length + 1, so length = 34",
    "The text starts at keccak(…9979) = …c248, 34 bytes over 2 slots"];
  expect(caps.length).toBe(11);
  caps.forEach((c, k) => expect(c.startsWith(want[k]), `${k + 1}: ${c}`)
    .toBe(true));
  expect(w.focus).toBe(C);
});

it("one value: no step 0 when it is one region in one slot", async () => {
  const x = await at();
  const w = walkthrough(x, `${B}.plays`)!;
  expect(w.steps.map((s) => plain(s.cap).split(" ")[1]).join())
    .toBe("=,is,template,record,template,is");
  expect(walkthrough(x, "total")!.steps.map((s) => s.phase))
    .toEqual(["declared"]);
  const nm = walkthrough(x, `${C}.name`)!;
  expect(nm.steps[0].goal).toBe(true);
  expect(nm.steps.slice(1).map((s) => plain(s.cap).split(" ")[1]).join())
    .toBe("=,is,template,record,template,next,template,last,→,text");
  expect(walkthrough(x, "roster")!.steps.map((s) => s.phase))
    .toEqual(["goal", "declared", "template", "read", "item"]);
  expect(walkthrough(x, "motd")!.steps.map((s) => s.phase))
    .toEqual(["goal", "declared", "template", "read", "if", "data"]);
});

it("the band only moves down; a template's band is its frame",
  async () => {
    const w = walkthrough(await at(), "players")!;
    const tpl = w.steps.find((s) => s.chip === "Player")!;
    expect(tpl.band).toEqual(["=t_struct$_Player_$16_storage|",
      "=t_struct$_Player_$16_storage|expect",
      "=t_struct$_Player_$16_storage|for"]);
    expect(w.steps[0].band).toEqual([]);
    expect(w.steps[1].band).toEqual([]);
  });

it("re-targeting keeps the step: same identity, or the nearest earlier",
  async () => {
    const x = await at();
    const carolName = walkthrough(x, `${C}.name`)!.steps;
    const bobName = walkthrough(x, `${B}.name`)!.steps;
    // (carol's name at its "template string" step: bob's has it too)
    const k = carolName.findIndex((s) => s.chip === "string" &&
      s.phase === "template");
    const r = retarget(carolName, k, bobName);
    expect(bobName[r.at].id).toBe(carolName[k].id);
    // (carol's record at the fields step -> carol's name: the nearest
    // earlier match, the Player template)
    const rec = walkthrough(x, C)!.steps;
    const f = rec.findIndex((s) => s.phase === "fields");
    const r2 = retarget(rec, f, carolName);
    expect(carolName[r2.at].chip).toBe("Player");
    expect(r2.moved).toBe(true);
    // (no match: the first step)
    const total = walkthrough(x, "total")!.steps;
    expect(retarget(carolName, 3, total)).toEqual({ at: 0, moved: true });
    // (no match: the first step after the goal, as vanilla: total ->
    // players lands on step 1, the same number: no cue)
    const players = walkthrough(x, "players")!.steps;
    expect(retarget(total, 0, players)).toEqual({ at: 1, moved: false });
    // (the cue: when the step's number changes; roster's step 2 ->
    // total's step 1. Vanilla's cue compares off by one here; see the
    // M5 report)
    const roster = walkthrough(x, "roster")!.steps;
    expect(retarget(roster, 2, total)).toEqual({ at: 0, moved: true });
    const bob = walkthrough(x, B)!.steps;
    expect(retarget(players, 5, bob)).toEqual({ at: 5, moved: false });
  });

it("step 0, as vanilla: the slots the steps touch, whole; the question",
  async () => {
    const w = walkthrough(await at(), "players")!;
    const g = w.steps[0];
    expect(plain(g.cap)).toBe("These 9 slots hold players, scattered " +
      "across storage.");
    expect(formText(g.form)).toBe("How do we find them, and what do they " +
      "mean?");
    expect(g.chip).toBe("");
    // (bob's plays: one region in one slot: no step 0)
    expect(walkthrough(await at(), `${B}.plays`)!.steps[0].goal)
      .toBeUndefined();
  });

it("reads come from the graph's edges, not from the pointer's text: "
  + "the steps stay as they are with the operators spelled otherwise",
  async () => {
    const x = await at();
    const spelled = JSON.parse(JSON.stringify(x.c.templates)
      .replace(/"~(read|keccak256|sum|wordsized)"/g, '"~$1-x"'));
    const y = { ...x, c: { ...x.c, templates: spelled } };
    for (const p of ["roster", "motd", `${C}.name`]) {
      expect(walkthrough(y, p)!.steps.map((s) => s.phase), p)
        .toEqual(walkthrough(x, p)!.steps.map((s) => s.phase));
    }
  });

it("an empty on-chain name falls back to the short address (Vyper's "
  + "records, read by solc's rule, have none)", async () => {
  const x = await at("vyper", "after");
  const w = walkthrough(x, "players")!;
  expect(w.recs!.map((r) => r.who)).toEqual(w.recs!.map((r) =>
    r.path.replace(/^players\[(0x.{4}).*(.{4})\]$/, "$1…$2")));
  const text = JSON.stringify(w.steps, (_, v) =>
    typeof v === "bigint" ? String(v) : v);
  expect(text).not.toContain('\\"\\"');
});
