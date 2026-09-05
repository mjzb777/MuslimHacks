// Steps 1 & 2: the fake target extension is probeable, and the demo page's readout is correct
// WITHOUT our privacy extension loaded. This is the unprotected baseline.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { launch, openDemo, TEST_EXT_DIR, TEST_EXT_ID } from "./helpers.mjs";

let h;
before(async () => { h = await launch({ extensions: [TEST_EXT_DIR] }); });
after(async () => { await h?.close(); });

test("step 1: fake extension's web-accessible resource resolves from a web page", async () => {
  const page = await h.context.newPage();
  await page.goto(h.demoUrl);
  const ok = await page.evaluate(
    (id) => fetch(`chrome-extension://${id}/marker.png`).then((r) => r.ok).catch(() => false),
    TEST_EXT_ID,
  );
  assert.equal(ok, true, "marker.png should load (extension is installed and exposes it)");
  await page.close();
});

test("step 2: demo readout shows 20 probed, 1 found, and a fingerprint", async () => {
  const { page, results } = await openDemo(h.context, h.demoUrl);
  assert.equal(results.probed, 20);
  assert.equal(results.found, 1);
  assert.deepEqual(results.foundIds, [TEST_EXT_ID]);
  assert.match(results.fingerprint.canvas, /^[0-9a-f]{8}$/);
  assert.notEqual(results.fingerprint.audio, "unavailable");
  const text = await page.locator("#readout").innerText();
  assert.match(text, /extensions probed: 20\s+found: 1 \(Deen Shield/);
  await page.close();
});
