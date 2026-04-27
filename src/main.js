import { recordSession } from './firebase.js';
import { startGame } from './game/game.js';

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

  const btn = document.getElementById('enter-btn');
  btn.disabled = true;
  setStatus('جاري الاتصال بـ Firebase…');

  let sessionId = null;
  try {
    sessionId = await Promise.race([
      recordSession({ name, room }),
      new Promise((res) => setTimeout(() => res(null), 4000))
    ]);
    if (sessionId) {
      setStatus('تم التسجيل. لحظة من فضلك…', 'ok');
    } else {
      setStatus('سيبدأ اللعب في وضع غير متصل (تخطّي تسجيل Firebase).', 'ok');
    }
  } catch (err) {
    console.warn('Firebase issue:', err);
    setStatus('سيبدأ اللعب في وضع غير متصل.', 'ok');
  }

  document.getElementById('register-overlay').classList.add('hidden');

  startGame({ name, room: Number(room), sessionId });
});
