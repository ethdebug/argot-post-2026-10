// A pointer expression in words, one way for every construct the
// schema allows (ethdebug/format/pointer/expression): arithmetic as
// operators, `~keccak256`, `~concat` and the resizes as calls, a read
// as read(name), a lookup as name.offset, `~this` as this; a variable
// or a literal as written. `value`: the value of an operand that is an
// expression itself (the walk's `args`), in place of its words.
type Any = any;
const OPS: Record<string, string> = { "~sum": " + ", "~difference": " − ",
  "~product": " × ", "~quotient": " ÷ ", "~remainder": " mod " };

// `bare`: a resize's operand alone (keccak(alice, 3), not
// keccak(wordsized(alice), wordsized(3))), for the values' form
export function exprText(e: unknown, value?: (e: unknown) => string |
  undefined, top = true, bare = false): string {
  const v = top ? undefined : value?.(e);
  if (v !== undefined) return v;
  if (typeof e === "number" || typeof e === "bigint") return String(e);
  if (typeof e === "string") {
    if (e === "~wordsize") return "wordsize";
    if (e === "~this") return "this";
    // (a small hex literal as a number: 0x01 → 1)
    if (/^0x[0-9a-f]+$/i.test(e) && BigInt(e) < 1n << 32n) {
      return String(BigInt(e));
    }
    return e;
  }
  if (!e || typeof e !== "object") return String(e);
  const [op] = Object.keys(e);
  const a = (e as Any)[op];
  const args = [a].flat();
  const sub = (x: unknown) => {
    const t = exprText(x, value, false, bare);
    // (an operation inside another: in parentheses)
    const inner = x && typeof x === "object" && OPS[Object.keys(x)[0]];
    return inner && value?.(x) === undefined ? `(${t})` : t;
  };
  if (OPS[op]) return args.map(sub).join(OPS[op]);
  if (op === "~keccak256") return `keccak(${args.map(sub).join(", ")})`;
  if (op === "~concat") return `concat(${args.map(sub).join(", ")})`;
  if (op === "~read") return `read(${a})`;
  if (/^\.(slot|offset|length)$/.test(op)) {
    return `${a === "~this" ? "this" : a}${op}`;
  }
  // (~wordsized, ~sized2, …)
  if (bare && args.length === 1) return sub(args[0]);
  return `${op.slice(1)}(${args.map(sub).join(", ")})`;
}
