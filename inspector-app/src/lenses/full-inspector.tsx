// The Phase 1 page as a lens: the storage scenes. M1: the first
// bookmark, the dumps (before, after) and the tree, linked.
import type { ReactNode } from "react";
import { useLensState, useLink } from "../ui/hooks";
import type { LensSpec } from "../ui/types";

// The dumps' panel (vanilla #panel): both sides in one box; "active"
// while something is lit, "chosen" while a value is selected
function Panel({ children }: { children: ReactNode }) {
  const [link] = useLink("storage");
  const side = useLensState((s) => s.side ?? "after");
  const cls = ["panel", link.selection || link.hover ? "active" : "",
    link.selection ? "chosen" : ""].filter(Boolean).join(" ");
  return <div id="panel" className={cls} data-mode={side}>
    <p className="muted small swipe">Each word is one line of 32 bytes;
      scroll sideways to see bytes 24 to 31.</p>
    <div className="views">{children}</div>
  </div>;
}

// The vanilla page's two columns: the storage dump, the variables
function Columns({ areas }: { areas: Record<string, ReactNode> }) {
  const single = useLensState((s) => s.points.a === s.points.b);
  return <main data-single={single ? "" : undefined}>
    <div className="cols scols">
      <section aria-labelledby="words-h" className="words">
        <h2 className="label colhead" id="words-h">Storage{" "}
          <span className="legend"><span className="bchg">changed byte</span>
            {" "}<span className="bfree">no value shown</span></span></h2>
        <div id="dump" className="dump">{areas.dump}</div>
      </section>
      <section aria-label="Variables" className="storage">
        <h2 className="label colhead">Variables{" "}
          <span className="legend chglegend"><span className="chg">changed
          </span>{" "}<span className="same">unchanged</span></span></h2>
        <div className="treebox">{areas.tree}</div>
      </section>
    </div>
  </main>;
}

export const fullInspector: LensSpec = {
  id: "inspector", title: "Storage, by name",
  timelines: ["arcade-mid"], decodings: ["sol:arcade-mid"],
  bookmarks: ["mid"],
  grid: '"dump tree"',
  links: ["storage"],
  views: [
    { id: "before", kind: "dump", area: "dump", location: "storage",
      link: "storage", data: { decoding: "$bm", point: { slot: "a" } } },
    { id: "after", kind: "dump", area: "dump", location: "storage",
      link: "storage", data: { decoding: "$bm", point: { slot: "b" } } },
    { id: "tree", kind: "tree", area: "tree", link: "storage",
      domId: "tree", data: { decoding: "$bm", point: { slot: "$side" } } },
  ],
  hash: { prefix: "", legacy: true },
  wrap: { dump: Panel },
  frame: Columns,
};
