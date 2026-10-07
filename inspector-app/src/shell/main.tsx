// The dev/review shell: one lens as a full page
import "../../../shared/appendix.css";
import "../style.css";
import { createRoot } from "react-dom/client";
import { fetchIo } from "../engine/io";
import { load } from "../engine/project";
import { lenses } from "../lenses";
import { Lens } from "../ui/Lens";

const id = new URLSearchParams(location.hash.slice(1)).get("lens");
const spec = lenses.find((l) => l.id === id) ?? lenses[0];
const project = await load(fetchIo(import.meta.env.BASE_URL));
createRoot(document.getElementById("shell")!).render(
  <Lens spec={spec} project={project} />);
