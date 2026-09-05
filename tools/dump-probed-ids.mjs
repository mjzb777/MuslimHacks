// Visit a probing site and dump every extension ID it probed, for cross-referencing.
import { launch } from "../tests/e2e/helpers.mjs";
import { writeFileSync } from "node:fs";
const url = process.argv[2] || "https://browserleaks.com/chrome";
const out = process.argv[3] || "probed-ids.json";
const h = await launch();
const sw = await h.serviceWorker();
const page = await h.context.newPage();
await page.goto(url, { waitUntil: "load", timeout: 45000 }).catch(() => {});
await page.waitForTimeout(8000);
const ids = await sw.evaluate(() => {
  for (const s of globalThis.__unseen.tabs.values()) {
    const set = new Set(s.events.filter((e) => e.kind === "ext-probe").map((e) => e.target));
    if (set.size) return [...set];
  }
  return [];
});
writeFileSync(out, JSON.stringify(ids));
console.log(`${ids.length} ids → ${out}`);
await h.close();
