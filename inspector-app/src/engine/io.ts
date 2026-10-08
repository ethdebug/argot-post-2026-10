// All IO the engine does, injected: the page fetches, node tests read
// files (test/io.ts)
export interface Io {
  json<T>(path: string): Promise<T>;
  text(path: string): Promise<string>;
  bytes(path: string): Promise<Uint8Array>;
}

// fetch, relative to `base` (the app's base URL)
export function fetchIo(base: string): Io {
  const get = async (p: string) => {
    let res: Response;
    try {
      res = await fetch(base + p);
    } catch {
      throw new Error(`Could not load ${p} (the network request failed).`);
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
