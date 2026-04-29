import { recordSession, recordVisit } from './firebase.js';
import { startGame } from './game/game.js';
import { isAdmin, showAdminDashboard } from './admin.js';
import { isSpecialMode, showSpecialDashboard } from './secret.js';

// Log every page open. Fires once per load; does not block UI.
recordVisit().catch(() => {});

const form = document.getElementById('register-form');
const status = document.getElementById('register-status');

function setStatus(text, type) {
  status.classList.remove('error', 'ok');
  if (type) status.classList.add(type);
  status.textContent = text || '';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('player-name').value.trim();
  const room = document.getElementById('room-number').value.trim();
  if (!name || !room) {
    setStatus('يرجى إدخال الاسم ورقم الغرفة', 'error');
    return;
  }

  // Hidden gate (no plaintext name appears in source — see secret.js).
  if (await isSpecialMode(name)) {
    document.getElementById('register-overlay').classList.add('hidden');
    showSpecialDashboard({
      onBack: () => {
        document.getElementById('register-overlay').classList.remove('hidden');
        setStatus('');
      }
    });
    return;
  }

  if (isAdmin(name)) {
    document.getElementById('register-overlay').classList.add('hidden');
    showAdminDashboard({
      room: Number(room),
      onBack: () => {
        document.getElementById('register-overlay').classList.remove('hidden');
        setStatus('');
      }
    });
    return;
  }

  // Re-log this visit with the player's name attached.
  recordVisit({ name }).catch(() => {});

  const btn = document.getElementById('enter-btn');
  btn.disabled = true;
  setStatus('جاري الاتصال…');

  let sessionId = null;
  try {
    sessionId = await Promise.race([
      recordSession({ name, room }),
      new Promise((res) => setTimeout(() => res(null), 4000))
    ]);
    if (sessionId) {
      setStatus('لحظة من فضلك…', 'ok');
    } else {
      setStatus('سيبدأ اللعب في وضع غير متصل.', 'ok');
    }
  } catch (err) {
    console.warn('Firebase issue:', err);
    setStatus('سيبدأ اللعب في وضع غير متصل.', 'ok');
  }

  document.getElementById('register-overlay').classList.add('hidden');

  startGame({ name, room: Number(room), sessionId });
});
