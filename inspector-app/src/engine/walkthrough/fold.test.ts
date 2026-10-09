import { it, expect } from "vitest";
import { testProject } from "../../../test/project";
import { A, B, C, MOTD, NAME_C } from "../../../test/expect";

const CAROL = `"${NAME_C}"`;
import { decode } from "../decode";
import {
  walkthrough, retarget, type Form, type Step, type Tok,
} from "./fold";

const at = async (bm = "mid", side = "after") => {
  const p = await testProject();
  const b = p.bookmarks.find((x) => x.id === bm)!;
  const d = await decode(p, p.decodings[b.decoding],
    b.points[side === "before" ? 0 : b.points.length - 1]);
  const t = await p.timeline(b.timeline);
  return { d, c: await p.compilation(p.decodings[b.decoding].compilation),
    snap: t.points.find((x) => x.id === d.point)!.snapshot,
    keys: p.decodings[b.decoding].keys };
};
const plain = (s: string) => s.replace(/`/g, "");
// (the rule steps: all but the last, found, tested on its own below)
const rules = <T extends { steps: Step[] }>(w: T): T => ({ ...w,
  steps: w.steps.filter((s) => s.phase !== "found") });
const toks = (ts: Tok[]) => ts.map((t) => typeof t === "string" ? t
  : "code" in t ? t.code : "gloss" in t ? t.gloss : "prose" in t ? t.prose
    : "question" in t ? t.question
    : t.text).join("");
const formText = (f: Form) => f.kind === "text" ? toks(f.toks)
  : f.kind === "table" ? f.rows.map((r) => `${toks(r.a)}→${toks(r.b)}`)
    .join("\n") : f.kind === "lines" ? f.lines.map(toks).join("\n")
    : f.fields.map((x) => x.name).join(" ");

it("players: step 0, then ten steps, one a rule (a template entered "
  + "from a hand-off is one step with it)", async () => {
  const w = rules(walkthrough(await at(), "players")!);
  expect(w.steps[0]).toMatchObject({ goal: true, id: "goal" });
  const caps = w.steps.slice(1).map((s) => plain(s.cap));
  const want = [
    "The keys: a mapping does not store its keys; the page takes them " +
      "from playerList",
    "players is declared at slot 3; that slot holds nothing",
    "The template mapping(address => Player) takes slot and key",
    "Each record is at keccak(key, slot 3); the template Player takes it " +
      "as its slot",
    "The first slot packs six fields, from the right",
    "name is in the next slot, slot + 1; the template string takes it as " +
      "its slot",
    "The last byte of each name slot is its length flag",
    // (the players by the scene's names for them)
    'The last byte decides the form: even → short ("alice", "bob"), odd → ' +
      `long (${CAROL})`,
    "Each short text is in its slot, from the left",
    "The text starts at keccak(slot …9979) = …c248: 34 bytes over 2 slots",
  ];
  expect(caps).toHaveLength(want.length);
  caps.forEach((c, k) => expect(c, `step ${k + 1}`).toMatch(
    new RegExp(`^${want[k].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)));
  expect(w.steps.slice(1).map((s) => `${s.chip}${s.chipLabel}`).join("|"))
    .toBe("keysplayerList|slot 3mapping|mapping(address => Player)template|" +
      "keccak(key, slot 3)record|6 fieldsfields|namestring|" +
      "flagstring|short | longbranch|inlinetext|keccak(slot …)text");
  expect(w.recs!.map((r) => [r.who, r.full])).toEqual([
    ['"alice"', '"alice"'], ['"bob"', '"bob"'], ['"carol, the un…"', CAROL]]);
  expect(w.focus).toBe("*");
  // (each name with its address once, at the keys)
  const input = formText(w.steps[1].form);
  for (const x of ['"alice" (0x7099…79c8)→[0]', '"bob" (0x3c44…93bc)→[1]',
    `${CAROL} (0x90f7…b906)→[2]`]) expect(input).toContain(x);
  // (one spelling of a hash: keccak(<the key>, slot 3); the key is the
  // address, its name only its row's label)
  const rec = formText(w.steps[4].form);
  expect(rec).toContain('"alice"→keccak(0x7099…79c8, slot 3) = …aa80');
  // (with one record, the step says what the hash takes)
  const one = walkthrough(await at(), C)!.steps.find((s) =>
    s.chipLabel === "record")!;
  expect(formText(one.form)).toContain("keccak of two 32-byte words");
  const fork = formText(w.steps[8].form);
  expect(fork).toContain("even: 0x0a → 5 bytes inline");
  expect(fork).toContain("odd: 0x45 → 34 bytes at keccak(slot …9979)");
  // (the fields: a byte strip of alice's first slot)
  const f = w.steps[5].form;
  expect(f.kind).toBe("strip");
  if (f.kind === "strip") {
    expect(f.fields.map((x) => [x.name, x.from, x.to])).toEqual([
      ["lastBlock", 0, 7], ["hits", 8, 11], ["plays", 12, 15],
      ["bestCombo", 16, 19], ["combo", 20, 23], ["score", 24, 31]]);
  }
});

