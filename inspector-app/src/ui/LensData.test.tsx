// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { Lens } from "./Lens";
import { testProject } from "../../test/project";
import type { LensSpec } from "./types";
import { alicePlays } from "../lenses/alice-plays";
import { vyper } from "../lenses/vyper";
import { A } from "../../test/expect";

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

it("Phase 2's 'alice plays' (spec §6b): two literal points compare, "
  + "and the tree keeps the filter's roots", async () => {
  const project = await testProject();
  const { container } = render(<Lens spec={alicePlays} project={project} />);
  const slot2 = "0x" + "2".padStart(64, "0");
  await waitFor(() => expect(container.querySelectorAll(
    `.view .wrow[data-slot="${slot2}"] .b.chg`).length).toBeGreaterThan(0),
  { timeout: 5000 });
  const views = [...container.querySelectorAll(".view")];
  expect(views).toHaveLength(2);
  for (const v of views) {
    expect(v.querySelector(`.wrow[data-slot="${slot2}"]`)!
      .getAttribute("data-facts")).toBe("read, written");
  }
  await waitFor(() => expect(container.querySelectorAll(
    ".tree li[data-path]").length).toBeGreaterThan(0), { timeout: 5000 });
  const paths = [...container.querySelectorAll<HTMLElement>(
    ".tree li[data-path]")].map((li) => li.dataset.path!);
  expect(paths.filter((p) => !p.startsWith(A)))
    .toEqual(["total", "rounds", "players"].filter((p) =>
      paths.includes(p)));
  expect(paths).toContain(`${A}.score`);
  expect(paths.some((p) => p.startsWith("players[0x3c44"))).toBe(false);
  expect(paths).not.toContain("roster");
  // (the score changed: its row says so)
  expect(container.querySelector(`li[data-path="${A}.score"]`)!.classList
    .contains("chg")).toBe(true);
});

it("Phase 2's Vyper lens (spec §6c): Vyper's layout badged hand-written",
  async () => {
    const project = await testProject();
    const { container } = render(<Lens spec={vyper} project={project} />);
    await waitFor(() => expect(container.querySelectorAll(
      ".tree li[data-path]").length).toBeGreaterThan(8), { timeout: 5000 });
    const trees = [...container.querySelectorAll(".tree")];
    await waitFor(() => expect(trees[1].querySelector(".handmade")
      ?.textContent).toBe("written by hand, not from Vyper"),
    { timeout: 5000 });
    expect(trees[0].querySelector(".handmade")).toBe(null);
    expect(trees[1].querySelector(`li[data-path="${A}.score"] .val`)
      ?.textContent).toBe("30");
    expect(trees[0].querySelector(`li[data-path="${A}.score"] .val`)
      ?.textContent).toBe("0");
  });
