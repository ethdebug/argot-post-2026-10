// Where a walkthrough's panel is drawn, when not beside its controller:
// in the post, the figure's embed (embed.html#…&panel=external) sends the
// panel's model to a frame of its own (embed-panel.html), and acts on
// that frame's intents. Both frames join one same-origin channel,
// "ethdebug:<scene>:<channel>" (the host gives each figure its own
// channel id, so two figures of one scene keep apart). Its messages:
// { type: "model", model, variants? } (figure → panel, each change;
// `variants`: the panel at rest and at each step, for it to keep the
// tallest's height), { type:
// "intent", intent } (panel → figure), { type: "hello" } (the panel,
// when it loads: the figure sends the model it has), { type: "stuck",
// stuck } (panel → figure: the host says whether the panel is stuck at
// the top of its view; a step's scroll waits for it, so it never moves
// the ▶ under the reader's pointer).
import { createContext } from "react";
import type { Intent, PanelModel } from "./WalkthroughPanel";

export interface Port {
  publish(m: PanelModel, variants?: PanelModel[]): void;
  // (whether the panel is stuck at the top of the host's view, as the
  // host last said; unknown until it does)
  stuck?: boolean;
  // (its intents to `f`; returns the way to stop)
  listen(f: (i: Intent) => void): () => void;
}
export const PanelPort = createContext<Port | null>(null);

export const channelName = (scene: string, channel: string) =>
  `ethdebug:${scene}:${channel}`;

// The figure's side of the channel
export function figurePort(name: string): Port {
  const bc = new BroadcastChannel(name);
  let last = "";
  let model: PanelModel | null = null;
  let variants: PanelModel[] | undefined;
  const port: Port = {
    publish(m, vs) {
      const s = JSON.stringify([m, vs]);
      if (s === last) return;
      last = s;
      model = m;
      variants = vs;
      bc.postMessage({ type: "model", model: m, variants: vs });
    },
    listen(f) {
      const h = (e: MessageEvent) => {
        if (e.data?.type === "intent") f(e.data.intent as Intent);
      };
      bc.addEventListener("message", h);
      return () => bc.removeEventListener("message", h);
    },
  };
  bc.addEventListener("message", (e) => {
    if (e.data?.type === "hello" && model) {
      bc.postMessage({ type: "model", model, variants });
    }
    if (e.data?.type === "stuck") port.stuck = !!e.data.stuck;
  });
  return port;
}
