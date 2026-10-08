import { it, expect } from "vitest";
import { testProject } from "../../test/project";
import { decode } from "./decode";
import { derivation } from "./derivation";

const at = async (o: string, pt: string) => {
  const p = await testProject();
  const dc = p.decodings[`mem:${o}`];
  const t = await p.timeline(dc.timeline);
  return { d: await decode(p, dc, pt),
    snap: t.points.find((x) => x.id === pt)!.snapshot };
};

it("O0, m before m = combo: the frame word, then m's at frame + 88",
  async () => {
    const { d, snap } = await at("O0", "O0/mult:0");
    const s = derivation(d, snap, "m")!;
    expect(s.map((x) => x.kind)).toEqual(["start", "region", "region",
      "result"]);
    const [, frame, m, res] = s;
    expect(frame).toMatchObject({ name: "-frame", eval:
      "offset 128; length 32: the frame's address, 0x0680" });
    expect(m.kind === "region" && m.fields[0]).toMatchObject({
      field: "offset", expr: { "~sum": [{ "~read": "-frame" }, 88] },
      args: [{ value: expect.stringMatching(/^0x0*680$/) },
        { value: expect.stringMatching(/^0x0*58$/) }] });
    expect(res.eval).toBe("memory 0x06d8–0x06df = 5");
  });

it("O2: one region at a fixed offset; hit's last byte at 0x120",
  async () => {
    const { d, snap } = await at("O2", "O2/roll");
    const s = derivation(d, snap, "hit")!;
    expect(s.map((x) => x.kind)).toEqual(["start", "region", "result"]);
    expect(s[2].eval).toBe("memory 0x013f = true");
  });
