# Real-web results (Sept 5, headless Chromium via `node tools/real-web.mjs`)

| Site | Extension probing | Fingerprinting | Traits shown |
|---|---|---|---|
| browserleaks.com/chrome | **5,000 IDs probed**, all observed; 0 found | no | finance, privacy, profession, security |
| browserleaks.com/chrome, **protected** | 5,000 probed, **5,000 blocked**, 0 found; page still runs its full test | no | same |
| amiunique.org/fingerprint | none | **yes** — 1st-party Nuxt bundle, 7 APIs (navigator, canvas, webgl) | ethnicity, finance, location |
| fingerprint.com/demo | none | **yes** — FingerprintJS v4 loader, 11 APIs (audio, canvas, webgl, navigator, intl) | ethnicity, finance, location |
| linkedin.com (logged out) | none on the landing page | **yes** — two `static.licdn.com` bundles, 10 APIs each, plus `client.protechts.net` | ethnicity, finance, location |

Notes
- LinkedIn's extension scan (BrowserGate) was reported on logged-in pages; the logged-out
  landing page did not probe. Re-test logged in, in real Chrome, for the pitch.
- `static.licdn.com` is LinkedIn's own CDN but a different registrable domain, so it shows
  as "3rd-party". A same-company heuristic would fix the label; the detection is correct.
- 10,000 events (5,000 probes + 5,000 results) on browserleaks processed in ~9 s wall time
  including the fixed 8 s wait — no visible slowdown.
