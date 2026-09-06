# Next steps — team coordination

Status: product done and green (`npm test` 14 · `npm run e2e` 15 · coverage 97.6% · +6 ms).
Everything below is what only humans can do before judging. Put your name in the **Owner**
column, tick when done. Freeze code **4 hours before** the pitch slot.

Reference docs: [`PITCH.md`](PITCH.md) (rubric map, demo script, Q&A) ·
[`../tests/manual-checklist.md`](../tests/manual-checklist.md) ·
[`real-web-results.md`](real-web-results.md).

## A. Verification in real Chrome (do first — findings feed the pitch)

| # | Task | Owner | Done |
|---|---|---|---|
| A1 | Load `extension/` + `test-extension/` unpacked in real Chrome (`chrome://extensions` → Developer mode → Load unpacked). | | ☐ |
| A2 | **LinkedIn, logged in.** Browse feed, profile, jobs, messaging for 2–3 min with the badge visible. Does it probe? Screenshot the card either way. | | ☐ |
| A3 | browserleaks.com/chrome unprotected → card shows *Health* + *Religion (PordaAI)*. Protect → reload → page's own list empty. Screenshot both. | | ☐ |
| A4 | Negative checklist with Protect ON: Gmail, YouTube (audio), Google Docs, a checkout page, Google Maps, a Cloudflare Turnstile page. Note anything broken. | | ☐ |
| A5 | Reload the extension and restart Chrome → protected sites stay protected. | | ☐ |

If A4 finds breakage: the suspects in order are `setAttribute` rewrite → `webgl.getParameter`
hardening → `canvas.getImageData` bit flip → `navigator.*` generics (all in
`extension/main/detector.js`). Report in the group before changing anything.

## B. Pitch content

| # | Task | Owner | Done |
|---|---|---|---|
| B1 | Fill in **"How did you divide the work?"** in `PITCH.md` §5 (Team & process). | | ☐ |
| B2 | Assign a **question owner** per category in `PITCH.md` §5: Technical · Impact · Demo · Business · Team · Privacy · Future · Closing. Each owner reads their answers until they can say them in ≤ 20 s. | | ☐ |
| B3 | Slides + tab lineup: follow [`PRESENTATION.md`](PRESENTATION.md) (8 slides, 5-tab live demo, pre-flight checklist, failure fallbacks, 3-minute cut). | | ☐ |
| B4 | Choose driver (mouse) and speaker (voice). Third person runs `npm run e2e` in a visible terminal 30 s before the demo. | | ☐ |
| B5 | Rehearse the 2-minute script (`PITCH.md` §3) **three times** on the actual laptop, actual Wi-Fi, timer running. | | ☐ |
| B6 | Decide the offline fallback order: demo page (`npm run demo`) → backup video. | | ☐ |

## C. Demo video (backup + submission asset)

| # | Task | Owner | Done |
|---|---|---|---|
| C1 | Prepare a clean Chrome profile for recording (see §D). | | ☐ |
| C2 | Record the 2-minute flow silently, in one or more takes. | | ☐ |
| C3 | Record voiceover separately, reading `PITCH.md` §3. | | ☐ |
| C4 | Edit: cut dead time, zoom on the card, captions, export 1080p MP4 ≤ 2:30. | | ☐ |
| C5 | Copy to the demo laptop **and** a phone. Test playback with sound. | | ☐ |

## C2. Devpost submission

Gallery images are in `documents/devpost/` (1920×1080, upload in this order). Captions to
paste with each:

