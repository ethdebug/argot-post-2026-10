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

it("parses vanilla's keys (mode and insets: read as nothing); leaves "
  + "other keys alone", async () => {
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
  // (one asked wins)
  expect(fromHash({ ...lens, initial: { scene: "alice" } }, q("ex=motd"),
    p.bookmarks).bookmark).toBe("motd");
});

it("the related view: rel, its context rows (none: off)", async () => {
  const p = await testProject();
  const at = (h: string) => fromHash(lens, q(h), p.bookmarks).related;
  expect([at("ex=mid"), at("ex=mid&rel=0"), at("ex=mid&rel=1"),
    at("ex=mid&rel=x")]).toEqual([undefined, 0, 1, undefined]);
  const s = { bookmark: "mid", selection: "totalScore" };
  expect(toHash(lens, s, p.bookmarks).rel).toBe(null);
  expect(toHash(lens, { ...s, related: 1 }, p.bookmarks).rel).toBe("1");
  // (a lens's own prefix: its keys)
  expect(toHash({ ...lens, hash: { prefix: "m" } }, { ...s, related: 0 },
    p.bookmarks).mrel).toBe("0");
});
