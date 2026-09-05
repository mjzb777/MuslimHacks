// MAIN-world content script. Runs at document_start, before any page script.
// It has NO access to chrome.* APIs — it only observes browser API calls and
// reports them to bridge.js (ISOLATED world) via window.postMessage.
//
// Deliberately dumb: no data, no judgement. It answers two questions —
//   1. did a script try to load a chrome-extension:// URL (extension probing)?
//   2. did a script touch APIs commonly used for fingerprinting?
// and attributes each to the calling script. Everything else lives in the SW.
//
// Protection (per site, opt-in): when protect-flag.js has set window.__unseenProtect,
//   - every chrome-extension:// probe is rewritten to a non-existent extension, so the
//     browser itself produces the genuine "not installed" failure with genuine timing;
//   - fingerprint readouts are perturbed (canvas/audio low bits) or made generic
//     (hardware counts, GPU strings). Nothing network-level is touched.
(() => {
  "use strict";
  const CHANNEL = "__unseen";
  const EXT_URL = /^(?:chrome|moz)-extension:\/\/([a-p]{32}|[0-9a-f-]{36})(\/[^?#]*)?/i;
  const DEAD_ID = "a".repeat(32); // a valid-looking id that no extension has
  const pageOrigin = location.origin;

  // ---- transport: batch events, flush every 250ms ------------------------------------
  const queue = [];
  let flushScheduled = false;
  function emit(event) {
    queue.push(event);
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(flush, 250);
    }
  }
  function flush() {
    flushScheduled = false;
    if (!queue.length) return;
    window.postMessage({ [CHANNEL]: true, batch: queue.splice(0, queue.length) }, "*");
  }

  // ---- protection flag: read lazily at call time -------------------------------------
  const protectOn = () => window.__unseenProtect === true;

  // ---- attribution: which script called us? ------------------------------------------
  const ownPrefix = (() => {
    try {
      const m = (new Error().stack || "").match(/((?:chrome|moz)-extension:\/\/[^/]+)\//);
      return m ? m[1] : null;
    } catch { return null; }
  })();
  function caller() {
    let stack = "";
    try { stack = new Error().stack || ""; } catch {}
    const urls = stack.match(/(?:https?|blob|chrome-extension|moz-extension):\/\/[^\s)]+/g) || [];
    for (const raw of urls) {
      if (ownPrefix && raw.startsWith(ownPrefix)) continue;
      const script = raw.replace(/:\d+:\d+$/, "");
      let scriptOrigin = "";
      try { scriptOrigin = new URL(script).origin; } catch {}
      return { script, scriptOrigin, firstParty: scriptOrigin === pageOrigin };
    }
    // Inline script or unknown: attribute to the page itself.
    return { script: location.href, scriptOrigin: pageOrigin, firstParty: true };
  }

  // ---- patch helpers -------------------------------------------------------------------
  function patch(obj, name, factory) {
    try {
      const orig = obj && obj[name];
      if (typeof orig !== "function") return;
      Object.defineProperty(obj, name, { value: factory(orig), writable: true, configurable: true });
    } catch {}
  }
  // onSet(value) may return a replacement value (protect mode rewrites probe URLs).
  function patchSetter(proto, prop, onSet) {
    try {
      const d = Object.getOwnPropertyDescriptor(proto, prop);
      if (!d || !d.set) return;
      Object.defineProperty(proto, prop, {
        ...d,
        set(v) { const nv = onSet.call(this, v); return d.set.call(this, nv === undefined ? v : nv); },
      });
    } catch {}
  }
  // onGet(realValue) may return a replacement value.
  function patchGetter(proto, prop, onGet) {
    try {
      const d = Object.getOwnPropertyDescriptor(proto, prop);
      if (!d || !d.get) return;
      Object.defineProperty(proto, prop, {
        ...d,
        get() { const r = d.get.call(this); const o = onGet(r); return o === undefined ? r : o; },
      });
    } catch {}
  }

  // ---- 1. extension probing ------------------------------------------------------------
  function urlOf(input) {
    try {
      if (typeof input === "string") return input;
      if (input instanceof URL) return input.href;
      if (input && typeof input.url === "string") return input.url; // Request
    } catch {}
    return String(input ?? "");
  }
  /**
   * Records a probe attempt. Returns null if `url` isn't a probe, else
   * { target, url } where url is rewritten to a dead extension in protect mode.
   */
  function checkProbe(url, via) {
    const m = EXT_URL.exec(url);
    if (!m) return null;
    const target = m[1].toLowerCase();
    if (target === DEAD_ID) return null; // our own rewrite passing back through a wrapper
    const blocked = protectOn();
    emit({ kind: "ext-probe", target, path: m[2] || "/", via, ...caller(), blocked, ts: Date.now() });
    return { target, url: blocked ? url.replace(m[1], DEAD_ID) : url };
  }
  // Did the probe succeed? That's what the site actually learned.
  function probeResult(target, ok) {
    emit({ kind: "probe-result", target, ok: !!ok, ts: Date.now() });
  }
  // Watch an element whose src/href was just set to a probe URL.
  function watchElement(el, target) {
    try {
      const done = (ok) => () => { el.removeEventListener("load", onLoad); el.removeEventListener("error", onError); probeResult(target, ok); };
      const onLoad = done(true), onError = done(false);
      el.addEventListener("load", onLoad, { once: true });
      el.addEventListener("error", onError, { once: true });
    } catch {}
  }

  patch(window, "fetch", (orig) => function fetch(input, init) {
    const p0 = checkProbe(urlOf(input), "fetch");
    if (p0 && p0.url !== urlOf(input)) {
      try { input = input instanceof Request ? new Request(p0.url, input) : p0.url; } catch { input = p0.url; }
    }
    const p = orig.call(this, input, init);
    if (p0) p.then((r) => probeResult(p0.target, r.ok), () => probeResult(p0.target, false));
    return p;
  });
  patch(XMLHttpRequest.prototype, "open", (orig) => function open(method, url, ...rest) {
    const p0 = checkProbe(urlOf(url), "xhr");
    if (p0) {
      url = p0.url;
      this.addEventListener("load", () => probeResult(p0.target, this.status >= 200 && this.status < 300), { once: true });
      this.addEventListener("error", () => probeResult(p0.target, false), { once: true });
    }
    return orig.call(this, method, url, ...rest);
  });
  for (const [proto, prop, via] of [
    [HTMLImageElement.prototype, "src", "img"],
    [HTMLScriptElement.prototype, "src", "script"],
    [HTMLLinkElement.prototype, "href", "link"],
    [HTMLIFrameElement.prototype, "src", "iframe"],
    [HTMLEmbedElement.prototype, "src", "embed"],
    [HTMLObjectElement.prototype, "data", "object"],
    [HTMLSourceElement.prototype, "src", "source"],
    [HTMLMediaElement.prototype, "src", "media"],
  ]) {
    patchSetter(proto, prop, function (v) {
      const p0 = checkProbe(urlOf(v), via);
      if (!p0) return undefined;
      watchElement(this, p0.target);
      return p0.url;
    });
  }
  patch(Element.prototype, "setAttribute", (orig) => function setAttribute(name, value) {
    const n = String(name).toLowerCase();
    if (n === "src" || n === "href" || n === "data") {
      const p0 = checkProbe(urlOf(value), "attr:" + n);
      if (p0) { watchElement(this, p0.target); value = p0.url; }
    }
    return orig.call(this, name, value);
  });
  // Markup inserted via innerHTML / the parser bypasses setters; watch the DOM too.
  try {
    const setAttr = Element.prototype.setAttribute; // already wrapped: rewrites in protect mode
    const mo = new MutationObserver((records) => {
      for (const r of records) {
        if (r.type === "attributes") {
          const v = r.target.getAttribute(r.attributeName) || "";
          const p0 = checkProbe(v, "dom:" + r.attributeName);
          if (p0 && p0.url !== v) setAttr.call(r.target, r.attributeName, p0.url);
          continue;
        }
        for (const n of r.addedNodes) {
          if (n.nodeType !== 1) continue;
          for (const a of ["src", "href", "data"]) {
            const v = n.getAttribute?.(a);
            if (!v) continue;
            const p0 = checkProbe(v, "dom:" + a);
            if (p0 && p0.url !== v) setAttr.call(n, a, p0.url);
          }
        }
      }
    });
    mo.observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ["src", "href", "data"] });
  } catch {}
  // externally_connectable probing: chrome.runtime.sendMessage(<extension id>, …)
  try {
    const rt = window.chrome && window.chrome.runtime;
    if (rt && typeof rt.sendMessage === "function") {
      patch(rt, "sendMessage", (orig) => function sendMessage(first, ...rest) {
        if (typeof first === "string" && /^[a-p]{32}$/.test(first)) {
          const blocked = protectOn();
          emit({ kind: "ext-probe", target: first, path: "(runtime.sendMessage)", via: "message", ...caller(), blocked, ts: Date.now() });
          if (blocked) first = DEAD_ID;
        }
        return orig.apply(this, [first, ...rest]);
      });
    }
  } catch {}

  // ---- 2. fingerprinting surface -------------------------------------------------------
  // Rate-limit per API (cheap) before computing a stack trace (expensive), then dedupe
  // per API+script for 2s so a hot loop doesn't flood the channel.
  const apiLast = new Map();
  const seen = new Map();
  function fp(api) {
    const now = Date.now();
    if (now - (apiLast.get(api) || 0) < 100) return;
    apiLast.set(api, now);
    const c = caller();
    const key = api + "|" + c.script;
    if (now - (seen.get(key) || 0) < 2000) return;
    seen.set(key, now);
    emit({ kind: "fp-api", api, ...c, blocked: protectOn(), ts: now });
  }
  function patchMethod(proto, name, api, harden) {
    patch(proto, name, (orig) => function (...args) {
      fp(api);
      if (harden && protectOn()) return harden.call(this, orig, args);
      return orig.apply(this, args);
    });
  }
  function counted(proto, name, api, threshold) {
    let count = 0, windowStart = 0;
    patch(proto, name, (orig) => function (...args) {
      const now = Date.now();
      if (now - windowStart > 2000) { windowStart = now; count = 0; }
      if (++count === threshold) fp(api);
      return orig.apply(this, args);
    });
  }

  // Hardening helpers (protect mode only). Originals captured before wrapping.
  const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
  const origPutImageData = CanvasRenderingContext2D.prototype.putImageData;
  const origGetContext = HTMLCanvasElement.prototype.getContext;
  function perturbCanvas(canvas) {
    // Flip the low bit of one channel of one pixel. Invisible; changes every hash.
    try {
      const ctx = origGetContext.call(canvas, "2d");
      if (!ctx || !canvas.width || !canvas.height) return;
      const x = canvas.width - 1, y = canvas.height - 1;
      const px = origGetImageData.call(ctx, x, y, 1, 1);
      px.data[0] ^= 1;
      origPutImageData.call(ctx, px, x, y);
    } catch {}
  }
  const noisedBuffers = new WeakSet();

  patchMethod(HTMLCanvasElement.prototype, "toDataURL", "canvas.toDataURL", function (orig, args) {
    perturbCanvas(this);
    return orig.apply(this, args);
  });
  patchMethod(HTMLCanvasElement.prototype, "toBlob", "canvas.toBlob", function (orig, args) {
    perturbCanvas(this);
    return orig.apply(this, args);
  });
  patchMethod(CanvasRenderingContext2D.prototype, "getImageData", "canvas.getImageData", function (orig, args) {
    const img = orig.apply(this, args);
    try { if (img?.data?.length) img.data[0] ^= 1; } catch {}
    return img;
  });
  const GENERIC_GL = { 0x9245: "Google Inc.", 0x9246: "ANGLE (Generic GPU)", 0x1f00: "WebKit", 0x1f01: "WebKit WebGL" };
  const hardenGL = function (orig, args) {
    const r = orig.apply(this, args);
    return typeof r === "string" && GENERIC_GL[args[0]] ? GENERIC_GL[args[0]] : r;
  };
  if (window.WebGLRenderingContext) patchMethod(WebGLRenderingContext.prototype, "getParameter", "webgl.getParameter", hardenGL);
  if (window.WebGL2RenderingContext) patchMethod(WebGL2RenderingContext.prototype, "getParameter", "webgl.getParameter", hardenGL);
  if (window.OfflineAudioContext) patchMethod(OfflineAudioContext.prototype, "startRendering", "audio.startRendering");
  if (window.AudioBuffer) patchMethod(AudioBuffer.prototype, "getChannelData", "audio.getChannelData", function (orig, args) {
    const data = orig.apply(this, args);
    try {
      if (!noisedBuffers.has(data)) {
        noisedBuffers.add(data);
        for (let i = 0; i < data.length; i++) data[i] += (Math.random() - 0.5) * 1e-5;
      }
    } catch {}
    return data;
  });
  if (window.AnalyserNode) patchMethod(AnalyserNode.prototype, "getFloatFrequencyData", "audio.getFloatFrequencyData");

  const GENERIC_NAV = { hardwareConcurrency: 4, deviceMemory: 8 };
  for (const prop of ["hardwareConcurrency", "deviceMemory", "plugins", "languages", "platform"]) {
    patchGetter(Navigator.prototype, prop, () => {
      fp("navigator." + prop);
      return protectOn() && prop in GENERIC_NAV ? GENERIC_NAV[prop] : undefined;
    });
  }
  patchMethod(Intl.DateTimeFormat.prototype, "resolvedOptions", "intl.timeZone"); // observe only: faking tz breaks sites
  // Font enumeration = many measureText / fonts.check calls in a short window.
  counted(CanvasRenderingContext2D.prototype, "measureText", "fonts.measureText", 30);
  if (window.FontFaceSet) counted(FontFaceSet.prototype, "check", "fonts.check", 30);

  // Make sure anything still queued goes out when the page is torn down.
  addEventListener("pagehide", flush, true);
})();