it("carol's record: step 0 and the eleven steps", async () => {
  const w = rules(walkthrough(await at(), C)!);
  expect(w.steps[0].goal).toBe(true);
  const caps = w.steps.slice(1).map((s) => plain(s.cap));
  const want = [`The key: the address of ${CAROL}. A mapping does not store its ` +
      "keys; the page takes it from playerList[2]",
    "players is declared at slot 3",
    "The template mapping(address => Player) takes slot and key",
    "The record is at keccak(key, slot 3); the template Player takes it",
    "The first slot packs six fields",
    "name is in the next slot, slot + 1; the template string takes it",
    "The last byte of name's slot is its length flag",
    "Odd → long: the slot holds 2 × length + 1, so length = 34",
    "The text starts at keccak(slot …9979) = …c248: 34 bytes over 2 slots"];
  expect(caps.length).toBe(9);
  caps.forEach((c, k) => expect(c.startsWith(want[k]), `${k + 1}: ${c}`)
    .toBe(true));
  expect(w.focus).toBe(C);
});

it("one value: no step 0 when it is one region in one slot", async () => {
  const x = await at();
  const w = rules(walkthrough(x, `${B}.plays`)!);
  expect(w.steps.map((s) => s.phase).join())
    .toBe("input,declared,template,handoff,fields");
  // (one rule step: no found after it, which would add nothing)
  expect(walkthrough(x, "totalScore")!.steps.map((s) => s.phase))
    .toEqual(["declared"]);
  const nm = rules(walkthrough(x, `${C}.name`)!);
  expect(nm.steps[0].goal).toBe(true);
  expect(nm.steps.slice(1).map((s) => s.phase).join())
    .toBe("input,declared,template,handoff,handoff,read,if,data");
  expect(rules(walkthrough(x, "playerList")!).steps.map((s) => s.phase))
    .toEqual(["goal", "declared", "template", "read", "item"]);
  expect(rules(walkthrough(x, "motd")!).steps.map((s) => s.phase))
    .toEqual(["goal", "declared", "template", "read", "if", "data"]);
});

it("the band only moves down; a template's band is its frame",
  async () => {
    const w = rules(walkthrough(await at(), "players")!);
    // (the record's hand-off: its define, then the template it enters)
    const tpl = w.steps.find((s) => s.chipLabel === "record")!;
    expect(tpl.band.slice(-3)).toEqual(["=t_struct$_Player_$16_storage|",
      "=t_struct$_Player_$16_storage|expect",
      "=t_struct$_Player_$16_storage|for"]);
    expect(w.steps[0].band).toEqual([]);
    expect(w.steps[1].band).toEqual([]);
  });

