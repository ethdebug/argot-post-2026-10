// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { Lens } from "./Lens";
import { testProject } from "../../test/project";
import type { LensSpec } from "./types";

afterEach(cleanup);

const val = (c: HTMLElement, path: string) => c.querySelector(
  `li[data-path="${path}"] .val`)?.textContent;

it("a lens brings its own decoding", async () => {
  const project = await testProject();
  const spec: LensSpec = {
    id: "own", title: "Own", timelines: ["arcade-alice"], grid: '"t"',
    decodings: [{ id: "mine", compilation: "sol@arcade-alice",
      timeline: "arcade-alice", variables: "state",
      keys: { from: "list", path: "roster" } }],
    links: ["s"],
    views: [{ id: "t", kind: "tree", area: "t", link: "s",
      data: { decoding: "mine", point: "arcade-alice:before" } }],
  };
  expect(project.decodings.mine).toBeUndefined();
  const { container } = render(<Lens spec={spec} project={project} />);
  await waitFor(() => expect(val(container, "total")).toBe("40"),
    { timeout: 5000 });
});

it("two dumps at two literal points: both shown, neither a side",
  async () => {
    const project = await testProject();
    const at = (point: string) => ({ decoding: "sol:arcade-alice", point });
    const spec: LensSpec = {
      id: "two", title: "Two", timelines: ["arcade-alice"],
      decodings: ["sol:arcade-alice"], grid: '"a" "b"', links: ["s"],
      views: [
        { id: "a", kind: "dump", area: "a", location: "storage", link: "s",
          data: at("arcade-alice:before") },
        { id: "b", kind: "dump", area: "b", location: "storage", link: "s",
          data: at("arcade-alice:after") },
      ],
    };
    const { container } = render(<Lens spec={spec} project={project} />);
    const slot2 = "0x" + "2".padStart(64, "0");
    const word = (v: Element) => [...v.querySelectorAll(
      `.wrow[data-slot="${slot2}"] .b`)].map((b) => b.textContent).join("")
      .slice(-2);
    await waitFor(() => expect([...container.querySelectorAll(".view")]
      .map(word)).toEqual(["28", "46"]), { timeout: 5000 });
    const views = [...container.querySelectorAll(".view")];
    expect(views.map((v) => v.hasAttribute("hidden")))
      .toEqual([false, false]);
    expect(views.map((v) => v.getAttribute("data-side"))).toEqual([null,
      null]);
    expect(views.map((v) => v.querySelector(".view-name")!.textContent))
      .toEqual(["Storage", "Storage"]);
  });
