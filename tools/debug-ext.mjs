// Debug: is the test extension loaded, and under which ID?
import { launch, TEST_EXT_DIR, TEST_EXT_ID } from "../tests/e2e/helpers.mjs";

const headless = process.argv.includes("--headed") ? false : true;
const h = await launch({ extensions: [TEST_EXT_DIR], headless });
const page = await h.context.newPage();
page.on("console", (m) => console.log("[console]", m.type(), m.text()));

// 1. Direct navigation to the extension's manifest (works for any installed extension).
for (const path of ["manifest.json", "marker.png"]) {
  try {
    const r = await page.goto(`chrome-extension://${TEST_EXT_ID}/${path}`, { timeout: 5000 });
    console.log(path, "→", r?.status(), (await page.content()).slice(0, 200).replace(/\s+/g, " "));
  } catch (e) {
    console.log(path, "→ navigation failed:", e.message.split("\n")[0]);
  }
}

// 2. What does chrome://extensions think is installed?
await page.goto("chrome://extensions/", { waitUntil: "commit" }).catch((e) => console.log("chrome://extensions:", e.message.split("\n")[0]));
await page.waitForTimeout(1500);
const ids = await page.evaluate(() => {
  const mgr = document.querySelector("extensions-manager");
  const list = mgr?.shadowRoot?.querySelector("extensions-item-list");
  const items = list?.shadowRoot?.querySelectorAll("extensions-item") ?? [];
  return [...items].map((i) => ({ id: i.id, name: i.shadowRoot?.querySelector("#name")?.textContent?.trim() }));
});
console.log("installed:", JSON.stringify(ids));
console.log("headless:", headless, "| expected id:", TEST_EXT_ID);

await h.close();
