// Step 4: the detector observes the demo page's probe + fingerprint and attributes them.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openDemo, TEST_EXT_ID } from "./helpers.mjs";

let h, events;
before(async () => {
  h = await launch();
  const sw = await h.serviceWorker();
  const { page } = await openDemo(h.context, h.demoUrl);
  await page.waitForTimeout(700); // final batch flush
  events = await sw.evaluate((url) => {
    for (const s of globalThis.__unseen.tabs.values()) {
      if (s.url?.startsWith(url)) return s.events;
    }
    return [];
  }, h.demoUrl);
  await page.close();
});
after(async () => { await h?.close(); });

test("step 4: every probed extension ID is observed, via both <img> and fetch()", () => {
  const probes = events.filter((e) => e.kind === "ext-probe");
  const targets = new Set(probes.map((e) => e.target));
  assert.equal(targets.size, 20, `expected 20 distinct targets, got ${targets.size}`);
  assert.ok(targets.has(TEST_EXT_ID));
  const vias = new Set(probes.filter((e) => e.target === TEST_EXT_ID).map((e) => e.via));
  assert.ok(vias.has("img"), `expected img probe, got ${[...vias]}`);
  assert.ok(vias.has("fetch"), `expected fetch probe, got ${[...vias]}`);
  assert.equal(probes.find((e) => e.target === TEST_EXT_ID && e.via === "fetch").path, "/marker.png");
});

test("step 4: fingerprinting APIs are observed", () => {
  const apis = new Set(events.filter((e) => e.kind === "fp-api").map((e) => e.api));
  for (const api of ["canvas.toDataURL", "canvas.getImageData", "webgl.getParameter", "audio.startRendering", "navigator.hardwareConcurrency", "intl.timeZone"]) {
    assert.ok(apis.has(api), `expected ${api}, got ${[...apis].join(", ")}`);
  }
});

test("step 4: events are attributed to the calling script", () => {
  const origin = new URL(h.demoUrl).origin;
  const probe = events.find((e) => e.kind === "ext-probe" && e.via === "fetch");
  assert.equal(probe.scriptOrigin, origin);
  assert.equal(probe.firstParty, true);
  assert.match(probe.script, /\/probe\.js$/);
  const fp = events.find((e) => e.kind === "fp-api" && e.api === "canvas.toDataURL");
  assert.match(fp.script, /\/fingerprint\.js$/);
  const acted = events.filter((e) => e.kind === "ext-probe" || e.kind === "fp-api");
  assert.equal(acted.every((e) => e.blocked === false), true, "nothing should be blocked in detect-only mode");
  assert.ok(events.some((e) => e.kind === "probe-result" && e.target === TEST_EXT_ID && e.ok === true), "the fake extension's probe should be reported as found");
});
