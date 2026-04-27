import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, serverTimestamp } from 'firebase/database';

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
      finishedAt: serverTimestamp()
    });
  } catch (err) {
    console.warn('[firebase] recordResult failed:', err);
  }
}
