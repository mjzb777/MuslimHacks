// Step 3: MAIN detector → ISOLATED bridge → service worker. The demo page's "hello"
// must arrive in the SW's per-tab state, and the popup's summary query must answer.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openDemo } from "./helpers.mjs";

let h;
before(async () => { h = await launch(); });
after(async () => { await h?.close(); });

test("step 3: service worker starts and exposes state", async () => {
  const sw = await h.serviceWorker();
  assert.match(sw.url(), /chrome-extension:\/\/[a-p]{32}\/background\/sw\.js$/);
  const hasState = await sw.evaluate(() => typeof globalThis.__unseen?.tabs?.size === "number");
  assert.equal(hasState, true);
});

test("step 3: detector events from the demo page reach the service worker", async () => {
  const sw = await h.serviceWorker();
  const { page } = await openDemo(h.context, h.demoUrl);
  // Give the 250ms batch flush a moment.
  await page.waitForTimeout(600);
  const state = await sw.evaluate((url) => {
    for (const [tabId, s] of globalThis.__unseen.tabs) {
      if (s.url?.startsWith(url) || s.events.some((e) => e.url?.startsWith(url))) {
        return { tabId, url: s.url, kinds: s.events.map((e) => e.kind) };
      }
    }
    return null;
  }, h.demoUrl);
  assert.ok(state, "SW should have state for the demo tab");
  assert.ok(state.kinds.length >= 1, `expected at least one event, got ${JSON.stringify(state.kinds)}`);

  // Popup path: open the popup as a page, pointed at the demo tab.
  const popupUrl = sw.url().replace(/background\/sw\.js$/, `popup/popup.html?tabId=${state.tabId}`);
  const popup = await h.context.newPage();
  await popup.goto(popupUrl);
  await popup.waitForSelector("#protect");
  assert.equal(await popup.locator("#host").innerText(), new URL(h.demoUrl).hostname);
  assert.match(await popup.locator("main").innerText(), /checked which extensions/);
  await popup.close();
  await page.close();
});
