// Screenshot the popup as rendered for a page (default: the demo page).
// Usage: node tools/screenshot-popup.mjs [out.png] [--protect] [--zoom 2] [https://site]
import { launch, openDemo } from "../tests/e2e/helpers.mjs";
const argv = process.argv;
const out = argv.find((a) => a.endsWith(".png")) ?? "popup.png";
const protect = argv.includes("--protect");
const zoom = Number(argv[argv.indexOf("--zoom") + 1]) || 1; // render at N× for print/devpost images
const site = argv.find((a) => a.startsWith("http"));
const h = await launch();
const sw = await h.serviceWorker();
const url = site ?? h.demoUrl;
if (protect) await sw.evaluate((host) => globalThis.__unseen.setProtected(host, true), new URL(url).hostname);
let page;
if (site) {
  page = await h.context.newPage();
  await page.goto(site, { waitUntil: "load", timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(8000);
} else {
  ({ page } = await openDemo(h.context, h.demoUrl));
}
await page.waitForTimeout(900);
const tabId = await sw.evaluate((url) => { for (const [id, s] of globalThis.__unseen.tabs) if (s.url?.startsWith(url)) return id; }, url.replace(/\/$/, ""));
const popup = await h.context.newPage();
await popup.setViewportSize({ width: Math.round(392 * zoom), height: Math.round(900 * zoom) });
await popup.goto(sw.url().replace(/background\/sw\.js$/, `popup/popup.html?tabId=${tabId}`));
await popup.waitForSelector("#protect");
if (zoom !== 1) await popup.evaluate((z) => { document.body.style.zoom = String(z); }, zoom);
await popup.waitForTimeout(200);
await popup.screenshot({ path: out, fullPage: true });
if (!site) console.log("demo readout:", await page.locator("#readout").innerText());
console.log("saved", out);
await h.close();
