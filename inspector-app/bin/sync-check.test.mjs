import test from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "./vanilla.mjs";

// run sync-check.sh with a ledger and a tasks-done list of our own, up
// to a fixed vanilla commit (main moves)
const UPTO = "c3dd6a82da76ee244fb14df486f9a6a9e1696f1b";
function check(ledger, done) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "sync-check-"));
  fs.writeFileSync(path.join(d, "ledger.tsv"), ledger);
  fs.writeFileSync(path.join(d, "done"), done);
  const r = spawnSync("sh", [path.join(app, "bin", "sync-check.sh")],
    { env: { ...process.env, LEDGER: path.join(d, "ledger.tsv"),
      DONE: path.join(d, "done"), UPTO }, encoding: "utf8" });
  fs.rmSync(d, { recursive: true });
  return r;
}
const real = fs.readFileSync(path.join(app, "sync-ledger.tsv"), "utf8");
const header = "vanilla sha\tsubject\tport\n";

test("the real ledger and tasks-done pass (to c3dd6a8)", () => {
  const r = check(real, fs.readFileSync(path.join(app, "tasks-done"),
    "utf8"));
  assert.strictEqual(r.status, 0, r.stdout);
});

test("a deferred entry is open, and listed, while its task is not done",
  () => {
    const r = check(header + "da55848\tx\tdeferred: T4.5, T5.2\n" +
      real.split("\n").slice(1).filter((l) => !l.startsWith("da55848"))
        .join("\n"), "T1.1\nT5.2\n");
    assert.strictEqual(r.status, 0, r.stdout);
    assert.match(r.stdout, /open: da55848 .*T4\.5, T5\.2/);
  });

test("a deferred entry whose tasks are all done fails", () => {
  const r = check(header + "da55848\tx\tdeferred: T4.5, T5.2\n" +
    real.split("\n").slice(1).filter((l) => !l.startsWith("da55848"))
      .join("\n"), "T4.5\nT5.2\n");
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /da55848.*tasks done but not ported/);
});

test("a vanilla commit missing from the ledger fails", () => {
  const r = check(header, "");
  assert.strictEqual(r.status, 1);
  assert.match(r.stdout, /not in the ledger/);
});
