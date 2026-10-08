// The pinned library (lib.ts, from vendor/*.tgz) against the demo's own
// bundle (demos/inspector/vendor/pointers.js, which make-fixtures uses
// through decode.js): every state variable, and
// every players[key], of the four fixtures at both points, gives the
// same regions and the same bytes; and some expressions evaluate the
// same. (Parity is behaviour, not bundle bytes: vendor/PIN.)
import { it, expect, beforeAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as pinned from "./lib";
import { solcTilde } from "./fixtures/legacy";

type Lib = typeof pinned;
const libs = {} as { vanilla: Lib };
beforeAll(async () => {
  const file = path.resolve("..", "demos", "inspector", "vendor",
    "pointers.js");
  libs.vanilla = await import(/* @vite-ignore */ file);
});

interface Fixture {
  slots: Record<string, { before: string; after: string }>;
  keys: [string, { key: string }[]][];
  contract: { types: Record<string, { kind: string }>;
    pointers: Record<string, unknown>;
    variables: { identifier: string; type: { id: string };
      pointer: Record<string, unknown> & { define?: { slot: string } } }[] };
}
// (solc's "$" read as "~" first, as the page does: legacy.ts solcTilde)
const fixture = (id: string) => {
  const f = JSON.parse(fs.readFileSync(`../demos/inspector/fixtures/${id}.json`,
    "utf8")) as Fixture;
  f.contract.pointers = solcTilde(f.contract.pointers);
  f.contract.variables = f.contract.variables.map((v) =>
    ({ ...v, pointer: solcTilde(v.pointer) }));
  return f;
};
const word = (n: bigint) => "0x" + n.toString(16).padStart(64, "0");

// vanilla decode.js storageState, with either library's Data
function state(lib: Lib, slots: Fixture["slots"], side: "before" | "after") {
  const none = () => {
    throw new Error("not part of this state");
  };
  return {
    storage: {
      async read({ slot, slice }: { slot: { asUint(): bigint };
        slice?: { offset: bigint; length: bigint } }) {
        const w = lib.Data.fromHex(slots[word(slot.asUint())][side])
          .resizeTo(32);
        if (!slice) return w;
        const o = Number(slice.offset);
        return lib.Data.fromBytes(w.slice(o, o + Number(slice.length)));
      },
    },
    stack: { get length() { return Promise.resolve(0n); }, peek: none },
    get memory() { return none(); },
  } as never;
}

// each variable's pointer, as vanilla decode.js builds it: a value
// type's region, a template given its slot, a mapping per key
function pointers(f: Fixture): [string, unknown][] {
  const out: [string, unknown][] = [];
  const keys = new Map(f.keys);
  for (const v of f.contract.variables) {
    const p = v.pointer;
    const t = f.contract.types[v.type.id];
    if (p.location === "storage" && !t.kind.match(/mapping/)) {
      out.push([v.identifier, { location: "storage", slot: p.slot,
        offset: p.offset ?? 0, length: p.length ?? 32 }]);
      continue;
    }
    const slot = (p.slot ?? p.define!.slot) as string;
    if (t.kind !== "mapping") {
      out.push([v.identifier,
        { define: { slot }, in: { template: v.type.id } }]);
      continue;
    }
    for (const { key } of keys.get(word(BigInt(slot))) ?? []) {
      out.push([`${v.identifier}[${key}]`,
        { define: { slot, key }, in: { template: v.type.id } }]);
    }
  }
  return out;
}

async function regions(lib: Lib, pointer: unknown, f: Fixture,
  side: "before" | "after") {
  const s = state(lib, f.slots, side);
  const c = await lib.dereference(pointer as never,
    { state: s, templates: f.contract.pointers as never });
  const view = await c.view(s);
  const hex = (x?: { toHex(): string }) => x?.toHex();
  return Promise.all([...view.regions].map(async (r) => {
    const x = r as unknown as { name?: string; location: string;
      slot?: { toHex(): string }; offset?: { toHex(): string };
      length?: { toHex(): string } };
    return [x.name, x.location, hex(x.slot), hex(x.offset), hex(x.length),
      (await view.read(r)).toHex()];
  }));
}

const cases = ["arcade-mid", "arcade-alice", "arcade-motd", "arcade-vyper"]
  .flatMap((id) => (["before", "after"] as const).flatMap((side) =>
    pointers(fixture(id)).map(([name, p]) =>
      [`${id} ${side} ${name}`, id, side, p] as const)));

it("the demo's bundle is the pinned commit", () => {
  expect((libs.vanilla as unknown as { commit: string }).commit)
    .toMatch(/^d7cb421a3/);
});

it("covers every variable and every players[key]", () => {
  // (four value or template variables and three players, each side;
  // Vyper's: the three players)
  expect(cases.length).toBe(2 * (7 + 7 + 7 + 3));
});

it.each(cases)("%s: same regions and bytes", async (_, id, side, p) => {
  const f = fixture(id);
  const got = await regions(pinned, p, f, side);
  expect(got.length).toBeGreaterThan(0);
  expect(got).toEqual(await regions(libs.vanilla, p, f, side));
});

it.each([
  { "~sum": [1, 2] }, { "~product": [3, { "~difference": [10, 4] }] },
  { "~keccak256": [{ "~wordsized": 1 }, { "~wordsized": 3 }] },
  { "~wordsized": "0x01" },
  { "~sized2": "0x0102030405" },
])("evaluates %j the same", async (expr) => {
  const ev = (lib: Lib) => lib.evaluate(expr as never,
    { state: {} as never, regions: {}, variables: {} });
  const show = (v: Awaited<ReturnType<Lib["evaluate"]>>) =>
    v.sort === "bytes" ? v.data.toHex() : v.value.toString();
  expect(show(await ev(pinned))).toBe(show(await ev(libs.vanilla)));
});
