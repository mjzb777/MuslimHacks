# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository state

Pre-implementation. The repo currently contains only `documents/` — no source code, build system, dependencies, or tests exist yet. There are no commands to build, lint, or test. When the first code lands, update this file with the real toolchain.

`documents/challenge.txt` is the project spec: MuslimHacks 2026, PPLUS Challenge 03 — Online Privacy. `documents/MuslimHacks-2026-Challenges.pdf` (untracked, ~31MB) is the full challenge booklet.

## What is being built

A tool that helps ordinary users **detect, understand, and prevent** unauthorized collection of their personal data online — going beyond blocklist-based tools (uBlock Origin, Ghostery, Privacy Badger) which depend on known domains and predefined rules.

Motivating case: the LinkedIn BrowserGate incident, where extension probing enumerated Islamic extensions (Deen Shield, PordaAI) — device/extension fingerprints that can leak sensitive traits such as religion. The gap the project targets is **visibility and control**, not more blocking.

## Design constraints from the brief

These are hard requirements from the challenge, not preferences — they should shape architecture decisions:

- **Local-first processing.** The tool must not become another privacy problem. Collect as little user data as possible; prefer on-device analysis over sending page/telemetry data to a server.
- **Don't break the web.** Blocking everything is a non-solution. Prevention must be targeted enough that sites keep working.
- **Prevention, not just detection.** Demos must show collection actually being reduced or stopped, not merely reported.
- **Explain, don't just block.** Surface what data was collected, who received it, and what it could reveal — legible to a non-technical person, with a clear action to take.
- **Detect beyond blocklists.** Fingerprinting, extension probing, unusual scripts, disguised third-party flows.
- **Manifest V3.** If the deliverable is a Chrome extension, the approach must work under MV3 restrictions (no blocking `webRequest`; use `declarativeNetRequest`, service workers instead of persistent background pages, and no remotely-hosted code).

Deliverable is a working MVP demonstrating **one** core workflow end to end — depth on a single flow beats breadth.

## Conventions

- Windows environment; the working directory is `E:\_dev\projects\MuslimHacks`.
- Main branch is `main`; commits push to `origin`.
- Multiple contributors are committing to this repo (hackathon team), so expect concurrent work on `main`.
