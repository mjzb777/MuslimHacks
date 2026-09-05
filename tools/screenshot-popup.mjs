// Screenshot the popup as rendered for the demo tab. Usage: node tools/screenshot-popup.mjs [out.png] [--protect]
import { launch, openDemo } from "../tests/e2e/helpers.mjs";
const out = process.argv.find((a) => a.endsWith(".png")) ?? "popup.png";
const protect = process.argv.includes("--protect");
const h = await launch();
const sw = await h.serviceWorker();
let { page } = await openDemo(h.context, h.demoUrl);
if (protect) {
  await sw.evaluate((host) => globalThis.__unseen.setProtected(host, true), new URL(h.demoUrl).hostname);
  await page.reload();
  await page.waitForFunction(() => window.__demoResults !== undefined);
}
await page.waitForTimeout(900);
const tabId = await sw.evaluate((url) => { for (const [id, s] of globalThis.__unseen.tabs) if (s.url?.startsWith(url)) return id; }, h.demoUrl);
const popup = await h.context.newPage();
await popup.setViewportSize({ width: 392, height: 900 });
await popup.goto(sw.url().replace(/background\/sw\.js$/, `popup/popup.html?tabId=${tabId}`));
await popup.waitForSelector("#protect");
await popup.waitForTimeout(200);
await popup.screenshot({ path: out, fullPage: true });
console.log("demo readout:", await page.locator("#readout").innerText());
console.log("saved", out);
await h.close();
