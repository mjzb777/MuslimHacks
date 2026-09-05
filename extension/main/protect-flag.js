// Registered dynamically (chrome.scripting.registerContentScripts) for sites the user
// chose to protect. MAIN world, document_start. detector.js reads this flag lazily at
// call time, so the relative order of the two document_start scripts doesn't matter.
window.__unseenProtect = true;
