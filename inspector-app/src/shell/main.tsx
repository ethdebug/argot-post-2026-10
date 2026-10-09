// The dev/review shell's entry
import "../../../shared/appendix.css";
import "../style.css";
import "../ui/port.css";
import "../lenses/raw.css";
import "../ui/code.css";
import "../lenses/debugger.css";
import "./shell.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { lenses } from "../lenses";
import { builds, figures, page, scenes } from "../scenes";
import { Shell } from "./Shell";
import { browserRuns, runWorker } from "../engine/run/client";
import { digest } from "../engine/run/run";

// (authoring: each scene from its run, made in a worker, the EVM's
// chunk loaded there; addendum §3.1)
const runs = browserRuns(runWorker());
const project = await load(fetchIo(import.meta.env.BASE_URL),
  { scenes, builds, page, runs });
// (the runs' digests, as digests.json's: test/e2e/authoring)
(window as unknown as { runDigest(s: string, b: string): Promise<string> })
  .runDigest = async (s, b) => digest(await runs.run(
    await runs.scenario(s, [b]), b));
createRoot(document.getElementById("shell")!).render(
  <Shell project={project} lenses={lenses} scenes={scenes}
    figures={figures} />);