| File | Caption |
|---|---|
| `01-cover.png` | Unseen: see what websites try to learn about you, then stop them. Chrome extension, everything runs on your device. |
| `02-problem.png` | BrowserGate: LinkedIn's own script probed 6,222 extensions per visitor, including PordaAI. No blocker can see it. |
| `03-before-after.png` | The real card on browserleaks.com before and after one click. 5,000 probes, all answered "not installed". |
| `04-real-sites.png` | Verified on browserleaks, amazon, fingerprint.com, LinkedIn, CreepJS, and quiet on Wikipedia. |
| `05-how-it-works.png` | MAIN-world detector → bridge → pure inference → card. Nothing blocked on the network, nothing leaves the device. |
| `06-numbers.png` | 5,000→0 probes, +6 ms, 97.6 % coverage, 14 unit + 15 e2e tests, 0 servers. |

Regenerate after any popup change: `node tools/screenshot-popup.mjs documents/devpost/src-card-before.png --zoom 2 https://browserleaks.com/chrome`,
same with `--protect` into `src-card-after.png`, then `node tools/render-devpost.mjs`.
Edit the layouts in `documents/devpost/source.html`.

## D. How teams make demo videos that look good

The trick is that nothing is live. It is a screen recording with **no dead time, a zoom on the
thing that matters, and a voice that already knows what happens next.** Concretely:

**1. Set the stage (10 min)**
- New Chrome profile, only our two extensions, bookmarks bar hidden (`Ctrl+Shift+B`), no
  other tabs, default zoom 125% so text is readable at 1080p.
- Windows: Settings → System → Display → 1920×1080, 100% scale. Turn on Focus Assist
  (no notifications). Close Discord/Slack.
- Pin the Unseen icon to the toolbar so the badge is always visible.
- Install **PowerToys → Mouse utilities → Mouse Highlighter** (or "Find My Mouse") so the
  cursor is easy to follow. Slow your mouse down deliberately.
- Have `npm run demo` running and `npm run e2e` ready in a terminal with a large font.

**2. Record picture and voice separately**
- Picture: **OBS Studio** (free) with a Display Capture source, 1080p 30 fps, or the built-in
  Xbox Game Bar (`Win+Alt+R`) if OBS is too much setup. Record **without talking**. Do each
  segment as its own short take (browserleaks → protect → Wikipedia → Amazon → tests); it's
  far easier to redo one 20-second segment than the whole thing.
- Between actions, **pause for a full second** with the mouse still. That gives you cut
  points and room for the voice.
- Voice: record afterwards on a phone or any mic, in a quiet room, reading the script column
  of `PITCH.md` §3. Two or three takes; pick the calmest. Voice recorded separately always
  sounds better than talking while clicking.

**3. Edit (Clipchamp is already on Windows 11; DaVinci Resolve is free if you want more)**
- Lay the voice down first, then cut the picture to match it. Remove every second where
  nothing changes on screen.
- **Zoom in** (120–150%) on the card when you talk about it, and on the browserleaks result
  list when it goes empty. This is what makes it look professional.
- Add captions for the key lines; many judges watch muted or in a noisy room.
- One title card at the start (name, one line), one at the end (name + team). No music, or
  music at −25 dB under the voice.
- Length target **1:45–2:15**. Export MP4 (H.264) 1080p.

**4. Optional: a perfectly repeatable scripted recording**
Playwright can record video of the browser itself (`recordVideo` on `launchPersistentContext`),
which gives frame-perfect, jitter-free takes of the web pages. It does *not* capture the real
toolbar popup, so use it for B-roll of browserleaks / demo page, and OBS for the popup.

**Common mistakes:** talking while clicking; showing the terminal for more than 3 seconds;
scrolling fast; leaving the cursor over text; starting with the team instead of the problem.
The first 5 seconds must be the BrowserGate line, not "Hi, we're team…".

## E. Timeline to the pitch

| When | What |
|---|---|
| now → +2 h | A1–A5 verification; B1–B2 Q&A owners |
| +2 h → +4 h | C1–C4 video; B3 slides |
| +4 h → +5 h | B5 rehearsals × 3; fix only demo-breaking bugs |
| −4 h before slot | **Code freeze.** `git tag freeze`. |
| −1 h | C5 playback test; e2e running; laptop plugged in, Wi-Fi + hotspot both ready |
