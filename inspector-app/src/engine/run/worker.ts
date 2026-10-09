// The run in a Web Worker (addendum §2.5): it loads the EVM chunk, runs,
// and posts the run as data, its typed arrays transferred; stacks,
// memory and journals are cloned once per run
import type { BuildId, Scenario } from "./types";
import { runScenario, type RunData } from "./run";

export async function serve(msg: { scenario: Scenario; build: BuildId }):
  Promise<{ run: RunData; transfer: ArrayBuffer[] }> {
  const { stateAt: _, ...run } = await runScenario(msg.scenario, msg.build,
    await import("./evm"));
  const transfer = run.txs.flatMap((t) => [t.pc, t.op, t.depth, t.frame]
    .map((a) => a.buffer as ArrayBuffer));
  return { run, transfer };
}

// (in a worker: answer each message `{ id, scenario, build }`)
declare const WorkerGlobalScope: unknown;
if (typeof WorkerGlobalScope !== "undefined") {
  const scope = self as unknown as {
    onmessage: (e: MessageEvent) => void;
    postMessage(m: unknown, t: Transferable[]): void };
  scope.onmessage = async ({ data }) => {
    try {
      const { run, transfer } = await serve(data);
      scope.postMessage({ id: data.id, run }, transfer);
    } catch (e) {
      scope.postMessage({ id: data.id, error: String(e) }, []);
    }
  };
}
