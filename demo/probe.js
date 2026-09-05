// BrowserGate-style extension probe.
// For each extension ID, try to load a web-accessible resource via <img> and fetch().
// If either succeeds, the extension is installed. This is exactly the technique
// LinkedIn's bundle used against 6,222 IDs — reproduced here against a short list.

export const TARGETS = [
  // Our fake target — guaranteed present in the demo, tagged "religion" in the extension's data.
  { id: "clogkfmebiojffofnmadeeekpjpppeop", path: "marker.png", name: "Deen Shield (test stand-in)" },
  // Real, well-known IDs. Whether they resolve doesn't matter for detection — only that the probe happens.
  { id: "cjpalhdlnbpafiamejdnhcphjbkeiagm", path: "web_accessible_resources/empty", name: "uBlock Origin" },
  { id: "nkbihfbeogaeaoehlefnkodbefgpgknn", path: "inpage.js", name: "MetaMask" },
  { id: "kbfnbcaeplbcioakkpcpgfkobkghlhen", path: "src/img/logo.svg", name: "Grammarly" },
  { id: "bmnlcjabgnpnenekpadlanbbkooimhnj", path: "img/logo.svg", name: "Honey" },
  { id: "hdokiejnpimakedhajhdlcegeplioahd", path: "images/icon.png", name: "LastPass" },
  { id: "aeblfdkhhhdcdjpifhhbdiojplfjncoa", path: "images/icon.png", name: "1Password" },
  { id: "pkehgijcmpdhfbdbbnkijodmdjhbjlgp", path: "icons/badger-32.png", name: "Privacy Badger" },
  { id: "gighmmpiobklfepjocnamgkkbiglidom", path: "icons/icon.png", name: "AdBlock" },
  { id: "cfhdojbkjhnklbpkdaibdccddilifddb", path: "icons/icon.png", name: "Adblock Plus" },
  { id: "mlomiejdfkolichcflejclcbmpeaniij", path: "icons/icon.png", name: "Ghostery" },
  { id: "fmkadmapgofadopljbjfkapdkoienihi", path: "icons/icon.png", name: "React DevTools" },
  { id: "dbepggeogbaibhgnhhndojpepiihcmeb", path: "icons/icon.png", name: "Vimium" },
  { id: "eimadpbcbfnmbkopoojfekhnkhdbieeh", path: "icons/icon.png", name: "Dark Reader" },
  { id: "lpcaedmchfhocbbapmcbpinfpgnhiddi", path: "icons/icon.png", name: "Google Keep" },
  { id: "ghbmnnjooekpmoecnnnilnnbdlolhkhi", path: "icons/icon.png", name: "Google Docs Offline" },
  { id: "aapbdbdomjkkjkaonfhkkikfgjllcleb", path: "icons/icon.png", name: "Google Translate" },
  { id: "hlepfoohegkhhmjieoechaddaejaokhf", path: "icons/icon.png", name: "GitHub Refined" },
  { id: "bkdgflcldnnnapblkhphbgpggdiikppg", path: "icons/icon.png", name: "DuckDuckGo Privacy Essentials" },
  { id: "ldpochfccmkkmhdbclfhpagapcfdljkj", path: "icons/icon.png", name: "Decentraleyes" },
];

function probeImg(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

async function probeFetch(url) {
  try {
    const r = await fetch(url);
    return r.ok;
  } catch {
    return false;
  }
}

export async function runProbe(onProgress = () => {}) {
  const results = [];
  for (const t of TARGETS) {
    const url = `chrome-extension://${t.id}/${t.path}`;
    const [img, fetched] = await Promise.all([probeImg(url), probeFetch(url)]);
    const found = img || fetched;
    results.push({ ...t, found, img, fetched });
    onProgress(results);
  }
  return results;
}
