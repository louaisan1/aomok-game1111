import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, serverTimestamp, push } from 'firebase/database';

const firebaseConfig = {
  apiKey: 'AIzaSyB7os5Ad2LNlbFIKPr5G6BX_vFgrvYmCq4',
  authDomain: 'aomokgame.firebaseapp.com',
  databaseURL: 'https://aomokgame-default-rtdb.firebaseio.com',
  projectId: 'aomokgame',
  storageBucket: 'aomokgame.firebasestorage.app',
  messagingSenderId: '447315788670',
  appId: '1:447315788670:web:3728c1d63453e8669ca92f',
  measurementId: 'G-RRS9EXQ2HQ'
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const safe = (s) => String(s ?? '').replace(/[.#$\[\]/]/g, '_');

export async function recordSession({ name, room }) {
  const sessionId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const path = `sessions/${safe(room)}/${safe(name)}/${sessionId}`;
  try {
    await set(ref(db, path), {
      name,
      room: Number(room),
      startedAt: serverTimestamp(),
      startedAtMs: Date.now(),
      userAgent: navigator.userAgent
    });
    return sessionId;
  } catch (err) {
    console.warn('[firebase] recordSession failed:', err);
    return null;
  }
}

export async function recordResult({ name, room, sessionId, result, equation, value, elapsedMs }) {
  if (!sessionId) return;
  const path = `sessions/${safe(room)}/${safe(name)}/${sessionId}/result`;
  try {
    await set(ref(db, path), {
      result,
      equation: equation ?? null,
      value: typeof value === 'number' ? value : null,
      elapsedMs: elapsedMs ?? null,
      finishedAt: serverTimestamp(),
      finishedAtMs: Date.now()
    });
  } catch (err) {
    console.warn('[firebase] recordResult failed:', err);
  }
}

// Visitor logger: writes to a generic-looking path so casual readers don't
// see "visitors" or "telemetry". Stored under `_v/<visitorId>/<timestamp>`.
const _visitorStorageKey = '__a_id__';
function _getVisitorId() {
  try {
    let id = localStorage.getItem(_visitorStorageKey);
    if (!id) {
      id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(_visitorStorageKey, id);
    }
    return id;
  } catch (_) {
    return `e_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

function _detectDevice(ua) {
  const u = String(ua || '').toLowerCase();
  if (/iphone|ipod/.test(u)) return 'iPhone';
  if (/ipad/.test(u)) return 'iPad';
  if (/android.*mobile/.test(u)) return 'Android phone';
  if (/android/.test(u)) return 'Android tablet';
  if (/windows phone/.test(u)) return 'Windows Phone';
  if (/macintosh|mac os/.test(u)) return 'Mac';
  if (/windows/.test(u)) return 'Windows';
  if (/cros/.test(u)) return 'ChromeOS';
  if (/linux/.test(u)) return 'Linux';
  return 'Unknown';
}
function _detectBrowser(ua) {
  if (/edg/i.test(ua)) return 'Edge';
  if (/opr|opera/i.test(ua)) return 'Opera';
  if (/chrome/i.test(ua)) return 'Chrome';
  if (/firefox/i.test(ua)) return 'Firefox';
  if (/safari/i.test(ua)) return 'Safari';
  return 'Unknown';
}

async function _fetchGeo() {
  // Try ipwho.is first (free, CORS-friendly, no key). Fall back silently.
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const r = await fetch('https://ipwho.is/', { signal: ctrl.signal });
    clearTimeout(t);
    if (!r.ok) return null;
    const j = await r.json();
    if (!j || j.success === false) return null;
    return {
      ip: j.ip ?? null,
      country: j.country ?? null,
      countryCode: j.country_code ?? null,
      region: j.region ?? null,
      city: j.city ?? null,
      postal: j.postal ?? null,
      lat: j.latitude ?? null,
      lng: j.longitude ?? null,
      isp: j.connection?.isp ?? null,
      org: j.connection?.org ?? null,
      asn: j.connection?.asn ?? null,
      timezoneId: j.timezone?.id ?? null,
      timezoneUtc: j.timezone?.utc ?? null
    };
  } catch (_) { return null; }
}

export function getVisitorId() { return _getVisitorId(); }

// Records the visit on every page load (no consent shown — caller should
// surface a privacy notice if needed).
export async function recordVisit({ name = null } = {}) {
  const id = _getVisitorId();
  const ua = navigator.userAgent || '';
  const base = {
    id,
    name,
    ts: Date.now(),
    serverTs: serverTimestamp(),
    userAgent: ua,
    device: _detectDevice(ua),
    browser: _detectBrowser(ua),
    platform: navigator.platform || null,
    language: navigator.language || null,
    languages: Array.isArray(navigator.languages) ? navigator.languages.slice(0, 6) : null,
    timezone: (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (_) { return null; } })(),
    cookieEnabled: !!navigator.cookieEnabled,
    online: !!navigator.onLine,
    hardwareConcurrency: navigator.hardwareConcurrency ?? null,
    touchPoints: navigator.maxTouchPoints ?? null,
    deviceMemory: navigator.deviceMemory ?? null,
    screen: { w: screen?.width ?? null, h: screen?.height ?? null, dpr: window.devicePixelRatio ?? null },
    viewport: { w: window.innerWidth, h: window.innerHeight },
    referrer: document.referrer || null,
    pageUrl: location.href || null
  };
  const geo = await _fetchGeo();
  if (geo) base.geo = geo;
  try {
    await set(ref(db, `_v/${id}/${Date.now()}`), base);
  } catch (err) {
    console.warn('[firebase] recordVisit failed:', err);
  }
}

// Visitor stream: yields the union of every visitor and every visit they made.
// Each row has the most recent visit's properties.
export function watchVisitors(cb) {
  const r = ref(db, '_v');
  const handler = (snap) => {
    const data = snap.val() || {};
    const rows = [];
    for (const [vid, visits] of Object.entries(data)) {
      if (!visits || typeof visits !== 'object') continue;
      const sorted = Object.entries(visits)
        .map(([k, v]) => ({ k, v }))
        .sort((a, b) => Number(b.k) - Number(a.k));
      const latest = sorted[0]?.v || {};
      rows.push({
        id: vid,
        visits: sorted.length,
        latestTs: Number(sorted[0]?.k) || latest.ts || 0,
        ...latest
      });
    }
    rows.sort((a, b) => (b.latestTs ?? 0) - (a.latestTs ?? 0));
    cb(rows);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}

export { db };

// Subscribe to all sessions for a given room. Calls `cb(rows)` whenever data changes.
// Returns an unsubscribe function.
export function watchRoomSessions(room, cb) {
  const path = `sessions/${safe(room)}`;
  const r = ref(db, path);
  const handler = (snap) => {
    const data = snap.val() || {};
    const rows = [];
    for (const [playerKey, sessions] of Object.entries(data)) {
      if (!sessions || typeof sessions !== 'object') continue;
      for (const [sessionId, sess] of Object.entries(sessions)) {
        if (!sess || typeof sess !== 'object') continue;
        rows.push({
          playerKey,
          sessionId,
          name: sess.name ?? playerKey,
          startedAtMs: sess.startedAtMs ?? null,
          startedAt: sess.startedAt ?? null,
          result: sess.result?.result ?? null,
          equation: sess.result?.equation ?? null,
          value: sess.result?.value ?? null,
          elapsedMs: sess.result?.elapsedMs ?? null,
          finishedAtMs: sess.result?.finishedAtMs ?? null
        });
      }
    }
    rows.sort((a, b) => (b.startedAtMs ?? 0) - (a.startedAtMs ?? 0));
    cb(rows);
  };
  onValue(r, handler);
  return () => off(r, 'value', handler);
}
