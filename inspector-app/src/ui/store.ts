// A lens's store: one state, set by functions, watched by subscribers
export interface Store<S> {
  get(): S;
  set(f: (s: S) => S): void;
  subscribe(l: () => void): () => void;
}

export function createStore<S>(init: S): Store<S> {
  let state = init;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(f) {
      const next = f(state);
      if (next === state) return;
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(l) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}
