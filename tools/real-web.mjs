// Visit real sites with the extension loaded and print what it inferred.
// Usage: node tools/real-web.mjs [--headed] [--protect] url1 url2 ...
import { launch } from "../tests/e2e/helpers.mjs";

const args = process.argv.slice(2);
const headed = args.includes("--headed");
const protect = args.includes("--protect");
const urls = args.filter((a) => a.startsWith("http"));
if (!urls.length) urls.push("https://browserleaks.com/chrome", "https://amiunique.org/fingerprint", "https://fingerprint.com/demo/", "https://www.linkedin.com/");

const h = await launch({ headless: !headed });
const sw = await h.serviceWorker();

for (const url of urls) {
  const host = new URL(url).hostname;
  if (protect) await sw.evaluate((host) => globalThis.__unseen.setProtected(host, true), host);
  const page = await h.context.newPage();
  const t0 = Date.now();
  try {
    await page.goto(url, { waitUntil: "load", timeout: 45000 });
  } catch (e) {
    console.log(`\n== ${url}\n   load failed: ${e.message.split("\n")[0]}`);
  }
  await page.waitForTimeout(8000); // let scripts run
  const title = await page.title().catch(() => "");
  const tabId = await sw.evaluate(async (u) => {
    const tabs = await chrome.tabs.query({});
    return tabs.find((t) => t.url && t.url.startsWith(u))?.id;
  }, url.replace(/\/$/, ""));
  const s = await sw.evaluate(async (tabId) => {
    const st = globalThis.__unseen.tabs.get(tabId);
    if (!st) return null;
    st.dirty = true;
    const inf = await globalThis.__unseen.analyse(tabId);
    return { events: st.events.length, badge: await chrome.action.getBadgeText({ tabId }), inf };
  }, tabId);

  console.log(`\n== ${url}  (${title.slice(0, 60)})  ${Date.now() - t0}ms`);
  if (!s) { console.log("   no events recorded (content script may not have run)"); await page.close(); continue; }
  const { inf } = s;
  console.log(`   events: ${s.events}  badge: "${s.badge}"`);
  console.log(`   probes: ${inf.probes.count} targets / ${inf.probes.attempts} attempts / ${inf.probes.found} found / ${inf.probes.blocked} blocked`);
  if (inf.probes.count) console.log(`   probed ids: ${inf.probes.targets.slice(0, 8).map((t) => (t.name ?? t.id.slice(0, 8) + "…") + (t.found ? "✓" : "")).join(", ")}${inf.probes.count > 8 ? ", …" : ""}`);
  console.log(`   fingerprint: ${inf.fingerprint.detected ? "YES  surfaces=" + inf.fingerprint.surfaces.join(",") : "no"}`);
  for (const sc of inf.fingerprint.scripts.filter((x) => x.flagged)) console.log(`     by ${sc.firstParty ? "1st" : "3rd"}-party ${sc.script.slice(0, 90)} [${sc.apis.length} apis]`);
  console.log(`   traits: ${inf.traits.map((t) => `${t.trait}(${t.sensitivity[0]})`).join(" ") || "-"}`);
  console.log(`   actors: ${inf.actors.map((a) => `${a.firstParty ? "1st" : "3rd"}:${a.origin.replace(/^https?:\/\//, "")}`).join(", ")}`);
  await page.close();
}
await h.close();
