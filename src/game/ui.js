export function setupHUD({ name, room }) {
  document.getElementById('hud-name').textContent = name;
  document.getElementById('hud-room').textContent = String(room);
  document.getElementById('hud').classList.remove('hidden');
}

// Live equation display: shows current open-order tokens.
export function updateLiveEquation(openOrder, doors) {
  const el = document.getElementById('live-equation');
  const tokens = document.getElementById('le-tokens');
  if (!openOrder || openOrder.length === 0) {
    el.classList.add('hidden');
    tokens.innerHTML = '';
    return;
  }
  el.classList.remove('hidden');
  tokens.innerHTML = '';
  openOrder.forEach((doorIndex) => {
    const d = doors[doorIndex];
    const t = d.token;
    const display = t === '*' ? '×' : t === '/' ? '÷' : t;
    const span = document.createElement('span');
    span.className = 'le-tok';
    span.innerHTML = `${display}<small>${doorIndex + 1}</small>`;
    tokens.appendChild(span);
  });
}

export function showResult({ won, name, equation, value, message }) {
  const overlay = document.getElementById('result-overlay');
  overlay.classList.remove('hidden');
  const panel = overlay.querySelector('.panel');
  panel.classList.remove('win', 'lose');
  panel.classList.add(won ? 'win' : 'lose');
  document.getElementById('result-title').textContent = won
    ? `🏆 مبروك ${name}!`
    : 'انتهت اللعبة';
  const safeName = escapeHtml(name);
  const safeEq = escapeHtml(equation || '');
  const safeMsg = escapeHtml(message || 'انتهى الوقت قبل أن تجد الحل.');
  // Wrap the equation in an LTR-isolated span so it always reads left-to-right
  // regardless of the page's RTL context.
  const html = won
    ? `أحسنت ${safeName}! انفتحت لك غرفة الكنز.${equation ? ` المعادلة: <span class="ltr-eq">${safeEq} = ${value}</span>` : ''}`
    : safeMsg;
  document.getElementById('result-text').innerHTML = html;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class TimerUI {
  constructor({ durationMs, onTimeout }) {
    this.durationMs = durationMs;
    this.onTimeout = onTimeout;
    this.startedAt = null;
    this.endedAt = null;
    this.expired = false;
    this.el = document.getElementById('timer');
    this.wrap = document.getElementById('timer-wrap');
  }
  startTimer() {
    if (this.startedAt) return;
    this.startedAt = performance.now();
    this.wrap.classList.remove('hidden');
  }
  stopTimer() {
    if (this.endedAt == null) this.endedAt = performance.now();
  }
  elapsed() {
    if (!this.startedAt) return 0;
    const end = this.endedAt ?? performance.now();
    return end - this.startedAt;
  }
  remaining() {
    if (!this.startedAt) return this.durationMs;
    const e = performance.now() - this.startedAt;
    return Math.max(0, this.durationMs - e);
  }
  // 0..1 progress (0 = just started, 1 = expired). Used for water rise.
  progress() {
    if (!this.startedAt) return 0;
    const e = performance.now() - this.startedAt;
    return Math.max(0, Math.min(1, e / this.durationMs));
  }
  tick() {
    if (!this.startedAt || this.expired) return;
    const r = this.remaining();
    const m = Math.floor(r / 60000);
    const s = Math.floor((r % 60000) / 1000);
    this.el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    if (r < 30000) this.el.classList.add('warn');
    if (r === 0) {
      this.expired = true;
      this.endedAt = performance.now();
      if (this.onTimeout) this.onTimeout();
    }
  }
}

const promptEl = () => document.getElementById('prompt');
export function showPrompt(html) {
  const el = promptEl();
  el.innerHTML = html;
  el.classList.remove('hidden');
}
export function hidePrompt() {
  promptEl().classList.add('hidden');
}

const noticeEl = () => document.getElementById('big-notice');
let noticeTimer = null;
export function showBigNotice(html, durationMs = 4500) {
  const el = noticeEl();
  el.innerHTML = html;
  el.classList.remove('hidden');
  if (noticeTimer) clearTimeout(noticeTimer);
  if (durationMs > 0) {
    noticeTimer = setTimeout(() => el.classList.add('hidden'), durationMs);
  }
}
export function hideBigNotice() {
  noticeEl().classList.add('hidden');
}

// ---- Touch UI: virtual joystick + interact + jump button ----
export function setupTouchUI({ player, onInteract }) {
  const isTouchDevice = (matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
  const ui = document.getElementById('touch-ui');
  if (!isTouchDevice) {
    ui.classList.add('hidden');
    return;
  }
  ui.classList.remove('hidden');

  const zone = document.getElementById('joystick-zone');
  const thumb = document.getElementById('joystick-thumb');
  let activeId = -1;
  let centerX = 0, centerY = 0;
  const RADIUS = 56;

  function reset() {
    thumb.style.transform = 'translate(-50%, -50%)';
    player.setTouchMove(0, 0);
  }

  zone.addEventListener('touchstart', (e) => {
    if (activeId !== -1) return;
    const t = e.changedTouches[0];
    activeId = t.identifier;
    const rect = zone.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    e.preventDefault();
  }, { passive: false });

  zone.addEventListener('touchmove', (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier !== activeId) continue;
      let dx = t.clientX - centerX;
      let dy = t.clientY - centerY;
      const mag = Math.hypot(dx, dy);
      if (mag > RADIUS) {
        dx = (dx / mag) * RADIUS;
        dy = (dy / mag) * RADIUS;
      }
      thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const nx = dx / RADIUS;
      const ny = dy / RADIUS;
      player.setTouchMove(nx, ny);
      e.preventDefault();
      return;
    }
  }, { passive: false });

  const endHandler = (e) => {
    for (const t of e.changedTouches) {
      if (t.identifier === activeId) {
        activeId = -1;
        reset();
      }
    }
  };
  zone.addEventListener('touchend', endHandler);
  zone.addEventListener('touchcancel', endHandler);

  const interactBtn = document.getElementById('touch-interact');
  interactBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onInteract && onInteract(); }, { passive: false });
  interactBtn.addEventListener('click', (e) => { e.preventDefault(); onInteract && onInteract(); });

  const jumpBtn = document.getElementById('touch-jump');
  const jumpDown = (e) => { e.preventDefault(); player.setSwimUpInput(1); };
  const jumpUp = () => { player.setSwimUpInput(0); };
  jumpBtn.addEventListener('touchstart', jumpDown, { passive: false });
  jumpBtn.addEventListener('touchend', jumpUp);
  jumpBtn.addEventListener('touchcancel', jumpUp);
  jumpBtn.addEventListener('mousedown', jumpDown);
  jumpBtn.addEventListener('mouseup', jumpUp);
  jumpBtn.addEventListener('mouseleave', jumpUp);

  const diveBtn = document.getElementById('touch-dive');
  if (diveBtn) {
    const diveDown = (e) => { e.preventDefault(); player.setSwimDownInput(1); };
    const diveUp = () => { player.setSwimDownInput(0); };
    diveBtn.addEventListener('touchstart', diveDown, { passive: false });
    diveBtn.addEventListener('touchend', diveUp);
    diveBtn.addEventListener('touchcancel', diveUp);
    diveBtn.addEventListener('mousedown', diveDown);
    diveBtn.addEventListener('mouseup', diveUp);
    diveBtn.addEventListener('mouseleave', diveUp);
  }
}

// Show/hide the dive (descend) touch button as the player enters/leaves swim mode.
export function setDiveButtonVisible(visible) {
  const btn = document.getElementById('touch-dive');
  if (!btn) return;
  btn.classList.toggle('hidden', !visible);
}
