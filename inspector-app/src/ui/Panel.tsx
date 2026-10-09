// The dumps' panel (vanilla #panel, #mpanel): its dumps in one box;
// "active" while something is lit, "chosen" while a value is selected
import type { ReactNode } from "react";
import { useLink } from "./hooks";

// (`loc`: the location its dumps show, on .views: the one panel for
// every location)
export const panel = (id: string, link: string, loc = "storage") =>
  function Panel({ children }: { children: ReactNode }) {
    const [l] = useLink(link);
    const cls = ["panel", l.selection || l.hover ? "active" : "",
      l.selection ? "chosen" : ""].filter(Boolean).join(" ");
    return <div id={id} className={cls}>
      <p className="muted small swipe">Each word is one line of 32 bytes;
        scroll sideways to see bytes 24 to 31.</p>
      <div className="views" data-loc={loc}>{children}</div>
    </div>;
  };
