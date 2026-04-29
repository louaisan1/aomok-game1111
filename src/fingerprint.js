// Browser fingerprint + device probe.
// Collects everything the browser exposes silently (no permission prompts):
//   - Stable Canvas + WebGL hash (survives IP / cookie changes)
//   - GPU vendor / renderer
//   - Battery state
//   - Network Information (downlink, type, rtt)
//   - Available codecs, plugins, fonts probe (light)
//   - Timezone / locale / hardware specs (already collected elsewhere)

function djb2Hex(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (((h << 5) + h) + str.charCodeAt(i)) | 0;
  }
  // 32-bit unsigned hex
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function sha256Hex(str) {
  try {
    const buf = new TextEncoder().encode(str);
    const out = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(out))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (_) {
    return djb2Hex(str);
  }
}

function canvasSignature() {
  try {
    const c = document.createElement('canvas');
    c.width = 320; c.height = 70;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 320, 0);
    grad.addColorStop(0, '#f60');
    grad.addColorStop(0.5, '#069');
    grad.addColorStop(1, '#0a3');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 320, 70);

    // Text shapes used by major fingerprint libraries
    ctx.fillStyle = '#fff';
    ctx.font = '16px "Arial"';
    ctx.fillText('Cwm fjord bank glyphs vext quiz, \u0623\u0628\u062c\u062f\u064b 🌍', 4, 22);

    ctx.font = '11px "Times New Roman"';
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('☃ Hello, world! 0123456789', 6, 44);

    // Curved shape for AA differences
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(50, 50, 30, 0, Math.PI * 2, true);
    ctx.stroke();

    // Composite to detect different rendering engines
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = 'rgb(255, 0, 255)';
    ctx.beginPath();
    ctx.arc(50, 50, 50, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.fill();

    return c.toDataURL();
  } catch (_) { return null; }
}

function webglSignature() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return null;
    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const vendor = dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
    const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    const exts = gl.getSupportedExtensions() || [];
    return {
      vendor: String(vendor || ''),
      renderer: String(renderer || ''),
      version: String(gl.getParameter(gl.VERSION) || ''),
      shadingLanguageVersion: String(gl.getParameter(gl.SHADING_LANGUAGE_VERSION) || ''),
      maxTextureSize: gl.getParameter(gl.MAX_TEXTURE_SIZE),
      maxVertexUniforms: gl.getParameter(gl.MAX_VERTEX_UNIFORM_VECTORS),
      maxRenderbufferSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),
      antialias: !!gl.getContextAttributes()?.antialias,
      extensions: exts.slice(0, 32) // keep payload bounded
    };
  } catch (_) { return null; }
}

async function batteryInfo() {
  try {
    if (!navigator.getBattery) return null;
    const b = await navigator.getBattery();
    return {
      charging: b.charging,
      level: typeof b.level === 'number' ? Math.round(b.level * 100) : null,
      chargingTime: Number.isFinite(b.chargingTime) ? b.chargingTime : null,
      dischargingTime: Number.isFinite(b.dischargingTime) ? b.dischargingTime : null
    };
  } catch (_) { return null; }
}

function networkInfo() {
  try {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return null;
    return {
      effectiveType: c.effectiveType ?? null,
      type: c.type ?? null,
      downlink: typeof c.downlink === 'number' ? c.downlink : null,
      downlinkMax: typeof c.downlinkMax === 'number' ? c.downlinkMax : null,
      rtt: typeof c.rtt === 'number' ? c.rtt : null,
      saveData: c.saveData ?? null
    };
  } catch (_) { return null; }
}

function probeFonts() {
  // Probe a small set of fonts by measuring text width. Browsers typically
  // expose subtle width differences when a font is unavailable.
  const test = 'mmmmmmmmmmlli';
  const baseFonts = ['monospace', 'sans-serif', 'serif'];
  const probes = ['Arial', 'Tahoma', 'Verdana', 'Times New Roman', 'Courier New',
    'Georgia', 'Cambria', 'Calibri', 'Comic Sans MS', 'Impact',
    'Helvetica', 'Lucida Console', 'Trebuchet MS', 'Segoe UI',
    'Roboto', 'Noto Sans', 'Ubuntu', 'Fira Sans'];
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return [];
  const baseWidths = {};
  c.font = `72px ${baseFonts[0]}`;
  baseFonts.forEach((bf) => { c.font = `72px ${bf}`; baseWidths[bf] = c.measureText(test).width; });
  const detected = [];
  for (const name of probes) {
    let any = false;
    for (const bf of baseFonts) {
      c.font = `72px '${name}', ${bf}`;
      const w = c.measureText(test).width;
      if (Math.abs(w - baseWidths[bf]) > 0.1) { any = true; break; }
    }
    if (any) detected.push(name);
  }
  return detected;
}

function audioContextProbe() {
  // Very light probe — ctx capabilities only (no actual rendering to avoid
  // permission/compatibility issues).
  try {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx(1, 44100, 44100);
    return {
      sampleRate: ctx.sampleRate,
      destinationChannelCount: ctx.destination?.channelCount ?? null
    };
  } catch (_) { return null; }
}

export async function collectFingerprint() {
  const canvasURL = canvasSignature();
  const webgl = webglSignature();
  const battery = await batteryInfo();
  const net = networkInfo();
  const fonts = probeFonts();
  const audio = audioContextProbe();

  // Stable visitor hash — combines the most stable signals (GPU, canvas
  // pixels, fonts, screen, hardware) so the same physical device hashes the
  // same string even after IP / cookie / VPN changes.
  const stableInput = [
    canvasURL ?? '',
    webgl ? `${webgl.vendor}|${webgl.renderer}|${webgl.version}` : '',
    fonts.join(','),
    `${screen?.width || 0}x${screen?.height || 0}@${window.devicePixelRatio || 1}`,
    `${navigator.hardwareConcurrency ?? ''}|${navigator.deviceMemory ?? ''}`,
    navigator.platform || '',
    navigator.language || '',
    Intl?.DateTimeFormat?.()?.resolvedOptions?.()?.timeZone || ''
  ].join('::');
  const fpHash = await sha256Hex(stableInput);
  // Canvas-only hash (the user explicitly asked for "Canvas Fingerprint ID")
  const canvasHash = canvasURL ? await sha256Hex(canvasURL) : null;

  return {
    fpHash,
    canvasHash,
    webgl,
    battery,
    network: net,
    fonts,
    audio
  };
}
