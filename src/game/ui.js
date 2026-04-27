import { evaluateTokens, TOKEN_OPS } from '../equation.js';
import { colorHexToCss } from './colors.js';

export function setupHUD({ name, room }) {
  document.getElementById('hud-name').textContent = name;
  document.getElementById('hud-room').textContent = String(room);
  document.getElementById('hud').classList.remove('hidden');
}

export function showRegister(show = true) {
  document.getElementById('register-overlay').classList.toggle('hidden', !show);
}

export function showResult({ won, equation, value, message }) {
  const overlay = document.getElementById('result-overlay');
  overlay.classList.remove('hidden');
  document.getElementById('result-title').textContent = won ? 'فزت!' : 'خسرت';
  const t = won
    ? `أحسنت! المعادلة: ${equation || ''} = ${value}`
    : (message || 'انتهى الوقت أو المعادلة غير صحيحة.');
  document.getElementById('result-text').textContent = t;
}

export class InventoryUI {
  constructor() {
    this.row = document.getElementById('keys-row');
    this.chips = new Map(); // index -> element
  }
  registerKeys(colors) {
    this.row.innerHTML = '';
    colors.forEach((c, i) => {
      const chip = document.createElement('div');
      chip.className = 'key-chip dim';
      chip.style.background = colorHexToCss(c.hex);
      chip.title = c.name;
      this.row.appendChild(chip);
      this.chips.set(i, chip);
    });
  }
  collect(index) {
    const chip = this.chips.get(index);
    if (chip) chip.classList.remove('dim');
  }
}

export class EquationUI {
  constructor({ onSubmit }) {
    this.text = document.getElementById('equation-text');
    this.result = document.getElementById('equation-result');
    this.submit = document.getElementById('submit-eq');
    this.tokens = []; // selected expression tokens
    this.openedDoors = []; // [{ index, token, color }]
    this.onSubmit = onSubmit;
    this.submit.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleSubmit();
    });
  }

  addOpenedDoor(door) {
    if (this.openedDoors.find((d) => d.index === door.index)) return;
    this.openedDoors.push({ index: door.index, token: door.token, color: door.color });
    this._render();
  }

  handleSubmit() {
    if (!this.tokens.length) return;
    const value = evaluateTokens(this.tokens);
    if (this.onSubmit) this.onSubmit(this.tokens, value);
  }

  reset() {
    this.tokens = [];
    this.openedDoors = [];
    this._render();
  }

  _render() {
    // Display selected expression first, then a list of opened tokens to click.
    this.text.innerHTML = '';
    if (this.tokens.length === 0) {
      const placeholder = document.createElement('span');
      placeholder.style.opacity = '0.5';
      placeholder.textContent = 'انقر على الرموز ↓';
      this.text.appendChild(placeholder);
    } else {
      this.tokens.forEach((tk, i) => {
        const span = document.createElement('span');
        span.style.margin = '0 4px';
        span.textContent = tk === '*' ? '×' : tk === '/' ? '÷' : tk;
        this.text.appendChild(span);
      });
      // Backspace
      const back = document.createElement('button');
      back.style.marginInlineStart = '8px';
      back.style.padding = '2px 8px';
      back.style.fontSize = '12px';
      back.textContent = '⌫';
      back.onclick = (e) => { e.stopPropagation(); this.tokens.pop(); this._render(); };
      this.text.appendChild(back);
    }

    // Render opened-door chips below
    let chipsRow = document.getElementById('opened-chips');
    if (!chipsRow) {
      chipsRow = document.createElement('div');
      chipsRow.id = 'opened-chips';
      chipsRow.style.display = 'flex';
      chipsRow.style.flexWrap = 'wrap';
      chipsRow.style.gap = '6px';
      chipsRow.style.justifyContent = 'center';
      chipsRow.style.margin = '6px 0';
      this.text.parentElement.insertBefore(chipsRow, this.result);
    }
    chipsRow.innerHTML = '';
    this.openedDoors.forEach((d) => {
      const btn = document.createElement('button');
      btn.style.padding = '4px 10px';
      btn.style.fontSize = '14px';
      btn.style.background = colorHexToCss(d.color.hex);
      btn.style.color = '#0a0a14';
      btn.style.borderRadius = '8px';
      btn.style.fontWeight = '700';
      const t = d.token;
      btn.textContent = (t === '*') ? '×' : (t === '/') ? '÷' : t;
      btn.title = `الباب ${d.index + 1}: ${t}`;
      btn.onclick = (e) => {
        e.stopPropagation();
        // Validate token alternation gently — but allow any insertion (player can backspace).
        this.tokens.push(d.token);
        this._render();
      };
      chipsRow.appendChild(btn);
    });

    // Live evaluation
    const v = evaluateTokens(this.tokens);
    if (v === null) {
      this.result.textContent = this.tokens.length ? '… المعادلة غير مكتملة' : '';
      this.submit.disabled = true;
    } else {
      const rounded = Math.round(v * 1000) / 1000;
      this.result.textContent = `النتيجة: ${rounded}`;
      this.submit.disabled = false;
    }
  }
}

export class TimerUI {
  constructor(durationMs, { onExpire } = {}) {
    this.duration = durationMs;
    this.start = null;
    this.expired = false;
    this.onExpire = onExpire;
    this.el = document.getElementById('timer');
    this.wrap = document.getElementById('timer-wrap');
    this.running = false;
  }

  startTimer() {
    if (this.running) return;
    this.start = performance.now();
    this.running = true;
    this.wrap.classList.remove('hidden');
    this._tick();
  }

  stopTimer() {
    this.running = false;
  }

  elapsed() {
    if (!this.start) return 0;
    return performance.now() - this.start;
  }

  _tick() {
    if (!this.running) return;
    const elapsed = performance.now() - this.start;
    const remaining = Math.max(0, this.duration - elapsed);
    const total = Math.ceil(remaining / 1000);
    const m = Math.floor(total / 60).toString().padStart(2, '0');
    const s = (total % 60).toString().padStart(2, '0');
    this.el.textContent = `${m}:${s}`;
    if (remaining < 30000) this.el.classList.add('warn');
    if (remaining <= 0 && !this.expired) {
      this.expired = true;
      this.running = false;
      if (this.onExpire) this.onExpire();
      return;
    }
    requestAnimationFrame(() => this._tick());
  }
}

export function showPrompt(text, color) {
  const p = document.getElementById('prompt');
  p.classList.remove('hidden');
  p.innerHTML = text;
  if (color) p.style.borderColor = color;
}
export function hidePrompt() {
  document.getElementById('prompt').classList.add('hidden');
}
