// The panel entry (embed-panel.html#scene=<id>&channel=<id>): a figure's
// walkthrough panel alone, in a frame of its own beside the figure's
// (embed.html#scene=<id>&panel=external&channel=<id>). A thin view: it
// draws the model the figure sends over their channel (ui/panel-port.ts)
// and sends back the reader's intents (its buttons; ← → Home End and
// Escape while it has the focus). No engine, no data. It posts its
// height to the host page: { type: "ethdebug:height", height }.
import "../../../shared/appendix.css";
import "../style.css";
import "../ui/code.css";
import "./embed.css";
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PanelView, type Intent, type PanelModel,
} from "../ui/WalkthroughPanel";
import { channelName } from "../ui/panel-port";

const hash = new URLSearchParams(location.hash.slice(1));
const bc = new BroadcastChannel(channelName(hash.get("scene") ?? "",
  hash.get("channel") ?? ""));
const act = (intent: Intent) => bc.postMessage({ type: "intent", intent });
const root = document.getElementById("embed")!;

let last = -1;
new ResizeObserver(() => {
  const height = Math.ceil(root.getBoundingClientRect().height);
  if (height === last) return;
  last = height;
  parent.postMessage({ type: "ethdebug:height", height }, "*");
}).observe(root);

function Panel() {
  const [m, setM] = useState<PanelModel | null>(null);
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data?.type === "model") setM(e.data.model as PanelModel);
    };
    bc.addEventListener("message", h);
    bc.postMessage({ type: "hello" });
    return () => bc.removeEventListener("message", h);
  }, []);
  // (the lens's keys, while this frame has the focus)
  useEffect(() => {
    const w = m?.walk;
    if (!w) return;
    const key = (e: KeyboardEvent) => {
      const n = w.dots.length;
      const to = e.key === "ArrowRight" ? w.i + 1 : e.key === "ArrowLeft"
        ? w.i - 1 : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : null;
      if (e.key === "Escape") act({ type: "exit" });
      else if (to !== null) act({ type: "step", to });
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [m]);
  return m ? <PanelView model={m} act={act} domId="details" /> : null;
}
createRoot(root).render(<Panel />);
