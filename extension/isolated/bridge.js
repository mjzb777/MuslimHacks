// ISOLATED-world content script. Relays batches from detector.js (MAIN world)
// to the service worker. Nothing else — it's a pipe.
(() => {
  "use strict";
  const CHANNEL = "__unseen";

  window.addEventListener("message", (e) => {
    if (e.source !== window || !e.data || e.data[CHANNEL] !== true) return;
    const batch = e.data.batch;
    if (!Array.isArray(batch) || !batch.length) return;
    chrome.runtime.sendMessage({ type: "batch", batch, frameUrl: location.href }).catch(() => {});
  });
})();
