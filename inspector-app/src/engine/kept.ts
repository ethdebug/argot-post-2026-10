// A promise that keeps its value once it has one, to read at once: a
// view's first render after a load has it, none goes without it (a
// replay's play, ui/TimelineBar.tsx: each step drawn in one commit)
type Kept<T> = Promise<T> & { value?: T };

export function keep<T>(p: Promise<T>): Promise<T> {
  p.then((v) => {
    (p as Kept<T>).value = v;
  }, () => {});
  return p;
}

export const peek = <T>(p: Promise<T> | undefined): T | undefined =>
  (p as Kept<T> | undefined)?.value;
