// Write keys into the URL hash (vanilla panel.js setHash): merged into
// it (null drops a key), with no history entry, and only on a change.
// A browser that refuses (WebKit: 100 calls in 10 s) gets it again later,
// with the hash as it is then (`at`: the writer's pending hash).
export type Pending = { pending?: string | null; later?: ReturnType<
  typeof setTimeout> };

export function writeHash(changes: Record<string, string | null>,
  at: Pending): void {
  const p = new URLSearchParams(at.pending ?? (location.hash.includes("=")
    ? location.hash.slice(1) : ""));
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined) p.delete(k);
    else p.set(k, v);
  }
  const h = p.toString().replace(/%5B/g, "[").replace(/%5D/g, "]");
  if (`#${h}` === location.hash || (!h && !location.hash)) return;
  try {
    history.replaceState(null, "", h ? `#${h}`
      : location.pathname + location.search);
    at.pending = null;
  } catch {
    at.pending = h;
    clearTimeout(at.later);
    at.later = setTimeout(() => writeHash({}, at), 2000);
  }
}

// The hash's keys (a hash without "=" is a plain link to a section)
export const readHash = () => new URLSearchParams(
  location.hash.includes("=") ? location.hash.slice(1) : "");
