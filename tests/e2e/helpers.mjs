// Shared Playwright harness: real Chrome, both extensions loaded, demo served on localhost.
import { chromium } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { startDemoServer } from "../../tools/serve-demo.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
export const EXT_DIR = join(root, "extension");
export const TEST_EXT_DIR = join(root, "test-extension");
export const TEST_EXT_ID = "clogkfmebiojffofnmadeeekpjpppeop";

/**
 * @param {{extensions?: string[], headless?: boolean}} opts
 */
export async function launch({ extensions = [EXT_DIR, TEST_EXT_DIR], headless = true } = {}) {
  const profile = await mkdtemp(join(tmpdir(), "mh-profile-"));
  const demo = await startDemoServer();
  // NOTE: branded Google Chrome (137+) silently ignores --load-extension. Playwright's bundled
  // Chromium honours it, in headed and (new) headless mode. `npx playwright install chromium`.
  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless,
    args: [
      `--disable-extensions-except=${extensions.join(",")}`,
      `--load-extension=${extensions.join(",")}`,
    ],
  });
  return {
    context,
    demoUrl: demo.url,
    /** Wait for our extension's MV3 service worker and return it. */
    async serviceWorker() {
      let [sw] = context.serviceWorkers();
      if (!sw) sw = await context.waitForEvent("serviceworker");
      return sw;
    },
    async close() {
      await context.close();
      await demo.close();
      await rm(profile, { recursive: true, force: true }).catch(() => {});
    },
  };
}

/** Open the demo page and wait for it to finish its probe + fingerprint. */
export async function openDemo(context, demoUrl) {
  const page = await context.newPage();
  await page.goto(demoUrl);
  await page.waitForFunction(() => window.__demoResults !== undefined, null, { timeout: 15000 });
  const results = await page.evaluate(() => window.__demoResults);
  return { page, results };
}
