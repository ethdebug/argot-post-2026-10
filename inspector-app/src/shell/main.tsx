// The dev/review shell's entry
import "../../../shared/appendix.css";
import "../style.css";
import "./shell.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { lenses } from "../lenses";
import { Shell } from "./Shell";

const project = await load(fetchIo(import.meta.env.BASE_URL));
createRoot(document.getElementById("shell")!).render(
  <Shell project={project} lenses={lenses} />);
