# Manual checklist (Step 10) — run before the freeze

Load `extension/` and `test-extension/` unpacked in real Chrome (chrome://extensions →
Developer mode → Load unpacked). Tick each line; note anything odd next to it.

## Positive: does it see real-world tracking?

| Site | Expect | ✓ | Notes |
|---|---|---|---|
| `npm run demo` → http://127.0.0.1:8787/ | badge red, card shows Religion first, 1 of 20 found | | |
| https://browserleaks.com/chrome | badge lights up; ext-probe events in Details | | |
| https://coveryourtracks.eff.org (run test) | fingerprint detected; canvas/audio/webgl in Details | | |
| https://amiunique.org/fingerprint | fingerprint detected | | |
| https://www.linkedin.com (logged out, then logged in) | probe events? how many targets? screenshot the card | | |
| https://fingerprint.com/demo | fingerprint detected; third-party origin shown in "Done by" | | |

## Negative: with **Protect** ON for each site, does it still work?

| Site | Check | ✓ | Notes |
|---|---|---|---|
| https://mail.google.com | inbox loads, open + send a mail | | |
| https://www.youtube.com | video plays with sound | | |
| https://docs.google.com | open a doc, type, it saves | | |
| a bank / payment login page | login form renders, 2FA prompt works (don't submit real creds) | | |
| an e-commerce checkout (e.g. amazon cart) | cart + checkout pages render | | |
| a Cloudflare Turnstile / hCaptcha page | challenge completes | | |
| https://maps.google.com | WebGL map renders and pans | | |
| a site using canvas heavily (e.g. https://excalidraw.com) | drawing works | | |
| any site with an embedded YouTube/Twitter iframe | embeds render | | |

If something breaks, find the wrapper responsible by toggling these in `detector.js`
(most likely first): `setAttribute` rewrite → `webgl.getParameter` hardening →
`canvas.getImageData` bit flip → `navigator.*` generics.

## Extension-probe sanity

- [ ] Protect ON: demo readout `found: 0`; popup says "Nothing — N probes were blocked".
- [ ] Protect OFF: demo readout `found: 1`; popup lists Deen Shield under "What it learned".
- [ ] Reload the extension (chrome://extensions ↻): protected sites stay protected (`syncProtectFlags`).
- [ ] Restart Chrome: protected sites stay protected.