it("re-targeting keeps the step: same identity, or the nearest earlier",
  async () => {
    const x = await at();
    const carolName = rules(walkthrough(x, `${C}.name`)!).steps;
    const bobName = rules(walkthrough(x, `${B}.name`)!).steps;
    // (carol's name at its "name in the next slot" step: bob's has it
    // too)
    const k = carolName.findIndex((s) => s.chip === "name" &&
      s.phase === "handoff");
    const r = retarget(carolName, k, bobName);
    expect(bobName[r.at].id).toBe(carolName[k].id);
    // (carol's record at the fields step -> carol's name: the nearest
    // earlier match, the record's hand-off)
    const rec = rules(walkthrough(x, C)!).steps;
    const f = rec.findIndex((s) => s.phase === "fields");
    const r2 = retarget(rec, f, carolName);
    expect(carolName[r2.at].chipLabel).toBe("record");
    expect(r2.moved).toBe(true);
    // (no match: the first step)
    const totalScore = rules(walkthrough(x, "totalScore")!).steps;
    expect(retarget(carolName, 3, totalScore)).toEqual({ at: 0, moved: true });
    // (no match: the first step after the goal, as vanilla: totalScore ->
    // players lands on step 1, the same number: no cue)
    const players = rules(walkthrough(x, "players")!).steps;
    expect(retarget(totalScore, 0, players)).toEqual({ at: 1, moved: false });
    // (the cue: when the step's number changes; playerList's step 2 ->
    // totalScore's step 1. Vanilla's cue compares off by one here; see the
    // M5 report)
    const playerList = rules(walkthrough(x, "playerList")!).steps;
    expect(retarget(playerList, 2, totalScore)).toEqual({ at: 0, moved: true });
    const bob = rules(walkthrough(x, B)!).steps;
    expect(retarget(players, 5, bob)).toEqual({ at: 5, moved: false });
  });

it("step 0, as vanilla: the slots the steps touch, whole; the question",
  async () => {
    const w = rules(walkthrough(await at(), "players")!);
    const g = w.steps[0];
    expect(plain(g.cap)).toBe("These 9 slots belong to players, scattered " +
      "across storage; one of them holds none of its data.");
    expect(formText(g.form)).toBe("Which rules find them, and what do they " +
      "mean?");
    expect(g.chip).toBe("");
    // (bob's plays: one region in one slot: no step 0)
    expect(rules(walkthrough(await at(), `${B}.plays`)!).steps[0].goal)
      .toBeUndefined();
  });

it("reads come from the graph's edges, not from the pointer's text: "
  + "the steps stay as they are with the operators spelled otherwise",
  async () => {
    const x = await at();
    const spelled = JSON.parse(JSON.stringify(x.c.templates)
      .replace(/"~(read|keccak256|sum|wordsized)"/g, '"~$1-x"'));
    const y = { ...x, c: { ...x.c, templates: spelled } };
    for (const p of ["playerList", "motd", `${C}.name`]) {
      expect(rules(walkthrough(y, p)!).steps.map((s) => s.phase), p)
        .toEqual(rules(walkthrough(x, p)!).steps.map((s) => s.phase));
    }
  });

it("an empty on-chain name falls back to the short address (Vyper's "
  + "records, read by solc's rule, have none)", async () => {
  const x = await at("vyper", "after");
  const w = rules(walkthrough(x, "players")!);
  expect(w.recs!.map((r) => r.who)).toEqual(w.recs!.map((r) =>
    r.path.replace(/^players\[(0x.{4}).*(.{4})\]$/, "$1…$2")));
  const text = JSON.stringify(w.steps, (_, v) =>
    typeof v === "bigint" ? String(v) : v);
  expect(text).not.toContain('\\"\\"');
});

it("the last step, found: the selection, what it is; a re-target there "
  + "stays on found", async () => {
  const x = await at();
  const cap = (p: string) => walkthrough(x, p)!.steps.at(-1)!;
  expect(cap("players")).toMatchObject({ phase: "found", id: "found",
    chip: "found", chipLabel: "players",
    cap: `\`players\` holds 3 records: "alice", "bob", ${CAROL}.` });
  expect(cap("playerList").cap).toBe("`playerList` holds 3 items.");
  expect(cap(C).cap).toBe('`players["carol, the un…"]` holds 7 fields.');
  expect(cap("motd").cap).toBe(`\`motd\` = "${MOTD[0]}".`);
  const a = walkthrough(x, C)!.steps;
  const b = walkthrough(x, `${C}.name`)!.steps;
  expect(retarget(a, a.length - 1, b).at).toBe(b.length - 1);
});

