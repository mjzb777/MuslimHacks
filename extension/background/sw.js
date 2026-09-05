// Module service worker. Receives raw detector batches from bridge.js, keeps per-tab
// state, runs inference, sets the badge, answers the popup, and remembers per-site
// protection. Everything stays in chrome.storage.local — nothing leaves the browser.
import { infer, severity } from "./inference.js";

/** @type {Map<number, {url: string, events: any[], inference?: any, dirty: boolean}>} */
const tabs = new Map();
globalThis.__unseen = { tabs }; // exposed for tests

// Load the extension→trait map lazily; listeners below must be registered synchronously.
let extensionMapPromise = null;
function extensionMap() {
  extensionMapPromise ??= fetch(chrome.runtime.getURL("data/extensions.json"))
    .then((r) => r.json())
    .then((m) => { delete m._comment; return m; })
    .catch(() => ({}));
  return extensionMapPromise;
}

function hostOf(url) {
  try { return new URL(url).hostname; } catch { return ""; }
}

function tabState(tabId, url) {
  let s = tabs.get(tabId);
  if (!s) {
    s = { url, events: [], inference: null, dirty: true };
    tabs.set(tabId, s);
  }
  if (url && !s.url) s.url = url;
  return s;
}

// ---- inference + badge (debounced per tab) --------------------------------------------
const BADGE_COLOR = { high: "#c62828", medium: "#ef6c00", low: "#616161", none: "#616161" };
const pending = new Map();
function scheduleAnalyse(tabId) {
  if (pending.has(tabId)) return;
  pending.set(tabId, setTimeout(() => { pending.delete(tabId); analyse(tabId).catch(() => {}); }, 300));
}
async function analyse(tabId) {
  const s = tabs.get(tabId);
  if (!s) return null;
  if (s.dirty || !s.inference) {
    s.inference = infer(s.events, await extensionMap());
    s.dirty = false;
    const sev = severity(s.inference);
    const n = s.inference.traits.length;
    const text = sev === "none" ? "" : n ? String(n) : "!";
    chrome.action.setBadgeText({ tabId, text }).catch(() => {});
    chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR[sev] }).catch(() => {});
    rememberSite(s).catch(() => {});
  }
  return s.inference;
}
globalThis.__unseen.analyse = analyse; // for tests/tools

// ---- persistence ------------------------------------------------------------------------
async function rememberSite(s) {
  const host = hostOf(s.url);
  if (!host || !s.inference) return;
  const { sites = {} } = await chrome.storage.local.get("sites");
  sites[host] = {
    lastSeen: Date.now(),
    severity: severity(s.inference),
    probes: s.inference.probes.count,
    fingerprint: s.inference.fingerprint.detected,
    traits: s.inference.traits.map((t) => t.trait),
  };
  await chrome.storage.local.set({ sites });
}
async function protectedHosts() {
  const { protectedHosts = [] } = await chrome.storage.local.get("protectedHosts");
  return protectedHosts;
}
async function setProtected(host, on) {
  const list = new Set(await protectedHosts());
  on ? list.add(host) : list.delete(host);
  await chrome.storage.local.set({ protectedHosts: [...list] });
  if (on) await registerProtectFlag(host);
  else await chrome.scripting.unregisterContentScripts({ ids: [flagId(host)] }).catch(() => {});
}
globalThis.__unseen.setProtected = setProtected; // for tests

// ---- protection: inject the MAIN-world flag on protected sites --------------------------
const flagId = (host) => "protect:" + host;
function matchesFor(host) {
  // Match patterns ignore ports. Wildcard subdomains only make sense for DNS names.
  const isIp = /^[\d.]+$|^\[/.test(host);
  return isIp ? [`*://${host}/*`] : [`*://${host}/*`, `*://*.${host}/*`];
}
async function registerProtectFlag(host) {
  const script = {
    id: flagId(host),
    matches: matchesFor(host),
    js: ["main/protect-flag.js"],
    runAt: "document_start",
    world: "MAIN",
    allFrames: true,
    persistAcrossSessions: true,
  };
  const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [script.id] }).catch(() => []);
  if (existing.length) await chrome.scripting.updateContentScripts([script]);
  else await chrome.scripting.registerContentScripts([script]);
}
// Dynamic registrations are dropped on extension update/reload; rebuild from storage.
async function syncProtectFlags() {
  const hosts = await protectedHosts();
  for (const host of hosts) await registerProtectFlag(host).catch(() => {});
}
chrome.runtime.onInstalled.addListener(() => { syncProtectFlags().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { syncProtectFlags().catch(() => {}); });

// ---- messages ---------------------------------------------------------------------------
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== "string") return false;

  if (msg.type === "batch" && sender.tab) {
    const s = tabState(sender.tab.id, sender.tab.url);
    for (const ev of msg.batch) s.events.push({ ...ev, frameUrl: msg.frameUrl, frameId: sender.frameId });
    s.dirty = true;
    scheduleAnalyse(sender.tab.id);
    return false;
  }

  if (msg.type === "summary") {
    (async () => {
      const s = tabs.get(msg.tabId);
      if (!s) return sendResponse(null);
      const inference = await analyse(msg.tabId);
      const host = hostOf(s.url);
      sendResponse({
        url: s.url,
        host,
        eventCount: s.events.length,
        inference,
        severity: severity(inference),
        protected: (await protectedHosts()).includes(host),
      });
    })();
    return true; // async response
  }

  if (msg.type === "protect") {
    (async () => {
      await setProtected(msg.host, msg.on !== false);
      sendResponse({ ok: true, protected: msg.on !== false });
    })();
    return true;
  }

  return false;
});

// ---- tab lifecycle -----------------------------------------------------------------------
chrome.tabs.onUpdated.addListener((tabId, info) => {
  // New top-level navigation: start fresh.
  if (info.status === "loading" && info.url) {
    tabs.delete(tabId);
    chrome.action.setBadgeText({ tabId, text: "" }).catch(() => {});
  }
});
chrome.tabs.onRemoved.addListener((tabId) => tabs.delete(tabId));
