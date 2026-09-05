import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { infer, severity, TRAITS } from "../extension/background/inference.js";

const extensions = JSON.parse(readFileSync(new URL("../extension/data/extensions.json", import.meta.url)));
const FAKE = "clogkfmebiojffofnmadeeekpjpppeop";
const PAGE = { script: "http://site.test/app.js", scriptOrigin: "http://site.test", firstParty: true };
const THIRD = { script: "https://cdn.tracker.test/fp.js", scriptOrigin: "https://cdn.tracker.test", firstParty: false };

const probe = (target, via = "fetch", extra = {}) => ({ kind: "ext-probe", target, path: "/x.png", via, blocked: false, ts: 1000, ...PAGE, ...extra });
const fp = (api, ts = 1000, who = PAGE) => ({ kind: "fp-api", api, blocked: false, ts, ...who });

test("data file: every trait is a known trait key", () => {
  for (const [id, meta] of Object.entries(extensions)) {
    if (id.startsWith("_")) continue;
    assert.match(id, /^[a-p]{32}$/, `bad id ${id}`);
    assert.ok(meta.trait === null || TRAITS[meta.trait], `${id} has unknown trait ${meta.trait}`);
  }
});

test("probe for the fake Deen Shield → religion / high", () => {
  const r = infer([probe(FAKE, "img"), probe(FAKE, "fetch")], extensions);
  assert.equal(r.probes.count, 1);
  assert.equal(r.probes.attempts, 2);
  assert.deepEqual(r.probes.targets[0].vias.sort(), ["fetch", "img"]);
  assert.equal(r.traits.length, 1);
  assert.equal(r.traits[0].trait, "religion");
  assert.equal(r.traits[0].sensitivity, "high");
  assert.deepEqual(r.traits[0].evidence, ["Deen Shield (test stand-in)"]);
  assert.equal(severity(r), "high");
});

test("mixed probes aggregate by trait and sort high → low", () => {
  const ids = Object.keys(extensions).filter((k) => !k.startsWith("_"));
  const r = infer(ids.map((id) => probe(id)), extensions);
  assert.equal(r.probes.count, ids.length);
  assert.equal(r.probes.unknown, 0);
  const order = r.traits.map((t) => t.sensitivity);
  assert.deepEqual(order, [...order].sort((a, b) => ({ high: 3, medium: 2, low: 1 })[b] - ({ high: 3, medium: 2, low: 1 })[a]));
  assert.equal(r.traits[0].sensitivity, "high");
  const high = r.traits.filter((t) => t.sensitivity === "high").map((t) => t.trait);
  assert.ok(high.includes("religion") && high.includes("health"), `high traits: ${high}`);
  const religion = r.traits.find((t) => t.trait === "religion");
  assert.ok(religion.evidence.includes("PordaAI"));
  // Probed-target list leads with the most sensitive extensions, untagged ones last.
  assert.equal(r.probes.targets[0].trait && TRAITS[r.probes.targets[0].trait].sensitivity, "high");
  assert.equal(r.probes.targets.at(-1).trait, null);
  const privacy = r.traits.find((t) => t.trait === "privacy");
  assert.ok(privacy.evidence.includes("uBlock Origin"));
  assert.ok(privacy.evidence.length >= 5);
});

test("unknown extension IDs are counted but produce no traits", () => {
  const r = infer([probe("a".repeat(32)), probe("b".repeat(32))], extensions);
  assert.equal(r.probes.count, 2);
  assert.equal(r.probes.unknown, 2);
  assert.equal(r.traits.length, 0);
  assert.equal(severity(r), "low");
});

test("canvas alone is not fingerprinting", () => {
  const r = infer([fp("canvas.toDataURL"), fp("canvas.getImageData", 1100)], extensions);
  assert.equal(r.fingerprint.detected, false);
  assert.equal(r.fingerprint.scripts[0].flagged, false);
  assert.equal(r.traits.length, 0);
});

