// Popup: one card. What happened → what it could reveal → what it learned about you →
// one action. `?tabId=N` overrides the active tab (used by tests).
(async () => {
  const app = document.getElementById("app");
  const hostEl = document.getElementById("host");

  const override = new URLSearchParams(location.search).get("tabId");
  let tabId = override ? Number(override) : undefined;
  if (tabId === undefined) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    tabId = tab?.id;
  }

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const list = (xs) => xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  const summary = await chrome.runtime.sendMessage({ type: "summary", tabId });
  hostEl.textContent = summary?.host ?? "";

  if (!summary || summary.severity === "none") {
    app.innerHTML = `<div class="card"><p class="headline">Nothing suspicious so far.</p>
      <p class="muted">This page hasn't tried to check your extensions or fingerprint your browser.</p></div>`;
    return;
  }

  const { inference: inf, host } = summary;
  const probes = inf.probes;
  const found = probes.targets.filter((t) => t.found);
  const fp = inf.fingerprint;
  const firstParty = inf.actors.some((a) => a.firstParty);
  const thirdParties = inf.actors.filter((a) => !a.firstParty).map((a) => a.origin.replace(/^https?:\/\//, ""));

  // --- what happened ---
  let happened = "";
  if (probes.count > 0) {
    happened += `<p class="headline">This site checked which extensions you have installed.</p>`;
    happened += `<p>It looked for <strong>${plural(probes.count, "extension")}</strong>`;
    if (probes.known) happened += `, including ${esc(list(probes.targets.filter((t) => t.known).slice(0, 3).map((t) => t.name)))}`;
    happened += `.</p>`;
  }
  if (fp.detected) {
    happened += probes.count
      ? `<p>It also took a <strong>device fingerprint</strong>`
      : `<p class="headline">This site took a device fingerprint.</p><p>It combined`;
    happened += ` using your ${esc(list(fp.surfaces.map(surfaceName)))} — a hidden ID that can follow you across sites without cookies.</p>`;
  }
  const who = firstParty && thirdParties.length
    ? `by the site itself and by ${esc(list(thirdParties))}`
    : firstParty ? `by the site's own code` : `by ${esc(list(thirdParties))}`;
  happened += `<p class="muted">Done ${who}.</p>`;

  // --- what it could reveal ---
  const traits = inf.traits.map((t) => `
    <div class="trait" data-trait="${esc(t.trait)}">
      <span class="dot ${esc(t.sensitivity)}"></span>
      <div><div class="label">${esc(t.label)}</div>
      <div class="evidence">${esc(explain(t))}</div></div>
    </div>`).join("");

  // --- what it learned about you ---
  let learned = "";
  if (probes.count > 0) {
    if (summary.protected && probes.blocked > 0) {
      learned = `<p class="ok">Nothing — ${plural(probes.blocked, "probe")} were blocked.</p>`;
    } else if (found.length) {
      learned = `<p><span class="found">${found.length} of ${probes.count}</span> extensions it looked for are on your browser: ${esc(list(found.map((t) => t.name ?? "an unrecognised extension")))}.</p>`;
    } else {
      learned = `<p class="ok">None of the extensions it looked for are installed.</p>`;
    }
  }
  if (fp.detected) learned += `<p>${summary.protected ? '<span class="ok">Fingerprint readings were altered</span>, so the ID it built is not stable.' : "It obtained a fingerprint of this device."}</p>`;

  // --- details ---
  const details = `
    <details><summary>Details</summary>
      <ul>
        ${probes.targets.map((t) => `<li><code>${esc(t.id)}</code> ${esc(t.name ?? "unrecognised")} · ${esc(t.vias.join(", "))}${t.found ? ' · <span class="found">found</span>' : ""}${t.blocked ? " · blocked" : ""}</li>`).join("")}
        ${fp.scripts.filter((s) => s.flagged).map((s) => `<li>fingerprint by <code>${esc(s.script)}</code>: ${esc(s.apis.join(", "))}</li>`).join("")}
      </ul>
    </details>`;

  app.innerHTML = `
    <div class="card">${happened}</div>
    ${traits ? `<h2>What it could reveal about you</h2><div class="card" id="traits">${traits}</div>` : ""}
    ${learned ? `<h2>What it learned about you</h2><div class="card" id="learned">${learned}</div>` : ""}
    <button class="primary ${summary.protected ? "on" : ""}" id="protect">${summary.protected ? "Protected on this site ✓" : "Protect me on this site"}</button>
    ${details}
    <p class="foot">Everything shown here was computed on your device. Nothing is sent anywhere.</p>`;

  const btn = document.getElementById("protect");
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const on = !summary.protected;
    await chrome.runtime.sendMessage({ type: "protect", host, on });
    btn.textContent = on ? "Protected — reloading…" : "Protection off — reloading…";
    btn.classList.toggle("on", on);
    if (!override) chrome.tabs.reload(tabId);
    setTimeout(() => location.reload(), 900);
  });

  function explain(t) {
    const parts = [];
    if (t.evidence.length) parts.push(`probed for ${list(t.evidence)}`);
    if (t.signals.length) parts.push(`${t.evidence.length ? "also " : ""}guessable from ${list(t.signals)}`);
    return parts.join("; ");
  }
  function surfaceName(f) {
    return { canvas: "graphics rendering", webgl: "graphics card", audio: "audio stack", navigator: "hardware details", intl: "time zone", fonts: "installed fonts" }[f] ?? f;
  }
})();
