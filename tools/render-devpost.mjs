// Render documents/devpost/source.html frames to 1920×1080 PNGs for the Devpost gallery.
// Usage: node tools/render-devpost.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const names = ["01-cover", "02-problem", "03-before-after", "04-real-sites", "05-how-it-works", "06-numbers"];
const b = await chromium.launch({ channel: "chromium" });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await p.goto("file:///" + path.join(root, "documents/devpost/source.html").replace(/\\/g, "/"));
await p.waitForTimeout(2000);
for (let i = 0; i < names.length; i++) {
  await p.locator("#f" + (i + 1)).screenshot({ path: path.join(root, "documents/devpost", names[i] + ".png") });
  console.log("saved", names[i] + ".png");
}
await b.close();
