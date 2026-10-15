// All IO the engine does, injected: the page fetches, node tests read
// files (test/io.ts)
import built from "virtual:snapshot-files";
export interface Io {
  json<T>(path: string): Promise<T>;
  text(path: string): Promise<string>;
  bytes(path: string): Promise<Uint8Array>;
}

// A file's name as the build gave it: a scene's snapshot named by its
// contents, so a page reads its own build's data, never a newer one
export const builtName = (p: string): string => built[p] ?? p;

// fetch, relative to `base` (the app's base URL)
export function fetchIo(base: string): Io {
  const get = async (p: string) => {
    let res: Response;
    try {
      res = await fetch(base + builtName(p));
    } catch {
      throw new Error(`Could not load ${p} (the network request failed).`);
    }
    // (a page from before the site changed asks for its own data, gone)
    if (res.status === 404 && builtName(p) !== p) {
      throw new Error(`Could not load ${p} (HTTP 404: the site changed ` +
        "since this page loaded; reload it).");
    }
    if (!res.ok) throw new Error(`Could not load ${p} (HTTP ${res.status}).`);
    return res;
  };
  return {
    json: async <T>(p: string) => (await (await get(p)).json()) as T,
    text: async (p) => (await get(p)).text(),
    bytes: async (p) => new Uint8Array(await (await get(p)).arrayBuffer()),
  };
}
