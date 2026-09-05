// Pure inference: raw detector events → what happened, who did it, what it could reveal.
// No chrome.* calls, no I/O. Unit-tested in Node (tests/inference.test.js).

/** Trait taxonomy. `high` = GDPR Article 9 special categories. */
export const TRAITS = {
  religion:  { label: "Religion",             sensitivity: "high" },
  health:    { label: "Health or disability", sensitivity: "high" },
  politics:  { label: "Political views",      sensitivity: "high" },
  sexuality: { label: "Sexual orientation",   sensitivity: "high" },
  ethnicity: { label: "Ethnicity or origin",  sensitivity: "high" },
  union:     { label: "Union membership",     sensitivity: "high" },
  finance:   { label: "Financial situation",  sensitivity: "medium" },
  employer:  { label: "Employer",             sensitivity: "medium" },
  profession:{ label: "Profession",           sensitivity: "medium" },
  security:  { label: "Security setup",       sensitivity: "medium" },
  privacy:   { label: "Privacy-conscious",    sensitivity: "medium" },
  family:    { label: "Family or age",        sensitivity: "low" },
  location:  { label: "Location",            sensitivity: "low" },
};

const RANK = { high: 3, medium: 2, low: 1 };

/** Fingerprint API families that count as distinct "surfaces". */
function family(api) {
  return api.split(".")[0]; // canvas | webgl | audio | navigator | intl | fonts
}

export const FINGERPRINT_MIN_FAMILIES = 3;
export const FINGERPRINT_WINDOW_MS = 5000;

/**
 * @param {Array<object>} events   raw events from the detector
 * @param {Record<string, {name?: string, trait?: string|null, category?: string}>} extensionMap
 * @returns {{probes: object, traits: object[], fingerprint: object, actors: object[]}}
 */
export function infer(events, extensionMap = {}) {
  const probes = inferProbes(events, extensionMap);
  const fingerprint = inferFingerprint(events);
  const traits = mergeTraits([...probes.traits, ...fingerprint.traits]);
  const actors = inferActors(events);
  return { probes, fingerprint, traits, actors };
}

function inferProbes(events, extensionMap) {
  /** @type {Map<string, any>} */
  const targets = new Map();
  for (const e of events) {
    if (e.kind !== "ext-probe") continue;
    let t = targets.get(e.target);
    if (!t) {
      const meta = extensionMap[e.target];
      t = {
        id: e.target,
        known: !!meta,
        name: meta?.name ?? null,
        trait: meta?.trait ?? null,
        category: meta?.category ?? null,
        vias: new Set(),
        paths: new Set(),
        attempts: 0,
        blocked: 0,
        found: false,
      };
      targets.set(e.target, t);
    }
    t.vias.add(e.via);
    t.paths.add(e.path);
    t.attempts++;
    if (e.blocked) t.blocked++;
  }
  // Outcomes: a probe "found" the extension if any attempt succeeded.
  for (const e of events) {
    if (e.kind !== "probe-result" || !e.ok) continue;
    const t = targets.get(e.target);
    if (t) t.found = true;
  }
  const list = [...targets.values()].map((t) => ({ ...t, vias: [...t.vias], paths: [...t.paths] }));

  // trait → evidence (extension names)
  const byTrait = new Map();
  for (const t of list) {
    if (!t.trait || !TRAITS[t.trait]) continue;
    const arr = byTrait.get(t.trait) ?? [];
    arr.push(t.name ?? t.id);
    byTrait.set(t.trait, arr);
  }
  const traits = [...byTrait].map(([trait, evidence]) => ({
    trait,
    ...TRAITS[trait],
    evidence,          // extension names the site probed for
    signals: [],       // fingerprint-derived hints
    source: "extension-probe",
  }));

  return {
    count: list.length,
    known: list.filter((t) => t.known).length,
    unknown: list.filter((t) => !t.known).length,
    attempts: list.reduce((n, t) => n + t.attempts, 0),
    blocked: list.reduce((n, t) => n + t.blocked, 0),
    found: list.filter((t) => t.found).length,
    // Most sensitive first, then found-on-this-browser, then by name. Untagged rank 0.
    targets: list.sort((a, b) =>
      (RANK[TRAITS[b.trait]?.sensitivity] ?? 0) - (RANK[TRAITS[a.trait]?.sensitivity] ?? 0) ||
      Number(b.found) - Number(a.found) ||
      (a.name ?? a.id).localeCompare(b.name ?? b.id)),
    traits,
  };
}

