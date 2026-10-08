// @vitest-environment jsdom
import { it, expect, afterEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";
import { Lens } from "../ui/Lens";
import { testProject } from "../../test/project";
import { slow } from "../../test/lens";
import { A } from "../../test/expect";
import { vyper } from "./vyper";

afterEach(cleanup);

it("Solidity's rule reads zeros; Vyper's own layout, badged hand-written,"
  + " reads the values", async () => {
  const project = await testProject();
  const { container } = render(<Lens spec={vyper} project={project} />);
  await waitFor(() => expect(container.querySelectorAll(
    ".tree li[data-path]").length).toBeGreaterThan(8), slow);
  const trees = [...container.querySelectorAll(".tree")];
  await waitFor(() => expect(trees[1].querySelector(".handmade"))
    .not.toBe(null), slow);
  expect(trees[0].querySelector(".handmade")).toBe(null);
  expect(trees[1].querySelector(`li[data-path="${A}.score"] .val`)
    ?.textContent).toBe("30");
  expect(trees[0].querySelector(`li[data-path="${A}.score"] .val`)
    ?.textContent).toBe("0");
});
