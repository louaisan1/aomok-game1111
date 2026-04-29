import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, onValue, off, serverTimestamp } from 'firebase/database';

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
