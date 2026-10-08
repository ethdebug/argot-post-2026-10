// The dumps' panel (vanilla #panel, #mpanel): both sides in one box;
// "active" while something is lit, "chosen" while a value is selected
import type { ReactNode } from "react";
import { useLensState, useLink } from "./hooks";

export const panel = (id: string, link: string) =>
  function Panel({ children }: { children: ReactNode }) {
    const [l] = useLink(link);
    const side = useLensState((s) => s.side ?? "after");
    const cls = ["panel", l.selection || l.hover ? "active" : "",
      l.selection ? "chosen" : ""].filter(Boolean).join(" ");
    return <div id={id} className={cls} data-mode={side}>
      <p className="muted small swipe">Each word is one line of 32 bytes;
        scroll sideways to see bytes 24 to 31.</p>
      <div className="views">{children}</div>
    </div>;
  };
