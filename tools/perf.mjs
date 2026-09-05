// Page-load overhead: demo page with vs. without the extension, N runs each, median.
import { launch } from "../tests/e2e/helpers.mjs";
import { TEST_EXT_DIR, EXT_DIR } from "../tests/e2e/helpers.mjs";
const N = Number(process.argv[2]) || 7;
async function measure(extensions, label) {
  const h = await launch({ extensions });
  const times = [], probeMs = [];
  for (let i = 0; i < N; i++) {
    const page = await h.context.newPage();
    const t0 = Date.now();
    await page.goto(h.demoUrl, { waitUntil: "load" });
    const load = Date.now() - t0;
    await page.waitForFunction(() => window.__demoResults !== undefined);
    const r = await page.evaluate(() => window.__demoResults);
    times.push(load); probeMs.push(r.ms);
    await page.close();
  }
  await h.close();
  const med = (a) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  console.log(`${label.padEnd(22)} load median ${med(times)} ms   probe+fingerprint median ${med(probeMs)} ms   (n=${N})`);
}
await measure([TEST_EXT_DIR], "without Unseen");
await measure([EXT_DIR, TEST_EXT_DIR], "with Unseen (detect)");