it("a hand-off lights the slots it computes, whole, in each entry's "
  + "colour; one entry alone in the selection's yellow", async () => {
  const w = walkthrough(await at(), "players")!;
  const rec = w.steps.find((s) => s.chipLabel === "record")!;
  expect(rec.parts.map((p) => [p.k, p.wholes?.[0].slice(-4)])).toEqual([
    [1, "aa80"], [2, "7527"], [3, "9978"]]);
  expect(rec.rows).toEqual([A, B, C]);
  const one = walkthrough(await at(), `${C}.name`)!.steps.filter((s) =>
    s.phase === "handoff");
  expect(one.map((s) => s.parts.map((p) => p.k))).toEqual([[0], [0]]);
});

it("colours keep one meaning, step 0 to found: yellow is the selection's "
  + "alone; carol's record's fields as its resting view gives them",
  async () => {
    const x = await at();
    const yellowOutside = (p: string) => walkthrough(x, p)!.steps.flatMap(
      (s) => s.parts.flatMap((q) => [...(q.colours ?? new Map())]
        .filter(([r, k]) => k === 0 && s.rows.includes(r) && r !== p &&
          !r.startsWith(p + ".") && !r.startsWith(p + "["))
        .map(([r]) => `${s.phase} ${r}`)));
    for (const p of ["players", C, `${C}.name`, "playerList[1]", "motd"]) {
      expect(yellowOutside(p), p).toEqual([]);
    }
    // (carol's record: its fields at the packed step as found shows them:
    // childColours of the record, 1…6 for its packed fields)
    const w = walkthrough(x, C)!;
    const f = w.steps.find((s) => s.phase === "fields")!.form;
    expect(f.kind === "strip" && f.fields.map((z) => [z.name, z.k]))
      .toEqual([["lastBlock", 6], ["hits", 5], ["plays", 4],
        ["bestCombo", 3], ["combo", 2], ["score", 1]]);
    // (the selection's own bytes are yellow at each step that reads them)
    const nm = walkthrough(x, `${C}.name`)!;
    const data = nm.steps.find((s) => s.phase === "data")!;
    expect(data.parts[0].colours!.get(`${C}.name`)).toBe(0);
  });

it("Vyper: Solidity's rule, then the misread, with Vyper's own layout "
  + "hand-written for comparison", async () => {
  const p = await testProject();
  const b = p.bookmarks.find((y) => y.id === "vyper")!;
  const dc = p.decodings[b.decoding];
  const x = await at("vyper");
  const cd = await decode(p, p.decodings[dc.foreign!.rule], x.d.point);
  const w = walkthrough({ ...x, contrast: { d: cd, language: "vyper" } },
    `${A}.score`)!;
  const last = w.steps.at(-1)!;
  expect(last.phase).toBe("external");
  expect(plain(last.cap)).toBe("The misread: Vyper keeps players[0x7099…79c8]" +
    ".score in slot …0446, where it is 30; Solidity's rule read 0 from " +
    "slot …aa80 where Vyper keeps nothing.");
  expect(last.source).toBe("from: Vyper's layout, hand-written for " +
    "comparison (Vyper emits no ethdebug)");
  expect(w.steps.at(-2)!.cap).toBe("Solidity's rule reads " +
    "`players[0x7099…79c8].score` = 0.");
  expect(w.steps.find((s) => s.phase === "declared")!.cap).toContain(
    "in Vyper's storage, that slot holds something else");
});

it("a step's variables, as the focus has them, for its band's lines "
  + "(the review's T4)", async () => {
  const w = walkthrough(await at(), C)!;
  const map = w.steps.find((s) => s.phase === "template")!;
  const rec = w.steps.find((s) => s.chipLabel === "record")!;
  // (the key, the address; its name beside it)
  const key = `0x90f7…b906 (${CAROL})`;
  expect(map.notes?.values).toEqual({ slot: "3", key });
  expect(rec.notes?.values).toEqual({ key, slot: "3" });
});

it("one side of a pair: step 0 names the side it walks (the review's T7)",
  async () => {
    const x = await at("motd", "after");
    const g = walkthrough({ ...x, when: "after setMotd" }, "motd")!.steps[0];
    expect(g.cap).toBe("After setMotd, this slot holds `motd`.");
  });
