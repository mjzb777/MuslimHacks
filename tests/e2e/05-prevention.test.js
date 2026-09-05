// Step 8: protection actually prevents. Same page, before and after "Protect me on this site".
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openDemo, TEST_EXT_ID } from "./helpers.mjs";

let h, sw, host, before_;
before(async () => {
  h = await launch();
  sw = await h.serviceWorker();
  host = new URL(h.demoUrl).hostname;
  const { page, results } = await openDemo(h.context, h.demoUrl);
  before_ = results;
  await page.close();
});
after(async () => { await h?.close(); });

test("baseline: unprotected, the site finds the fake Deen Shield", () => {
  assert.equal(before_.found, 1);
  assert.deepEqual(before_.foundIds, [TEST_EXT_ID]);
});

test("step 8: after protecting the site, probes find nothing and the fingerprint changes", async () => {
  await sw.evaluate((host) => globalThis.__unseen.setProtected(host, true), host);
  const registered = await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts());
  assert.equal(registered.length, 1);
  assert.equal(registered[0].world, "MAIN");
  assert.deepEqual(registered[0].matches, [`*://${host}/*`]);

  const { page, results: after_ } = await openDemo(h.context, h.demoUrl);
  assert.equal(after_.probed, 20, "the page still runs its full probe — nothing is broken");
  assert.equal(after_.found, 0, "…but finds nothing");
  assert.notEqual(after_.fingerprint.canvas, before_.fingerprint.canvas, "canvas hash should change");
  assert.notEqual(after_.fingerprint.combined, before_.fingerprint.combined);
  assert.equal(after_.fingerprint.nav.hardwareConcurrency, 4);
  assert.equal(after_.fingerprint.nav.deviceMemory, 8);
  assert.match(after_.fingerprint.webgl, /Generic GPU/);
  assert.equal(after_.fingerprint.nav.timezone, before_.fingerprint.nav.timezone, "time zone is left alone");

  // The extension knows it blocked them.
  await page.waitForTimeout(900);
  const inf = await sw.evaluate((url) => {
    for (const s of globalThis.__unseen.tabs.values()) if (s.url?.startsWith(url)) return s.inference;
  }, h.demoUrl);
  assert.equal(inf.probes.count, 20);
  assert.equal(inf.probes.blocked, inf.probes.attempts);
  assert.equal(inf.probes.found, 0);
  assert.equal(inf.traits[0].trait, "religion", "still explains what the site TRIED to learn");
  await page.close();
});

test("step 8: popup reflects the protected state", async () => {
  const { page } = await openDemo(h.context, h.demoUrl);
  await page.waitForTimeout(900);
  const tabId = await sw.evaluate((url) => { for (const [id, s] of globalThis.__unseen.tabs) if (s.url?.startsWith(url)) return id; }, h.demoUrl);
  const popup = await h.context.newPage();
  await popup.goto(sw.url().replace(/background\/sw\.js$/, `popup/popup.html?tabId=${tabId}`));
  await popup.waitForSelector("#protect");
  assert.equal(await popup.locator("#protect").innerText(), "Protected on this site ✓");
  assert.match(await popup.locator("#learned").innerText(), /Nothing — \d+ probes were blocked/);
  assert.match(await popup.locator("#learned").innerText(), /Fingerprint readings were altered/);
  await popup.close();
  await page.close();
});

test("step 8: turning protection off restores the baseline", async () => {
  await sw.evaluate((host) => globalThis.__unseen.setProtected(host, false), host);
  assert.equal((await sw.evaluate(() => chrome.scripting.getRegisteredContentScripts())).length, 0);
  const { page, results } = await openDemo(h.context, h.demoUrl);
  assert.equal(results.found, 1);
  assert.equal(results.fingerprint.nav.hardwareConcurrency, before_.fingerprint.nav.hardwareConcurrency);
  await page.close();
});
