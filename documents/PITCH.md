# Pitch plan — optimised against the judging rubric

Rubric weights: **Business 40% · Delivery 30% · Technical 30%**, each line graded 1–5
(5 = "Impressive"). Judges also ask a fixed list of follow-ups (bottom of this doc).

## 1. Where we stand on each rubric line


| Rubric line                            | Weight | Evidence we can show                                                                                                                                                | Score risk → fix                                                                         |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Solves the problem (or an aspect)      | Biz    | Detects BrowserGate-style probing + fingerprinting; explains; **prevents** (5,000/5,000 probes blocked on browserleaks)                                             | Low. Say "one workflow, end to end" — the brief asked for exactly that.                  |
| Easy to understand and use             | Biz    | Zero config. Badge → card → one button. Copy has no jargon.                                                                                                         | Medium. Judges must *see* a non-technical person get it. Have a judge click **Protect**. |
| Cost of running sustainable            | Biz    | **Zero.** No servers, no accounts, no LLM. Static dataset ships in the extension.                                                                                   | Low. Say it in one sentence, it's a differentiator.                                      |
| Convincing reason + research           | Biz    | BrowserGate (6,222 IDs incl. PordaAI); prior-art table (Static, JShelter, Privacy Badger, browserleaks scanner); GDPR Art. 9 taxonomy; real-web results on 10 sites | Low. Name the prior art unprompted.                                                      |
| Live demo working                      | Del    | 15 green e2e tests; works on browserleaks / fingerprint.com / amazon / LinkedIn                                                                                     | Medium — Wi-Fi. **Have a local-only path**: demo page + backup video.                    |
| Clearly presented                      | Del    | Architecture diagram (below); one-slide "how it works"                                                                                                              | Rehearse. ≤ 6 slides.                                                                    |
| Convincing pitch / would invest        | Del    | Story: LinkedIn probed for PordaAI → religion. Product: first tool that tells you *what a site tried to learn*.                                                     | Open with the story, close with the ask.                                                 |
| Follow-up questions                    | Del    | Prepared answers below                                                                                                                                              | Assign each question category to a team member.                                          |
| Architecture discernible & appropriate | Tech   | MAIN-world observer → ISOLATED bridge → SW inference → popup. Pure `inference.js`. MV3-native.                                                                      | Show the diagram; explain *why* MAIN world (no `chrome.`*, no network blocking).         |
| Code quality                           | Tech   | Detector is dumb by design; all judgement in a pure, tested module; no build step, no deps in the extension                                                         | Point at `inference.js` + its tests if asked.                                            |
| Performance                            | Tech   | **+6 ms page load** (84 → 90 ms median, n=7); 10,000 events on browserleaks with no visible slowdown; per-API rate limiting                                         | Have the number ready.                                                                   |
| Well-tested / coverage metrics         | Tech   | **14 unit + 15 e2e. inference.js: 97.6% line / 95.6% branch / 92.6% function coverage.** E2E proves before/after prevention.                                        | Run `npm test` live — green in < 1 s.                                                    |
| Process for arriving at solution       | Tech   | PLAN.md: brief → prior art → "what nobody does" → one workflow → steps with done-checks                                                                             | Tell it as a decision story, not a timeline.                                             |


## 2. Product changes that move scores (do these first)

1. **Religion row on a real site.** browserleaks.com/chrome probes PordaAI's real ID — the
  very extension named in BrowserGate. With PordaAI in our dataset, the card on
   browserleaks shows *Religion — probed for PordaAI*. That is the pitch's proof shot.
   Also added: 12 Islamic prayer/content extensions, 6 Bible tools, 3 dyslexia tools.
2. **Coverage + perf numbers in the README** (done — see above). Tech judges look for them.
3. **Backup video** of the full demo flow (2 min). Record before the freeze.
4. **Architecture slide** (mermaid below → export PNG).
5. Nice-to-have if time: a history page listing sites seen + protected (data already in
  `chrome.storage.local.sites`). Makes "comprehensive" and "easy to use" more tangible.

## 3. Demo script (2 min, one driver, one speaker)


