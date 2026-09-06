# Presentation plan — slides + live tab demo

Companion to [`PITCH.md`](PITCH.md) (rubric map, Q&A answers) and
[`NEXT-STEPS.md`](NEXT-STEPS.md) (who does what). This doc is the *run sheet*: what is on each
slide, which tabs are open, what gets said and clicked, in order.

Format assumed: **5 minutes + Q&A**. A 3-minute cut is marked at the bottom.
Shape: **2 slides → live demo on real sites → 4 slides → close.** Judges remember what they
saw work, so the demo sits at ~1:00, not at the end.

## 1. Slide deck (9 slides, ~2 min of talking total)

The deck is built: open [`slides/index.html`](slides/index.html) in Chrome. Arrow keys or
click to advance, `F` fullscreen, `N` toggles the speaker line for the current slide,
`Ctrl+P` → Save as PDF for the backup copy. Slide 4 is the placeholder that stays up while
the driver switches to the browser tabs.

Rules: one idea per slide, ≥ 40 pt type, a screenshot beats a bullet list, no slide stays up
longer than 30 s. Use the existing screenshots in `documents/screens/` and take a fresh one of
the card on browserleaks (`node tools/screenshot-popup.mjs https://browserleaks.com/chrome`).

| # | Slide | On screen | Say (≤ 30 s) | Rubric line it serves |
|---|---|---|---|---|
| 1 | **The hook** | One line, huge: *"LinkedIn checked whether you're Muslim."* Sub-line: BrowserGate, April 2026 — 6,222 extensions probed on every visitor, including PordaAI. | "In April LinkedIn was caught probing 6,000 extensions on every visitor — including PordaAI, an Islamic content filter. If it's installed, they know your religion. No blocker stops this: it's LinkedIn's own code." | Convincing reason · Research |
| 2 | **Why nothing catches it** | Two columns. Left: *uBlock / Privacy Badger / Ghostery* → "block **domains**". Right: *extension probing & fingerprinting* → "the site's **own** JavaScript, no domain to block". | "Every tool you've heard of works on domains. This is the site's own script calling browser APIs. There's nothing to block — and nobody tells you it happened." | Research · Differentiation |
| 3 | **Unseen, in one sentence** | The card screenshot (unprotected, *Religion — probed for PordaAI*). Caption: *Detect · Explain · Prevent — one click, all on your device.* | "Unseen watches the API calls themselves, tells you in plain words what the site tried to learn, and stops it with one click. Let me show you on real sites." | Easy to understand |
| — | **LIVE DEMO** (§2 below, ~2 min) | Browser, full screen | | Live demo · Solves the problem |
| 4 | **How it works** | Architecture diagram (mermaid in `PITCH.md` §4 → PNG): Page (MAIN world) → `detector.js` → `bridge.js` → service worker → `inference.js` (pure) → card. Three callouts: *MV3-native · no network blocking · nothing leaves the device*. | "A MAIN-world script wraps the ~20 APIs a probe or fingerprint has to use and notes which script called them. A pure inference module maps probed IDs to traits and flags fingerprinting when one script touches three API families in five seconds. Protection rewrites probe URLs to a dead extension ID, so the browser itself answers 'not installed' — nothing network-level, nothing breaks." | Architecture · Code quality |
| 5 | **Prior art vs us** | 4-row table: Static / JShelter · Privacy Badger · browserleaks scanner · **Unseen**. Columns: *sees first-party?* · *explains what was learned?* · *one-click, per-site?* · *for non-experts?* | "Static and JShelter block for experts and break sites. Privacy Badger can't see first-party scans by design. browserleaks is a one-site check. Nobody tells an ordinary person what a site tried to learn about them." | Research · Investable |
| 6 | **Numbers** | Six big numbers: **5,000 → 0** probes · **+6 ms** page load · **97.6 %** line coverage · **14 + 15** unit / e2e tests · **43** extensions tagged to traits · **0** servers. | "Five thousand probes to zero with one click. Six milliseconds overhead. Ninety-eight percent coverage on the inference module, fifteen end-to-end tests that prove the before and after. Zero servers, zero cost to run." | Performance · Tested · Sustainable |
| 7 | **Business & next** | Left: *Free for individuals — cost to run is zero.* Right: *Unseen Audit — the same detector run against a company's own site → GDPR Art. 9 report.* Below: next 3 steps (Web Store unlisted → 10 PordaAI users · dataset from the 6,222-ID list · Firefox port). | "Free and open for individuals; it costs nothing to run. Revenue is on the other side: companies paying to audit whether their own site probes for religion. Next step after today is an unlisted store listing and ten PordaAI users." | Business model · Scalability |
| 8 | **Close** | Name + line: *Unseen — see what websites try to learn about you.* Repo QR. The ask: *Try it. Tell us what your site sees.* | "LinkedIn checked if you're Muslim. Now you can see it — and stop it. Unseen." | Would invest · Memorable |

