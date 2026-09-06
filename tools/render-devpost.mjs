// Render every [data-name] frame in a source HTML file to a PNG at its own size.
// Usage: node tools/render-devpost.mjs [documents/devpost/source.html] [documents/devpost/brand.html] ...
// Default: both. Output path = <source dir>/<data-name>.png (subfolders created).
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sources = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ["documents/devpost/source.html", "documents/devpost/brand.html"];

const b = await chromium.launch({ channel: "chromium" });
for (const src of sources) {
  const abs = path.resolve(root, src);
  const dir = path.dirname(abs);
  const p = await b.newPage({ viewport: { width: 2100, height: 1200 }, deviceScaleFactor: 1 });
  await p.goto("file:///" + abs.replace(/\\/g, "/"));
  await p.waitForTimeout(2000);
  const frames = p.locator("[data-name]");
  const n = await frames.count();
  for (let i = 0; i < n; i++) {
    const el = frames.nth(i);
    const name = await el.getAttribute("data-name");
    const out = path.resolve(dir, name + ".png");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const clear = await el.evaluate((e) => e.classList.contains("clear"));
    await el.screenshot({ path: out, omitBackground: clear });
    console.log("saved", path.relative(root, out));
  }
  await p.close();
}
await b.close();