| t    | Speaker                                                                                                                                                                                                                                    | Driver                                                                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | "In April, LinkedIn was caught probing 6,000 extensions on every visitor — including PordaAI, an Islamic content filter. Knowing you have it installed tells them your religion. No blocker stops this, because it's LinkedIn's own code." | Slide: BrowserGate headline                                                                                                                     |
| 0:25 | "This is what a site sees today."                                                                                                                                                                                                          | browserleaks.com/chrome, unprotected. Badge red. Open card: *5,000 extensions… Religion — probed for PordaAI… 11 of 5,000 are on your browser.* |
| 0:55 | "One click."                                                                                                                                                                                                                               | **Protect me on this site** → reload → browserleaks' own list is empty; card: *Nothing — 5,000 probes blocked.*                                 |
| 1:15 | "And it stays out of the way."                                                                                                                                                                                                             | Wikipedia: no badge.                                                                                                                            |
| 1:25 | "Fingerprinting too — first party or vendor."                                                                                                                                                                                              | amazon.com: card shows *Done by …awswaf.com*.                                                                                                   |
| 1:40 | "Everything ran on this laptop. No server, no account, no LLM. 15 end-to-end tests prove the before and after."                                                                                                                            | `npm run e2e` already running in a terminal — show green.                                                                                       |
| 1:55 | "Unseen: the first tool that tells an ordinary person what a site tried to learn about them, and stops it."                                                                                                                                | Slide: name + one line                                                                                                                          |


## 4. Follow-up questions — prepared answers

**Technical**

- *Delivery format?* Chrome extension, Manifest V3. Also works in Edge/Brave (Chromium).
- *Technologies?* Vanilla JS, MV3 (`scripting.registerContentScripts`, MAIN-world content
scripts, module service worker). Node test runner + Playwright for tests. No build step, no
runtime dependencies.
- *How does it work?* A MAIN-world script wraps the browser APIs a site would use to probe
extensions or fingerprint, notes who called them, and reports. A pure inference module maps
probed extension IDs to traits and flags fingerprinting when one script touches ≥3 API
families in 5 s. Protection rewrites probe URLs to a dead extension so the browser itself
returns "not installed", and perturbs fingerprint outputs.
- *Built from scratch?* Yes, everything in the repo was written during the hackathon. We used
AI coding assistance (Claude Code) as a pair programmer; every design decision, test and
real-site validation is ours and in git history.
- *Tradeoffs?* Protection needs a reload; detect-only by default on unknown sites; first-party
is judged by origin, so a site's own CDN shows as third-party; dataset is ~45 hand-tagged
IDs, not all 6,222; fingerprint hardening is secondary to probe blocking because noise-based
defences can backfire.

**Impact & users**

- *Target user?* Anyone who installs a faith, health, or identity-related extension and
doesn't know sites can see it. Concretely: Muslims using PordaAI/prayer-time tools after
BrowserGate. Installed once, it runs silently until something happens.
- *Discovery/adoption?* Chrome Web Store; the communities around the affected extensions
(PordaAI, Deen Shield, masjid tech groups); privacy press covering BrowserGate.
- *How many benefit?* Every Chrome user on a site that probes — LinkedIn alone is ~1 B
accounts. The sensitive-trait risk is concentrated: users of the ~200 faith/health/politics
extensions in the BrowserGate list.
- *Impact if fully developed?* Extension probing becomes visible and therefore costly for
sites to do; a public, local-only record of which sites probe for which sensitive traits.
- *Measure success?* Installs; % of page loads where a probe/fingerprint was detected;
number of sites users chose to protect; qualitative: can a non-technical tester explain
the card back to us.

**Demo & functionality**

- *Fully functional or mocked?* Fully functional. The only synthetic piece is the
"Deen Shield (test stand-in)" extension we install so the demo page has something to find
— Deen Shield itself is Firefox-only. Everything on browserleaks/LinkedIn/amazon is real.
- *Most important feature?* The card that says what the site *tried to learn* — and the one
button that stops it.
- *Hardest part?* Making detection reliable before page scripts run (MAIN world at
`document_start`, lazy flag read to avoid ordering races) and discovering that Chrome 137+
ignores `--load-extension`, which broke our test harness until we switched to Chromium.
- *Complete vs prototype?* Complete: detection, inference, card, per-site protection, tests,
real-site validation. Prototype-level: dataset breadth, options/history page.

