// The reader's figures draw from their snapshots: none loads the EVM,
// the run's worker, a build or the scenario (the snapshot build runs
// them, in Node: bin/vite-scenes.ts)
import { test, expect, ready } from "../../page";

for (const scene of ["pitfall-nesting", "pitfall-compiler",
  "optimized-locals"]) {
  test(`${scene}: never loads the EVM, the worker or a build`,
    async ({ page }) => {
      const asked: string[] = [];
      page.on("request", (r) => asked.push(r.url()));
      await ready(page, { scene });
      await page.waitForTimeout(500);
      const evm = /ethereumjs|@ethdebug\/evm|run\/evm|worker|build\.json/;
      expect(asked.filter((u) => evm.test(u) ||
        u.includes("scenario.json"))).toEqual([]);
    });
}
