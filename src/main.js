import { recordSession } from './firebase.js';
import { startGame } from './game/game.js';
import { isAdmin, showAdminDashboard } from './admin.js';

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