**Business & scalability**

- *Business model?* Free, open-source extension for individuals (cost to run is zero).
Revenue option: **Unseen Audit** — the same detector run headlessly against a company's own
site to produce a GDPR Article 9 compliance report ("your site probes for religious
extensions"). Legal/compliance teams pay for that.
- *Scale beyond prototype?* It already scales technically (client-side, no backend). Growth
work is dataset curation (community-maintained ID→trait list) and store listing.
- *Real product?* Store review, icon/branding, options page, dataset pipeline from the public
BrowserGate list, Firefox port (WebExtensions API is ~identical).
- *Who pays?* Individuals don't. Companies auditing their sites, and privacy NGOs/grants
(the EFF model) could.

**Team & process**

- *Division of work?* [fill in: skeleton/detector · inference+data · popup · demo/tests/pitch]
- *Learned?* Blocklists can't see first-party behaviour; MV3 is workable for this class of
tool; Chrome's own defence (`use_dynamic_url`) is opt-in and mostly unused.
- *Differently?* Start the dataset work on hour one; test in real Chrome earlier.
- *Prioritised how?* One workflow end to end (the brief's own advice); demo page first as
ground truth; prevention before polish.

**Data & privacy**

- *What data?* Only what the page itself does — API calls and probed extension IDs — kept in
`chrome.storage.local`. No telemetry, no accounts, no network calls of our own.
- *Privacy/security?* Nothing leaves the device. The extension requests `<all_urls>` to
observe pages; it never reads page content, only intercepts the specific APIs.
- *Ethical risks?* False alarms about a site (we say *probed for* / *could infer*, never
*knows*). Mis-tagging an extension's trait (dataset is human-curated and open). The
protect flag is technically detectable by a determined site. Legit uses of these APIs
(games, maps) are never blocked — only probes are neutralised.
- *LLM?* No. Deterministic rules; that's what makes it free to run and private.

**Future plans**

- *Next?* History/options page; community dataset from the 6,222 BrowserGate IDs; same-company
heuristic for CDNs; Firefox port; site-owner audit report.
- *Continue?* Yes — BrowserGate isn't fixed; the gap is real.
- *First step after today?* Publish to the Chrome Web Store as unlisted, get 10 PordaAI users
to try it.

**Closing**

- *Different from existing options?* Static/JShelter block for experts; Privacy Badger can't
see first-party scans; browserleaks' scanner is a one-site static check. We're the first to
tell an ordinary person *what a site tried to learn about them* and stop it in one click.
- *Help needed?* Store listing review, a designer for the icon/onboarding, contact with the
PordaAI/Deen Shield teams for the dataset.
- *Remember most?* "LinkedIn checked if you're Muslim. Now you can see it — and stop it."
- *Why win?* It answers every constraint in the brief with a working, tested, local-first
product that demonstrably prevents collection on real sites, not a slide.

## 6. What winning hackathon teams do (apply all)

1. **Demo first, slides second.** Judges remember what they saw work. Two slides before the
  demo, one after.
2. **One number they can repeat.** Ours: *5,000 probes → 0 found, with one click.*
3. **Let a judge touch it.** Hand over the mouse for the Protect click.
4. **Pre-empt the killer question.** "Doesn't this exist?" — answer it before they ask, by
  naming Static, JShelter and Privacy Badger and saying exactly what they miss.
5. **Show tests running, not a slide about tests.** Green terminal, 1 second.
6. **Rehearse to a timer, three times**, with the actual laptop, actual Wi-Fi, actual
  Chromium profile. Freeze code 4 h before.
7. **Backup video and offline path.** Wi-Fi fails at every hackathon.
8. **Answer follow-ups in ≤ 20 s, with a number or a file name**, then stop talking.
9. **Be honest about what's mocked.** The rubric asks explicitly; credibility is worth more
  than a hidden shortcut.
10. **Assign roles:** driver, speaker, and a "questions" person per category above.

