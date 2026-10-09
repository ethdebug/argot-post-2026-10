// @vitest-environment jsdom
// A slot's "how" with its keccaks' arguments badged: a key in one
// colour, a slot number in another, the same on every side
import { it, expect } from "vitest";
import { howHtml } from "./overlays";

const badges = (h: string) => {
  const d = document.createElement("div");
  d.innerHTML = howHtml(h);
  return [...d.querySelectorAll(".parg")].map((c) =>
    [c.textContent, [...c.classList].find((k) => /^pk\d$/.test(k))]);
};

it("Solidity's key·slot and Vyper's slot·key: the order shows, the " +
  "colours match", () => {
  const sol = badges("keccak(0x7099…79c8, slot 3)");
  const vy = badges("keccak(slot 108, 0x7099…79c8)");
  expect(sol.map(([t]) => t)).toEqual(["0x7099…79c8", "slot 3"]);
  expect(vy.map(([t]) => t)).toEqual(["slot 108", "0x7099…79c8"]);
  expect(sol[0][1]).toBe(vy[1][1]);
  expect(sol[1][1]).toBe(vy[0][1]);
  expect(sol[0][1]).not.toBe(sol[1][1]);
});

it("a nested keccak and a sum: its innermost arguments badged, the text " +
  "kept", () => {
  const h = "keccak(keccak(…b906, slot 3) + 1) + 2";
  const d = document.createElement("div");
  d.innerHTML = howHtml(h);
  expect(d.textContent).toBe(h);
  expect(badges(h).map(([t]) => t)).toEqual(["…b906", "slot 3"]);
  // (no keccak: as it is, escaped)
  expect(howHtml("slot 2 <x>")).toBe("slot 2 &lt;x&gt;");
});