Deck hygiene: same font throughout, dark or light but not both, no animations, no logo wall.
Export to PDF as well as the native format; the PDF is the fallback if the projector laptop
is not ours.

## 2. Live demo — the tab lineup

Everything is pre-opened in one Chrome window, tabs left to right in this order. The driver
only ever moves right, except for the Protect reload. Speaker lines are ≤ 15 words each; the
card does the talking.

| Tab | Site | What the judges see | Driver | Speaker |
|---|---|---|---|---|
| 1 | **browserleaks.com/chrome** (unprotected, freshly reloaded) | Badge **red**. Open card: *5,000 extensions probed · Religion — probed for PordaAI · Health — dyslexia tools · 11 of 5,000 found on your browser.* The page's own list below shows what it detected. | Click badge. Scroll the card slowly to *Religion*. Pause 2 s. | "This is a real site doing exactly what LinkedIn did. Five thousand probes — including PordaAI." |
| 1 | same, **Protect** | Click **Protect me on this site** → tab reloads → browserleaks' own list is **empty**. Card: *Nothing — 5,000 probes blocked.* | Hand the mouse to a judge for this click if the room allows. | "One click. The site now gets 'not installed' for all five thousand — from the browser itself." |
| 2 | **en.wikipedia.org** | **No badge.** Nothing. | Just switch to it; hover the empty badge. | "And it stays quiet on sites that behave. It doesn't cry wolf." |
| 3 | **amazon.com** | Badge orange. Card: *Fingerprinted — done by …awswaf.com* (third party). | Open card, point at the "done by" line. | "Fingerprinting too — and it names who did it, even when it's a vendor, not the site." |
| 4 | **fingerprint.com/demo** | Badge red. Card lists 11 APIs — audio, canvas, WebGL, navigator, Intl — attributed to the FingerprintJS script. The page shows *your visitor ID*. | Open card. Optional: Protect → reload → point out the card now says hardened. | "This is the commercial fingerprinting product. Same story: we see every API it touched." |
| 5 | **Demo page** `http://127.0.0.1:8787/` (local) | Page prints `extensions probed: 20 · found: 1 (Deen Shield)`. Protect → `found: 0`, fingerprint hashes change. | This is the **judge-interactive** tab: let a judge click Protect and read the card aloud. | "Our own page, offline, so you can see the before and after in one line. Deen Shield: found — protect — gone." |
| 6 | Terminal: `npm run e2e` (already green) | 15 passing tests, one of which is the before/after prevention proof. | Alt-tab, 3 s max. | "Fifteen end-to-end tests, including that before-and-after. Everything you saw ran on this laptop." |
| 7 | *(optional)* **linkedin.com, logged in** | Only if task A2 in `NEXT-STEPS.md` confirmed it probes. If it does, this becomes **tab 1** and the whole pitch gets stronger. If not, skip; don't show a quiet LinkedIn. | | "And here is LinkedIn itself." |

**Judge's-choice tab (optional, after the scripted part).** "Name any site." Open it in tab 8.
Most large sites show at least an orange fingerprint badge; news/wiki sites show nothing —
both outcomes are fine and both prove the point. Have Wikipedia and deviceinfo.me ready as the
two prepared answers if nobody names one. Only do this if the timer says ≥ 45 s remain.

### Pre-flight (driver, 10 minutes before)

- [ ] Clean Chrome profile: only Unseen + the Deen Shield stand-in; icon **pinned**; bookmarks bar hidden; zoom **125 %**; DevTools closed; Focus Assist on.
- [ ] **Un-protect** browserleaks.com, 127.0.0.1 and fingerprint.com (open each card → the button reads *Protect me*, not *Stop protecting*). A leftover protected state is the #1 way this demo dies.
- [ ] `npm run demo` running. `npm run e2e` run once, terminal left on the green summary, font size ≥ 18.
- [ ] Reload tab 1 (browserleaks) **last**, 60 s before start, so the badge count is fresh. Confirm the card shows *Religion*.
- [ ] Tabs 2–5 loaded once so they're warm; amazon has no captcha showing (if it does, close and reopen in a new tab).
- [ ] Phone hotspot on and known to the laptop. Backup video on the laptop **and** on a phone.
- [ ] Laptop plugged in, external display mirrored (not extended) at 1920×1080.

### If something fails