function inferFingerprint(events) {
  /** @type {Map<string, any>} */
  const byScript = new Map();
  for (const e of events) {
    if (e.kind !== "fp-api") continue;
    let s = byScript.get(e.script);
    if (!s) {
      s = { script: e.script, scriptOrigin: e.scriptOrigin, firstParty: e.firstParty, apis: new Set(), calls: [] };
      byScript.set(e.script, s);
    }
    s.apis.add(e.api);
    s.calls.push({ ts: e.ts, family: family(e.api) });
  }

  const scripts = [];
  for (const s of byScript.values()) {
    // Sliding window: max number of distinct families seen within FINGERPRINT_WINDOW_MS.
    const calls = s.calls.sort((a, b) => a.ts - b.ts);
    let best = 0;
    for (let i = 0; i < calls.length; i++) {
      const fams = new Set();
      for (let j = i; j < calls.length && calls[j].ts - calls[i].ts <= FINGERPRINT_WINDOW_MS; j++) fams.add(calls[j].family);
      best = Math.max(best, fams.size);
    }
    const families = [...new Set(calls.map((c) => c.family))];
    scripts.push({
      script: s.script,
      scriptOrigin: s.scriptOrigin,
      firstParty: s.firstParty,
      apis: [...s.apis],
      families,
      flagged: best >= FINGERPRINT_MIN_FAMILIES,
    });
  }

  const flagged = scripts.filter((s) => s.flagged);
  const apis = new Set(flagged.flatMap((s) => s.apis));
  const traits = [];
  const hint = (trait, signal) => ({ trait, ...TRAITS[trait], evidence: [], signals: [signal], source: "fingerprint" });
  if (apis.has("navigator.languages") || apis.has("fonts.measureText") || apis.has("fonts.check")) {
    traits.push(hint("ethnicity", "your language and font settings"));
  }
  if (apis.has("intl.timeZone") || apis.has("navigator.languages")) {
    traits.push(hint("location", "your time zone and language"));
  }
  if (apis.has("navigator.deviceMemory") || apis.has("navigator.hardwareConcurrency") || apis.has("webgl.getParameter")) {
    traits.push(hint("finance", "how powerful your device is"));
  }

  return {
    detected: flagged.length > 0,
    scripts,
    surfaces: [...new Set(flagged.flatMap((s) => s.families))],
    traits,
  };
}

function mergeTraits(traits) {
  const merged = new Map();
  for (const t of traits) {
    const m = merged.get(t.trait);
    if (!m) merged.set(t.trait, { ...t, evidence: [...t.evidence], signals: [...(t.signals ?? [])], sources: [t.source] });
    else {
      m.evidence.push(...t.evidence.filter((e) => !m.evidence.includes(e)));
      m.signals.push(...(t.signals ?? []).filter((e) => !m.signals.includes(e)));
      if (!m.sources.includes(t.source)) m.sources.push(t.source);
    }
  }
  // Order: sensitivity, then evidence strength (a named extension probe is concrete;
  // a fingerprint-derived trait is statistical), then label.
  const strength = (t) => (t.sources.includes("extension-probe") ? 1 : 0);
  return [...merged.values()]
    .map(({ source, ...t }) => t)
    .sort((a, b) => RANK[b.sensitivity] - RANK[a.sensitivity] || strength(b) - strength(a) || a.label.localeCompare(b.label));
}

/** Who did the collecting: distinct script origins, with what they did. */
function inferActors(events) {
  const actors = new Map();
  for (const e of events) {
    if (e.kind !== "ext-probe" && e.kind !== "fp-api") continue;
    const key = e.scriptOrigin || "(unknown)";
    let a = actors.get(key);
    if (!a) {
      a = { origin: key, firstParty: !!e.firstParty, probes: 0, fingerprintApis: new Set(), scripts: new Set() };
      actors.set(key, a);
    }
    if (e.kind === "ext-probe") a.probes++;
    else a.fingerprintApis.add(e.api);
    if (e.script) a.scripts.add(e.script);
  }
  return [...actors.values()].map((a) => ({ ...a, fingerprintApis: [...a.fingerprintApis], scripts: [...a.scripts] }));
}

/** Highest sensitivity present, for the badge. */
export function severity(inference) {
  const top = inference.traits[0]?.sensitivity;
  if (top) return top;
  if (inference.probes.count > 0 || inference.fingerprint.detected) return "low";
  return "none";
}
