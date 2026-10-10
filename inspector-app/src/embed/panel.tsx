// The panel entry (embed-panel.html#scene=<id>&channel=<id>): a figure's
// walkthrough panel alone, in a frame of its own beside the figure's
// (embed.html#scene=<id>&panel=external&channel=<id>). A thin view: it
// draws the model the figure sends over their channel (ui/panel-port.ts)
// and sends back the reader's intents (its buttons; ← → Home End while
// it has the focus; its way out, the figure's ↺ Reset, no Exit). No engine, no data. It posts its
// height to the host page: { type: "ethdebug:height", height }. The host
// says whether it is stuck to an edge of its view ({ type:
// "ethdebug:stuck", stuck, edge: "top" | "bottom" }): flush with that
// edge then, a card with its corners when not (data-stuck; panel.css);
// the figure hears it too. It follows the host's theme, as the figure's frame does
// (theme.ts).
import "../../../shared/appendix.css";
import "../style.css";
import "../ui/code.css";
import "../lenses/xray.css";
import "./embed.css";
import "./panel.css";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PanelView, type Intent, type PanelModel,
} from "../ui/WalkthroughPanel";
import { channelName } from "../ui/panel-port";
import { followTheme } from "./theme";

const hash = new URLSearchParams(location.hash.slice(1));
followTheme(hash);
const bc = new BroadcastChannel(channelName(hash.get("scene") ?? "",
  hash.get("channel") ?? ""));
const act = (intent: Intent) => bc.postMessage({ type: "intent", intent });
const root = document.getElementById("embed")!;

addEventListener("message", (e) => {
  if (e.source !== parent || e.data?.type !== "ethdebug:stuck") return;
  const stuck = !!e.data.stuck;
  // (at which edge of the host's screen: its top, or its bottom)
  const edge = e.data.edge === "bottom" ? "bottom" : "top";
  if (stuck) document.documentElement.dataset.stuck = edge;
  else delete document.documentElement.dataset.stuck;
  bc.postMessage({ type: "stuck", stuck });
});

// Its height: the tallest the panel is at rest and at any step of the
// walkthrough, at this width (each drawn, unseen, from the figure's
// `variants`), so the frame never changes height as the reader steps,
// nor as the panel loads; posted once known ({ ready: true }), then on a
// change of width, or of the phone's fold: the tallest with the pointer
// folded, or the tallest with it open, as the reader has it. Until then,
// nothing: the host keeps the room heights.json says.
let last = -1;
let posted = false;
const post = (height: number) => {
  if (height === last || height <= 0) return;
  last = height;
  parent.postMessage({ type: "ethdebug:height", height,
    ...posted ? {} : { ready: true } }, "*");
  posted = true;
};

function Panel() {
  const [m, setM] = useState<PanelModel | null>(null);
  const [vs, setVs] = useState<PanelModel[] | undefined>();
  // (the tallest with the pointer folded, and open: a phone's fold)
  const [talls, setTalls] = useState({ shut: 0, open: 0 });
  const [open, setOpen] = useState(false);
  const tall = open ? talls.open : talls.shut;
  const measure = useRef<HTMLDivElement>(null);
  // (the variants drawn unseen, at this width: the tallest; again when
  // the width changes, or the fonts come in)
  useLayoutEffect(() => {
    const box = measure.current;
    if (!box) return;
    // (a panel's height, folded and open: its own, not the room kept)
    const both = (e: HTMLElement) => {
      const ds = [...e.querySelectorAll<HTMLDetailsElement>("details.ptr")];
      const was = ds.map((d) => d.open);
      const min = e.style.minHeight;
      e.style.minHeight = "0px";
      const at = (o: boolean) => {
        ds.forEach((d) => d.open = o);
        return Math.ceil(e.scrollHeight);
      };
      const h = { shut: at(false), open: at(true) };
      ds.forEach((d, k) => d.open = was[k]);
      e.style.minHeight = min;
      return h;
    };
    const go = () => {
      // (and the panel shown, should it ever be taller: never cut)
      const hs = [...box.querySelectorAll<HTMLElement>(":scope > .wpanel"),
        ...document.querySelectorAll<HTMLElement>(".pshown > .wpanel")]
        .map(both);
      if (hs.length) setTalls((t) => {
        const n = { shut: Math.max(t.shut, ...hs.map((h) => h.shut)),
          open: Math.max(t.open, ...hs.map((h) => h.open)) };
        return n.shut === t.shut && n.open === t.open ? t : n;
      });
    };
    go();
    void document.fonts?.ready.then(go);
    // (and as the unseen panels unfold)
    const ticks = [100, 250, 500, 900].map((t) => setTimeout(go, t));
    // (a new width: measured again from nothing)
    let w = innerWidth;
    const ro = new ResizeObserver(() => setTimeout(() => {
      if (innerWidth !== w) {
        w = innerWidth;
        setTalls({ shut: 0, open: 0 });
      }
      go();
    }));
    ro.observe(box);
    ro.observe(root);
    return () => {
      ro.disconnect();
      ticks.forEach(clearTimeout);
    };
  }, [vs]);
  // (the reader's fold: the shown panel's pointer opened or closed)
  useEffect(() => {
    const t = (e: Event) => {
      const d = e.target as Element;
      if (d.matches?.("details.ptr") && d.closest(".pshown")) {
        setOpen((d as HTMLDetailsElement).open);
      }
    };
    document.addEventListener("toggle", t, true);
    return () => document.removeEventListener("toggle", t, true);
  }, []);
  // (posted once it holds still: the steps' details unfold as they are
  // drawn, by an animation)
  useEffect(() => {
    if (!tall) return;
    const t = setTimeout(() => post(tall), 400);
    return () => clearTimeout(t);
  }, [tall]);
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.data?.type === "model") {
        setM(e.data.model as PanelModel);
        if (e.data.variants) setVs(e.data.variants as PanelModel[]);
      }
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
      if (to !== null) act({ type: "step", to });
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", key);
    return () => removeEventListener("keydown", key);
  }, [m]);
  const none = () => {};
  return <>
    {m && <div className="pshown" style={{ minHeight: tall || undefined }}>
      <PanelView model={m} act={act} domId="details" compact /></div>}
    <div ref={measure} className="pmeasure" aria-hidden="true" inert>
      {vs?.map((v, k) => <PanelView key={k} model={{ ...v, exit: undefined }}
        act={none} compact />)}
    </div>
  </>;
}
createRoot(root).render(<Panel />);
