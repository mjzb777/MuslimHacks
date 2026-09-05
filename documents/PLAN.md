# Plan — Challenge 03: Online Privacy

## The idea (one sentence)

A Manifest V3 Chrome extension that detects when a website's own scripts **probe your installed extensions** or **fingerprint your browser**, explains in plain language what was attempted and what it could reveal, and lets the user stop it on that site with one click — verified live on a built-in test page.

## Why this wins the "before you build" questions

| Question from the brief | Our answer |
|---|---|
| What can you detect that uBlock / devtools cannot? | Behavioral detection of first-party scripts calling browser APIs (extension probing, canvas/audio/WebGL fingerprinting). No domain to blocklist; devtools show requests, not intent. |
| Can a non-technical person understand it? | One card per incident: *what happened → what it could reveal → one action*. No API names, no request logs on the main screen. |
| Does it actually prevent collection? | Yes: probes made to fail uniformly (site can't tell installed from not-installed); fingerprint APIs return noised/generic values. Test page shows hit count drop to 0. |
| Does it break websites? | No network blocking. Only the probing/fingerprint API surface is affected, per-site, opt-in. |
| Enough value to justify installing? | Directly addresses the BrowserGate case; existing blockers don't cover it. |

## Prior art and differentiation (expect judges to ask)

| Existing tool | What it does | Gap we fill |
|---|---|---|
| Extension Scanner — BrowserGate (Chrome Web Store) | Static check of your extensions against LinkedIn's known probe list | LinkedIn-only, detection-only, no runtime detection on other sites, no prevention |
| Static (GitHub, MV3) | Blocks extension enumeration, hides DOM markers, noise mode | Technical blocker; no explanation of what happened, who did it, what it reveals |
| JShelter FPD | Heuristic fingerprint detection, warns user; lost blocking mode under MV3 | Technical audience; no extension-probing coverage |
| Privacy Badger | Canvas-fingerprint heuristics for **third-party** domains after 3 sightings | Structurally blind to first-party scans like LinkedIn's |
| Brave / Firefox RFP | Silent farbling / generic values | Nothing explained to the user |
| Chrome `use_dynamic_url` | Rotates extension resource URLs | Opt-in per extension author; most don't |

**What nobody does:** (1) an *inference layer* — "these probed extensions could reveal your religion / health / politics"; (2) runtime probing detection on *any* site; (3) first-party coverage; (4) plain-language explanation → one targeted action; (5) shipped before/after proof.

**Consequences for the build:**
- The inference/explanation layer is the product; API hooks are plumbing. Put real effort into the extension-ID → trait mapping and the copy.
- Lead prevention with probe neutralization (provable, no downside). Fingerprint noise is secondary — noise-based defenses can increase uniqueness, so don't make it the headline.
- Name Static and JShelter in the pitch. Owning prior art reads as rigor.

## The one core workflow (demo script)

1. Open the demo page (our own local page that runs a BrowserGate-style probe against ~20 extension IDs plus a canvas + audio fingerprint).
2. Extension badge lights up. Popup shows:
   > **This site checked which extensions you have installed.**
   > It looked for 20 extensions, including *Deen Shield* and *PordaAI* (Islamic apps). Knowing which extensions you use can reveal your religion, health, or politics.
   > Also collected: a canvas fingerprint (a hidden ID that tracks you across sites without cookies).
   > **[Protect me on this site]**
3. Click the button. Page reloads. Demo page's own readout now shows: `extensions found: 0 / fingerprint: blocked`. Popup shows *"Protected — 20 probes blocked."*
4. (Optional, if time) Visit a real site known to fingerprint and show the same card.

## Architecture

```
manifest.json (MV3)
├── background service worker      — receives events, aggregates per tab/site, sets badge, stores settings
├── content script (ISOLATED)      — relays MAIN-world events → service worker via chrome.runtime
├── content script (MAIN world,    — the detector/protector: wraps browser APIs at document_start
│   document_start)                  before any page script runs
├── popup / side panel             — the plain-language UI
└── demo/ (static test page)       — replicates BrowserGate probe + canvas/audio fingerprint, prints results
```

### Detection (MAIN-world script)

Wrap and observe:

- **Extension probing** — any attempt to load a `chrome-extension://<id>/…` URL:
  `fetch`, `XMLHttpRequest.open`, `Image.src`, `<script src>`, `<link href>`, `<iframe src>` setters. Record the extension ID and outcome.
- **Fingerprinting** — `HTMLCanvasElement.toDataURL / toBlob`, `CanvasRenderingContext2D.getImageData`, `WebGLRenderingContext.getParameter`, `AudioContext / OfflineAudioContext`, `navigator.plugins / hardwareConcurrency / deviceMemory`, font enumeration (many `measureText` calls). A script that touches ≥3 distinct fingerprint surfaces within a few seconds is flagged as fingerprinting.
- **Attribution** — capture `new Error().stack` inside the wrapper to identify the calling script URL/origin (this is "who received it").

### Event model

```ts
type Incident = {
  ts: number;
  tabId: number;
  site: string;              // eTLD+1 of the top frame
  kind: "ext-probe" | "fingerprint";
  technique: string;         // e.g. "chrome-extension resource load", "canvas", "audio"
  targets?: string[];        // extension IDs probed
  scriptOrigin: string;      // from stack trace
  blocked: boolean;
};
```

Stored locally in `chrome.storage.local`, aggregated per site. Nothing leaves the browser.

### "What it could reveal" — the inference layer

This is the product, and it is **general**, not religion-only. Religion is the demo hook (BrowserGate); the engine maps any collected signal → trait → sensitivity.

Taxonomy anchored on **GDPR Article 9 special categories** (brief cites [OP8]; judges will recognize it):

| Trait | From probed extensions | From fingerprint data |
|---|---|---|
| Religion (🔴) | Deen Shield, PordaAI, Muslim Pro, Quran/prayer-time, Bible apps, Hebrew calendar, halal/kosher checkers | — |
| Health / disability (🔴) | screen readers, dyslexia fonts, colour-blind filters, ADHD tools, medication reminders | reduced-motion / high-contrast / forced-colors, unusual zoom |
| Political views (🔴) | activist / boycott trackers, partisan news, protest-safety tools | — |
| Sexual orientation (🔴) | LGBTQ+ community extensions, dating helpers | — |
| Ethnicity / origin (🔴) | language packs, script IMEs (Arabic, Urdu, Bengali…), diaspora news, remittance tools | `navigator.language(s)`, timezone, installed font sets (CJK/Arabic/Indic) |
| Trade-union membership (🔴) | union / organizing tools | — |
| Financial status (🟠) | crypto wallets, budgeting, coupon/cashback, BNPL | `deviceMemory`, `hardwareConcurrency`, screen res as wealth proxy |
| Employer (🟠) | Okta / corporate SSO, enterprise DLP, Salesforce / Jira / Figma tooling | — |
| Security posture (🟠) | password managers, 2FA, VPNs, anti-phishing | — |
| Privacy-conscious (🟠) | uBlock, Privacy Badger, anti-fingerprinting tools | — |
| Age / parental status (🟡) | parental controls, kids' learning tools, school LMS | — |
| Location (🟡) | — | timezone + language + fonts |

**Data:** one local JSON, `extension_id → { name, category, trait, sensitivity }`. Source the IDs from the public BrowserGate list (6,222 IDs); categorize the top few hundred by Web Store category and hand-tag the sensitive ones. Unknown IDs still count and surface as "unrecognized — N probes".

**Aggregation drives the card:**

> **This site checked for 42 extensions.** From what it looked for, it could infer:
> 🔴 Religion — probed for Deen Shield, PordaAI, Muslim Pro
> 🔴 Disability — probed for NVDA companion, OpenDyslexic
> 🟠 Employer — probed for Okta, Salesforce

**Copy rules:** say *probed for*, not *found*; say *could infer*, never *knows*. Accurate, and not alarmist. Which probes actually *succeeded* on this user is shown too (it never leaves the device) — that is the "what it learned about *you*" line.

### Prevention (per-site toggle, same MAIN-world script)

- **Probe neutralization** — every `chrome-extension://` load fails the same way (throw / fire `onerror`, same timing) so installed vs not-installed is indistinguishable.
- **Fingerprint hardening** — add imperceptible noise to canvas/audio output; return generic values for `hardwareConcurrency`, `deviceMemory`, `plugins`; WebGL vendor/renderer → generic strings.
- Nothing network-level is blocked, so pages keep working. Toggle is per site; global default is "detect only" so we never break the web silently.

### MV3 notes

- No blocking `webRequest`. Everything is API interception in the page, which MV3 permits.
- Content script `world: "MAIN"` + `run_at: "document_start"` in `manifest.json` (Chrome ≥ 111).
- Permissions: `storage`, `activeTab`/`tabs` (badge + site), `scripting` only if we inject dynamically. No host permissions beyond `<all_urls>` for the content script.

## Project structure

Vanilla JS, no build step (load unpacked; the MAIN-world script must be a single file anyway).

```
extension/
  manifest.json
  main/detector.js          MAIN world, document_start. Wraps APIs, emits raw events via
                            postMessage. Dumb on purpose — no chrome.*, no data, no logic.
  isolated/bridge.js        Relays MAIN events → service worker; passes protect flag back.
  background/sw.js          Module SW. Aggregates per tab/site, badge, chrome.storage.local.
  background/inference.js   PURE: incidents[] → inferences[]. Unit-testable in Node.
  popup/                    popup.html / .js / .css
  data/extensions.json      id → { name, trait, sensitivity }
demo/
  index.html, probe.js, fingerprint.js   BrowserGate-style probe + fingerprint with a
                                          visible readout ("probed: 20  found: 1  hash: …")
test-extension/             Tiny fake "Deen Shield" with one web_accessible_resource so
                            the probe has a deterministic positive to find.
tests/
  inference.test.js, heuristics.test.js   node --test, zero deps
  e2e/prevention.spec.js                  Playwright: load ext + demo, assert before/after
  manual-checklist.md                     "don't break the web" site list
```

Rules: logic lives in `inference.js` (pure), not in `detector.js`. Build `demo/` and `test-extension/` **before** the detector — they are the ground truth it is tested against.

## Testing

1. **Unit** (`node --test`): inference fixtures → expected traits; fingerprint heuristic thresholds; probe-URL parsing.
2. **Demo page as harness**: the page's own readout is independent ground truth. Detect mode → `found: 1`; protect + reload → `found: 0`, `hash: blocked`. This is the dev loop and the pitch demo.
3. **Playwright E2E**: persistent context with `--load-extension`, reach the MV3 SW via `context.serviceWorkers()`. One spec: open demo → assert found:1 → set protect via SW → reload → assert found:0 → assert popup inferences include `religion`. Green test = proof of prevention for judges. ~2h.
4. **Real-world**: positive — browserleaks.com/chrome, coveryourtracks.eff.org, amiunique.org, LinkedIn itself. Negative (protect on) — Gmail, YouTube playback, Google Docs, a bank login, e-commerce checkout, a Cloudflare Turnstile page. Run before the freeze.

## Step-by-step build

Each step has a "done" check. Critical path is **3 → 4 → 8 → 9**; everything else floats.

| # | Step | Est. | Done when |
|---|---|---|---|
| 0 | Repo skeleton, `package.json` (`node --test`), README "load unpacked" | 0.5 h | Everyone can run `npm test` |
| 1 | `test-extension/` — fake "Deen Shield (test)", one `web_accessible_resources` entry, **`"key"` pinned so the ID is identical on every laptop** | 0.5 h | `fetch("chrome-extension://<id>/marker.png")` → 200 from any page |
| 2 | `demo/` — probes ~20 IDs via `<img src>` + `fetch()`; canvas/audio/navigator fingerprint; prints readout and sets `window.__demoResults` | 1.5 h | `probed: 20  found: 1  canvas: <hash>  audio: <n>` |
| 3 | Extension skeleton: manifest (MAIN `detector.js` + ISOLATED `bridge.js`, both `document_start`, `<all_urls>`; module SW; popup; `storage`, `scripting`). `postMessage` `{__pp:true,…}` → bridge → SW | 1 h | SW console shows an event from the demo page. **Unblocks 4–7 in parallel.** |
| 4 | Detector, observe only. Probing: wrap `fetch`, `XHR.open`, `src`/`href` setters on img/script/link/iframe, `setAttribute`; match `^chrome-extension://([a-p]{32})/`. Fingerprint: `toDataURL/toBlob/getImageData`, `WebGL.getParameter`, `OfflineAudioContext.startRendering`, navigator getters. Attribution via `new Error().stack`. Buffer + flush every 250 ms | 3 h | 20 probe events with correct IDs, ~6 fp-api events, `scriptOrigin` = `probe.js` |
| 5 | `inference.js` (pure) + `data/extensions.json` (~100 hand-tagged IDs from the BrowserGate list). Fingerprint rule: ≥3 distinct API families from one origin in 5 s | 3 h | `npm test` green on fixtures (fake ID → religion/high; canvas-only → clean; canvas+audio+nav → fingerprinting) |
| 6 | SW aggregation: per-tab incidents, per-site summary in `chrome.storage.local`, badge = # high-sensitivity traits, cleared on navigation, `{type:"summary"}` handler | 1.5 h | Badge "1" on demo page |
| 7 | Popup: one card — what happened → what it could reveal (🔴🟠🟡 rows) → what it learned about *you* → **[Protect me on this site]**; "Details" disclosure | 3 h | Demo page produces the card from this plan verbatim |
| 8 | Prevention. Flag delivery: SW `chrome.scripting.registerContentScripts` a per-site `protect-flag.js` (MAIN, `document_start`) setting `window.__ppProtect=true`; **detector checks the flag lazily at call time** (avoids ordering race). Probe neutralization: rewrite any `chrome-extension://<id>/…` to `chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/x` — the browser produces the native not-installed error with native timing. Fingerprint hardening (secondary): flip one pixel low bit; ~1e-7 audio noise; `hardwareConcurrency→4`, `deviceMemory→8` | 2.5 h | Protect + reload → `found: 0`, canvas hash changes |
| 9 | Playwright E2E: `launchPersistentContext` + `--load-extension=extension,test-extension`; SW via `context.serviceWorkers()`. Spec: found:1 → protect via SW → reload → found:0 → summary includes `religion` | 2 h | `npm run e2e` green — the "prove it prevents" artifact |
| 10 | Real-world: positive (browserleaks.com/chrome, coveryourtracks, LinkedIn); negative with protect on (Gmail, YouTube, Docs, bank login, checkout, Turnstile). Likely culprits if something breaks: `setAttribute`, `getParameter` | 2 h | `tests/manual-checklist.md` ticked |
| 11 | Freeze at h20. Record backup capture. Pitch: problem 30 s → live demo 2 min → vs. Static/JShelter/Privacy Badger 30 s → green E2E 15 s | 4 h | Rehearsed twice |

```
h0   ─ 0 ──┐
h0.5 ─ 1 ─┬─ 2 (demo) ────────────┐
h1   ─ 3 (skeleton) ─┬────────────┤
h2   ─ 4 (detector) ─┼─ 5 (inference + data) ─┬─ 6 (SW) ─ 7 (popup)
h5   ─ 8 (prevention) ┘           │            │
h8   ─ 9 (E2E) ◄──────────────────┴────────────┘
h14  ─ 10 (real-world) ── polish
h20  ─ 11 (freeze, record, pitch)
```

## Workstreams (parallel from the start)

| # | Stream | Owner | Output |
|---|---|---|---|
| 1 | Extension skeleton | | manifest, service worker, ISOLATED↔MAIN messaging, storage, badge |
| 2 | Detector | | MAIN-world wrappers for probing + fingerprinting, attribution, incident emission |
| 3 | Protector | | per-site neutralization + hardening, toggle plumbing |
| 4 | UI | | popup card(s), plain-language copy, "what it could reveal" mapping |
| 5 | Demo page + pitch | | test page that reproduces BrowserGate & fingerprinting with a visible results readout; before/after numbers; 3-min pitch |

Suggested order if the team is small: 1 → 5 (demo page) → 2 → 4 → 3. Getting the demo page *early* means the detector is tested against a known target the whole time.

## Timeline (24h)

- **h0–2** — Agree on this plan, scaffold repo (streams 1 & 5 start).
- **h2–8** — Detector working against demo page; raw incidents visible in console/popup.
- **h8–14** — Protection working; demo page readout shows 0. UI card with real copy.
- **h14–20** — Polish: badge, per-site memory, mapping data, edge cases, try on 2–3 real sites.
- **h20–22** — Freeze. Record a backup screen capture of the demo.
- **h22–24** — Pitch prep and rehearsal (the guide says give this 1–2 hours).

## Explicit non-goals (do not build)

- Cookie / tracker blocklists — existing tools do this; it's not our differentiator.
- Network-level blocking, DNR rules, or CNAME-cloaking detection — out of scope for 24h.
- Cloud sync, accounts, analytics — violates the local-first constraint and costs time.
- Firefox/Safari ports.

## Open decisions

- Popup vs. side panel for the UI (popup is faster to build; side panel stays open during the demo).
- Whether "protect" applies immediately (re-wrap in place) or requires a reload (reload is simpler and fine for the demo).
- Default mode on unknown sites: detect-only (recommended) vs. protect-all.
