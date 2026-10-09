import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { A } from "../../test/expect";
import { fromHash, toHash, type HashLens } from "./hash";

const lens: HashLens = { links: ["storage"],
  bookmarks: ["mid", "alice", "motd", "vyper"],
  hash: { prefix: "", legacy: true } };
const q = (s: string) => new URLSearchParams(s);

it("round-trips every scene x selection", async () => {
  const p = await testProject();
  for (const bm of p.bookmarks.filter((b) =>
    lens.bookmarks!.includes(b.id))) {
    for (const sel of [null, bm.select ?? null, "totalScore"]) {
      const h = toHash(lens, { bookmark: bm.id, selection: sel },
        p.bookmarks);
      const s = new URLSearchParams(Object.entries(h)
        .filter(([, v]) => v !== null) as [string, string][]);
      expect(fromHash(lens, s, p.bookmarks)).toEqual({ bookmark: bm.id,
        selection: sel });
    }
  }
});

it("parses vanilla's keys (mode and insets: read as nothing); leaves the "
  + "memory section's alone", async () => {
  const p = await testProject();
  expect(fromHash(lens, q("ex=motd&mode=before&sel=motd&mopt=2" +
    "&mpt=mult&mmode=after&insets=0"), p.bookmarks)).toEqual({
    bookmark: "motd", selection: "motd" });
});

it("sel= is a cleared selection; no sel is the scene's", async () => {
  const p = await testProject();
  expect(fromHash(lens, q("ex=mid&sel="), p.bookmarks).selection)
    .toBe(null);
  expect(fromHash(lens, q("ex=mid"), p.bookmarks).selection).toBe(A);
  // (and a cleared default is written as "sel=")
  expect(toHash(lens, { bookmark: "mid", selection: null }, p.bookmarks))
    .toEqual({ ex: "mid", sel: "", rel: null, mode: null, insets: null });
});

it("a stale or foreign hash gives the first scene's defaults",
  async () => {
    const p = await testProject();
    for (const h of ["ex=token", "ex=nope&mode=compare&sel=zzz&mopt=7",
      "memory", "mpt=mult&msel=mult"]) {
      expect(fromHash(lens, q(h.includes("=") ? h : ""), p.bookmarks))
        .toEqual({ bookmark: "mid", selection: A });
    }
  });

// (a lens showing one scene, the shell's #scene=: with no key of its own
// in the hash, that scene, never the first)
it("no scene asked: the lens's own first scene", async () => {
  const p = await testProject();
  expect(fromHash({ ...lens, initial: { scene: "alice" } }, q("scene=alice"),
    p.bookmarks).bookmark).toBe("alice");
  expect(fromHash({ ...mem, initial: { scene: "O2/roll" } },
    q("scene=bug-O2"), p.bookmarks).bookmark).toBe("O2/roll");
  // (one asked wins)
  expect(fromHash({ ...lens, initial: { scene: "alice" } }, q("ex=motd"),
    p.bookmarks).bookmark).toBe("motd");
});

// the memory section's lens: its level and pause apart (mopt, mpt), its
// selection (absent: the pause's default; empty: none) (vanilla mem.js
// keep, main)
const mem: HashLens = { links: ["mem"],
  bookmarks: ["O0/roll", "O0/mult", "O0/writes", "O2/roll", "O2/mult",
    "O2/writes"], hash: { prefix: "m", levels: true } };

it("the memory section's keys: mopt, mpt, msel", async () => {
  const p = await testProject();
  expect(fromHash(mem, q("ex=motd&mode=before&sel=playerList&mopt=2&mpt=mult"
    + "&mmode=before&msel=mult&insets=0"), p.bookmarks)).toEqual({
    bookmark: "O2/mult", selection: "mult" });
  expect(fromHash(mem, q("mopt=2"), p.bookmarks)).toMatchObject({
    bookmark: "O2/roll", selection: "hit" });
  expect(fromHash(mem, q("mpt=writes&msel="), p.bookmarks)).toMatchObject({
    bookmark: "O0/writes", selection: null });
  // (stale: the defaults)
  expect(fromHash(mem, q("mopt=7&mpt=x&msel=zzz"), p.bookmarks))
    .toMatchObject({ bookmark: "O0/roll", selection: "zzz" });
  expect(toHash(mem, { bookmark: "O2/mult", selection: "_applyCombo" },
    p.bookmarks)).toEqual({ mopt: "2", mpt: "mult", msel: null,
    mrel: null, mmode: null, minsets: null });
  expect(toHash(mem, { bookmark: "O0/roll", selection: null },
    p.bookmarks)).toEqual({ mopt: "0", mpt: "roll", msel: "", mrel: null,
    mmode: null, minsets: null });
});

it("the related view: rel, its context rows (none: off)", async () => {
  const p = await testProject();
  const at = (h: string) => fromHash(lens, q(h), p.bookmarks).related;
  expect([at("ex=mid"), at("ex=mid&rel=0"), at("ex=mid&rel=1"),
    at("ex=mid&rel=x")]).toEqual([undefined, 0, 1, undefined]);
  const s = { bookmark: "mid", selection: "totalScore" };
  expect(toHash(lens, s, p.bookmarks).rel).toBe(null);
  expect(toHash(lens, { ...s, related: 1 }, p.bookmarks).rel).toBe("1");
  expect(toHash(mem, { ...s, bookmark: "O0/roll", related: 0 },
    p.bookmarks).mrel).toBe("0");
});