| Failure | Do this |
|---|---|
| Wi-Fi gone | Tabs 1, 3, 4 are already loaded — the card still works because events are held per tab. Do the Protect click on **tab 5 (demo page)** instead of browserleaks. Say "we'll do the click locally" and move on. |
| browserleaks changed / shows no probes | Tab 5 demo page carries the Religion moment (Deen Shield). Mention "browserleaks probed 5,000 IDs last night — screenshot on slide 3." |
| amazon shows a captcha | Skip tab 3; fingerprint.com covers fingerprinting. |
| Badge doesn't appear on tab 1 | It's the protected-state leftover. Open card → *Stop protecting* → reload. 10 s. |
| Projector kills the layout | PDF deck; browser at 150 % zoom. |
| Total failure | Backup video, 2 min, speaker narrates over it live rather than playing its audio. |

## 3. Websites built for testing this — which to use for what

Yes: there is a whole genre of sites whose only purpose is to show what a browser leaks, and
they are the right thing to demo on because judges can verify them on their own laptop. Ranked
for our purposes (all verified in `real-web-results.md` unless marked):

| Site | Built to test | Use it for | Demo-safe? |
|---|---|---|---|
| **browserleaks.com/chrome** | **Extension detection** — the exact BrowserGate technique, 5,000 real IDs. | The hero. Only public site that probes for PordaAI + dyslexia tools → *Religion* and *Health* on a real site. Its own results list going empty after Protect is the best visual we have. | Yes — tab 1 |
| browserleaks.com/canvas · /webgl · /audio · /fonts | One fingerprint surface each, shows the **hash**. | Proof that hardening works: hash before ≠ hash after Protect. Canvas is the most legible. | Verify in real Chrome first (README lists /canvas as "needs a click") |
| **coveryourtracks.eff.org** (EFF) | Whether your browser + extensions resist tracking **and** fingerprinting; gives "bits of identifying information" and a unique/not-unique verdict. | The name judges recognise. Good as a one-liner: "the EFF's own test sees the same surfaces we do." Needs a click on *Test your browser*. | Verify first; keep as tab 8 candidate, not scripted |
| **fingerprint.com/demo** | Commercial FingerprintJS Pro — shows your persistent *visitor ID*. | "This is the industry product." Card shows 11 APIs attributed to their script. | Yes — tab 4 |
| **amiunique.org/fingerprint** | Research project (Inria): how unique is your fingerprint. | Alternative to fingerprint.com if it rate-limits. 7 APIs, first-party. | Yes |
| **deviceinfo.me** | Plain dump of everything readable. | Backup "dirty" site for the judge's-choice moment; 10 APIs, instant, no click. | Yes |
| **CreepJS** (abrahamjuliot.github.io/creepjs) | The most aggressive fingerprinter; **also detects tampering** and reports "lies". | Stress-test of the hardening, and an honest Q&A answer ("CreepJS can tell our canvas is perturbed — we chose probe-blocking as the primary defence for that reason"). | **Not for the live demo** — it may print "lies detected", which needs explaining |
| pixelscan.net | Fingerprint **consistency** (bot / spoof detection). | Same caveat as CreepJS. | No |
| z0ccc "Extension Fingerprints" (GitHub Pages) | Open-source extension-detection demo using `web_accessible_resources`, ~1,000 IDs. | Second extension-probing site if we want to show it isn't just browserleaks. **Unverified** — run `node tools/real-web.mjs --headed <url>` before relying on it. | Verify first |

Clean controls for the "doesn't cry wolf" beat: **en.wikipedia.org**, **bbc.com** (both verified: no
badge).

Rule of thumb for the lineup: **one extension-probing site, one clean site, one third-party
fingerprinter, one first-party fingerprinter, one local page.** That covers every claim in the
brief — detect beyond blocklists, explain, prevent, don't break the web, local-first — in five
tabs and under two minutes.

## 4. Three-minute cut

Drop slides 5 and 7 (fold one sentence of each into slide 4 and 8), drop tabs 4 and 6, keep
the judge click on tab 5. Order becomes: 1 · 2 · 3 → browserleaks → Protect → Wikipedia →
amazon → demo page → 4 · 6 · 8.

## 5. Roles

- **Speaker** — slides + lines above; never touches the mouse.
- **Driver** — tabs, clicks, pre-flight; says nothing except "go ahead" when handing the mouse to a judge.
- **Third** — runs pre-flight checklist with the driver, keeps the timer visible to the speaker, owns the backup video, fields the *Technical* Q&A category.

Rehearse the full thing three times on the real laptop with the timer running
(`NEXT-STEPS.md` B5). After each run, cut whatever went over.
