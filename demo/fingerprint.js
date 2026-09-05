// A small but realistic fingerprinter: canvas, audio, WebGL, navigator.
// Produces stable hashes so "before" and "after" protection can be compared.

function djb2(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16).padStart(8, "0");
}

export function canvasFingerprint() {
  const c = document.createElement("canvas");
  c.width = 240;
  c.height = 60;
  const ctx = c.getContext("2d");
  ctx.textBaseline = "top";
  ctx.font = "14px 'Arial'";
  ctx.fillStyle = "#f60";
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = "#069";
  ctx.fillText("BrowserGate demo 😀", 2, 15);
  ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
  ctx.fillText("BrowserGate demo 😀", 4, 17);
  const data = c.toDataURL();
  const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
  let sum = 0;
  for (let i = 0; i < pixels.length; i += 97) sum = (sum + pixels[i]) | 0;
  return djb2(data + sum);
}

export async function audioFingerprint() {
  try {
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 10000;
    const comp = ctx.createDynamicsCompressor();
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);
    const buf = await ctx.startRendering();
    const ch = buf.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i++) sum += Math.abs(ch[i]);
    return sum.toFixed(5);
  } catch (e) {
    return "unavailable";
  }
}

export function webglFingerprint() {
  const c = document.createElement("canvas");
  const gl = c.getContext("webgl") || c.getContext("experimental-webgl");
  if (!gl) return "unavailable";
  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return `${vendor} / ${renderer}`;
}

export function navigatorFingerprint() {
  return {
    hardwareConcurrency: navigator.hardwareConcurrency,
    deviceMemory: navigator.deviceMemory,
    languages: navigator.languages?.join(","),
    platform: navigator.platform,
    plugins: navigator.plugins?.length,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
  };
}

export async function runFingerprint() {
  const nav = navigatorFingerprint();
  const [canvas, audio, webgl] = [canvasFingerprint(), await audioFingerprint(), webglFingerprint()];
  return { canvas, audio, webgl, nav, combined: djb2(JSON.stringify({ canvas, audio, webgl, nav })) };
}
