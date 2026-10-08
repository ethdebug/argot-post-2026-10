// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { Lens } from "../ui/Lens";
import { slotHex } from "../engine/hex";
import { testProject } from "../../test/project";
import { slow } from "../../test/lens";
import { A } from "../../test/expect";
import { alicePlays } from "./alice-plays";

afterEach(cleanup);

it("two literal points compare; the tree keeps the filter's roots",
  async () => {
    const project = await testProject();
    const { container } = render(<Lens spec={alicePlays}
      project={project} />);
    const slot2 = slotHex(2n);
    await waitFor(() => expect(container.querySelectorAll(
      `.view .wrow[data-slot="${slot2}"] .b.chg`).length)
      .toBeGreaterThan(0), slow);
    expect(container.querySelectorAll(".view")).toHaveLength(2);
    await waitFor(() => expect(container.querySelectorAll(
      ".tree li[data-path]").length).toBeGreaterThan(0), slow);
    const paths = [...container.querySelectorAll<HTMLElement>(
      ".tree li[data-path]")].map((li) => li.dataset.path!);
    expect(paths.filter((p) => !p.startsWith(A)))
      .toEqual(["totalScore", "totalHits", "players"].filter((p) =>
        paths.includes(p)));
    expect(paths).toContain(`${A}.score`);
    expect(paths.some((p) => p.startsWith("players[0x3c44"))).toBe(false);
    expect(paths).not.toContain("playerList");
    // (the score changed: its row says so)
    expect(container.querySelector(`li[data-path="${A}.score"]`)!
      .classList.contains("chg")).toBe(true);
  });
