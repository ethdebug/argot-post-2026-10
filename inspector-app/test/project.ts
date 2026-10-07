import { load, type Project } from "../src/engine/project";
import { fsIo } from "./io";

// The project from the app's static fixtures
export const testProject = (): Promise<Project> => load(fsIo());
