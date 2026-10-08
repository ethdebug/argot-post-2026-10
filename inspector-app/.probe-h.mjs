import { webkit, chromium, devices } from "@playwright/test";
for (const [n,bt] of [["webkit",webkit],["chromium",chromium]]) {
const b = await bt.launch(); const ctx = await b.newContext({ ...devices["iPhone 13"], colorScheme: "dark" }); const p = await ctx.newPage();
const errs = []; p.on("pageerror", e => errs.push("PE " + e.message.split("\n").slice(0,2).join(" "))); p.on("console", m => m.type()==="error" && errs.push(m.text().split("\n")[0]));
await p.goto("http://10.0.0.224:8765/files/demos/inspector/#mopt=0&mpt=roll", { waitUntil: "load" }); await p.waitForTimeout(5000);
console.log(n, "rows:", await p.locator(".row, [data-slot]").count(), "errors:", [...new Set(errs)].slice(0,4).join(" || "));
await b.close(); }
