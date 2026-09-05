// Steps 6 & 7: the service worker aggregates and badges; the popup renders the card.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openDemo, TEST_EXT_ID } from "./helpers.mjs";

let h, sw, tabId, page;
before(async () => {
  h = await launch();
  sw = await h.serviceWorker();
  ({ page } = await openDemo(h.context, h.demoUrl));
  await page.waitForTimeout(900); // batch flush + 300ms analyse debounce
  tabId = await sw.evaluate((url) => {
    for (const [id, s] of globalThis.__unseen.tabs) if (s.url?.startsWith(url)) return id;
    return null;
  }, h.demoUrl);
  assert.ok(tabId !== null, "demo tab should be tracked");
});
after(async () => { await h?.close(); });

test("step 6: inference is computed and the badge is set", async () => {
  const { badge, color, inf } = await sw.evaluate(async (tabId) => {
    const s = globalThis.__unseen.tabs.get(tabId);
    return {
      badge: await chrome.action.getBadgeText({ tabId }),
      color: await chrome.action.getBadgeBackgroundColor({ tabId }),
      inf: s.inference,
    };
  }, tabId);
  assert.ok(inf, "inference should be cached on the tab state");
  assert.equal(inf.probes.count, 20);
  assert.equal(inf.probes.found, 1, "the fake Deen Shield should be the one found");
  assert.equal(inf.probes.targets.find((t) => t.id === TEST_EXT_ID).found, true);
  assert.equal(inf.fingerprint.detected, true);
  assert.equal(inf.traits[0].trait, "religion");
  assert.equal(badge, String(inf.traits.length));
  assert.deepEqual(color.slice(0, 3), [0xc6, 0x28, 0x28], "high severity → red badge");
});

test("step 6: site summary is persisted locally", async () => {
  const sites = await sw.evaluate(async () => (await chrome.storage.local.get("sites")).sites);
  const host = new URL(h.demoUrl).hostname;
  assert.ok(sites?.[host], `expected a record for ${host}`);
  assert.equal(sites[host].severity, "high");
  assert.ok(sites[host].traits.includes("religion"));
});

test("step 7: popup renders the plain-language card", async () => {
  const popup = await h.context.newPage();
  await popup.goto(sw.url().replace(/background\/sw\.js$/, `popup/popup.html?tabId=${tabId}`));
  await popup.waitForSelector("#traits");

  const text = await popup.locator("main").innerText();
  assert.match(text, /This site checked which extensions you have installed\./);
  assert.match(text, /looked for 20 extensions/);
  assert.match(text, /device fingerprint/);
  assert.match(text, /Done by the site's own code/);

  const religion = popup.locator('.trait[data-trait="religion"]');
  assert.equal(await religion.count(), 1);
  assert.match(await religion.innerText(), /Religion[\s\S]*probed for Deen Shield/);
  // High sensitivity rows come first.
  const first = await popup.locator(".trait").first().getAttribute("data-trait");
  assert.equal(first, "religion");

  assert.match(await popup.locator("#learned").innerText(), /1 of 20[\s\S]*Deen Shield/);
  assert.equal(await popup.locator("#protect").innerText(), "Protect me on this site");
  assert.match(text, /Nothing is sent anywhere/);
  await popup.close();
});

test("step 7: a quiet page shows the all-clear", async () => {
  const quiet = await h.context.newPage();
  await quiet.goto(h.demoUrl + "probe.js"); // plain JS file: no probing, no fingerprinting
  await quiet.waitForTimeout(500);
  const quietTabId = await sw.evaluate(async (url) => {
    const [t] = await chrome.tabs.query({ url: url + "*" });
    return t?.id;
  }, h.demoUrl + "probe.js");
  const popup = await h.context.newPage();
  await popup.goto(sw.url().replace(/background\/sw\.js$/, `popup/popup.html?tabId=${quietTabId}`));
  await popup.waitForSelector(".headline");
  assert.match(await popup.locator("main").innerText(), /Nothing suspicious so far/);
  assert.equal(await sw.evaluate((id) => chrome.action.getBadgeText({ tabId: id }), quietTabId), "");
  await popup.close();
  await quiet.close();
});