test("canvas + audio + navigator within 5s is fingerprinting", () => {
  const r = infer([fp("canvas.toDataURL", 1000), fp("audio.startRendering", 2000), fp("navigator.hardwareConcurrency", 3000)], extensions);
  assert.equal(r.fingerprint.detected, true);
  assert.deepEqual(r.fingerprint.surfaces.sort(), ["audio", "canvas", "navigator"]);
  const fin = r.traits.find((t) => t.trait === "finance");
  assert.ok(fin, "hardware → wealth proxy");
  assert.deepEqual(fin.evidence, []);
  assert.equal(fin.signals.length, 1);
});

test("three surfaces spread over >5s do not trigger", () => {
  const r = infer([fp("canvas.toDataURL", 0), fp("audio.startRendering", 6000), fp("navigator.hardwareConcurrency", 12000)], extensions);
  assert.equal(r.fingerprint.detected, false);
});

test("fingerprinting with language/timezone/fonts adds ethnicity and location", () => {
  const r = infer([fp("canvas.toDataURL"), fp("navigator.languages"), fp("intl.timeZone"), fp("fonts.measureText")], extensions);
  const traits = r.traits.map((t) => t.trait);
  assert.ok(traits.includes("ethnicity"));
  assert.ok(traits.includes("location"));
  const eth = r.traits.find((t) => t.trait === "ethnicity");
  assert.deepEqual(eth.evidence, [], "fingerprint hints are signals, not probe evidence");
  assert.equal(eth.signals.length, 1);
  assert.equal(r.traits[0].trait, "ethnicity", "high sensitivity first");
});

test("same sensitivity: probe-backed traits rank above fingerprint-inferred ones", () => {
  // religion (probe) and ethnicity (fingerprint) are both high; alphabetically ethnicity would win.
  const r = infer([probe(FAKE), fp("canvas.toDataURL"), fp("navigator.languages"), fp("audio.startRendering")], extensions);
  assert.deepEqual(r.traits.slice(0, 2).map((t) => t.trait), ["religion", "ethnicity"]);
  assert.deepEqual(r.traits[0].sources, ["extension-probe"]);
  assert.deepEqual(r.traits[1].sources, ["fingerprint"]);
});

test("actors: first- and third-party origins are separated", () => {
  const r = infer([probe(FAKE), fp("canvas.toDataURL", 1000, THIRD), fp("audio.startRendering", 1000, THIRD), fp("webgl.getParameter", 1000, THIRD)], extensions);
  assert.equal(r.actors.length, 2);
  const first = r.actors.find((a) => a.firstParty);
  const third = r.actors.find((a) => !a.firstParty);
  assert.equal(first.probes, 1);
  assert.equal(third.fingerprintApis.length, 3);
  assert.equal(r.fingerprint.scripts.find((s) => !s.firstParty).flagged, true);
});

test("probe results mark which extensions the site actually found", () => {
  const other = "b".repeat(32);
  const r = infer([
    probe(FAKE, "img"), probe(FAKE, "fetch"), probe(other, "img"),
    { kind: "probe-result", target: FAKE, ok: false, ts: 1001 },
    { kind: "probe-result", target: FAKE, ok: true, ts: 1002 },
    { kind: "probe-result", target: other, ok: false, ts: 1003 },
    { kind: "probe-result", target: "c".repeat(32), ok: true, ts: 1004 }, // never probed → ignored
  ], extensions);
  assert.equal(r.probes.found, 1);
  assert.equal(r.probes.targets.find((t) => t.id === FAKE).found, true);
  assert.equal(r.probes.targets.find((t) => t.id === other).found, false);
});

test("blocked probes are tallied", () => {
  const r = infer([probe(FAKE, "img", { blocked: true }), probe(FAKE, "fetch", { blocked: true })], extensions);
  assert.equal(r.probes.blocked, 2);
});

test("empty input → nothing", () => {
  const r = infer([], extensions);
  assert.equal(r.probes.count, 0);
  assert.equal(r.fingerprint.detected, false);
  assert.equal(severity(r), "none");
});
