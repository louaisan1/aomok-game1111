import { watchRoomSessions } from './firebase.js';

const ADMIN_NAME = 'admin-louai';

export function isAdmin(name) {
  return String(name ?? '').trim().toLowerCase() === ADMIN_NAME.toLowerCase();
}

function fmtDuration(ms) {
  if (ms == null) return '—';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtTime(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

function badge(result) {
  if (result === 'won') return '<span class="badge win">فاز</span>';
  if (result === 'lost') return '<span class="badge lose">خسر</span>';
  return '<span class="badge in-progress">قيد اللعب</span>';
}

export function showAdminDashboard({ room, onBack }) {
  const overlay = document.getElementById('admin-overlay');
  const list = document.getElementById('admin-list');
  const stats = document.getElementById('admin-stats');
  document.getElementById('admin-room').textContent = String(room);
  overlay.classList.remove('hidden');

  list.innerHTML = '<div class="hint">جاري تحميل البيانات…</div>';

  const unsubscribe = watchRoomSessions(room, (rows) => {
    const total = rows.length;
    const wins = rows.filter(r => r.result === 'won').length;
    const losses = rows.filter(r => r.result === 'lost').length;
    const live = total - wins - losses;
    const winsList = rows.filter(r => r.result === 'won' && typeof r.elapsedMs === 'number');
    const fastestMs = winsList.length ? Math.min(...winsList.map(r => r.elapsedMs)) : null;

    stats.innerHTML = `
      <div class="admin-stat"><b>${total}</b>إجمالي الجلسات</div>
      <div class="admin-stat"><b>${wins}</b>فائزون</div>
      <div class="admin-stat"><b>${losses}</b>خاسرون</div>
      <div class="admin-stat"><b>${live}</b>قيد اللعب</div>
      <div class="admin-stat"><b>${fastestMs == null ? '—' : fmtDuration(fastestMs)}</b>أسرع زمن للفوز</div>
    `;

    if (rows.length === 0) {
      list.innerHTML = '<div class="hint" style="padding:14px;text-align:center;">لا توجد جلسات بعد لهذه الغرفة.</div>';
      return;
    }
    let html = `
      <div class="admin-row head">
        <div>الاسم</div>
        <div>الحالة</div>
        <div>الوقت المنقضي</div>
        <div>بدأ في</div>
      </div>
    `;
    rows.forEach((r) => {
      html += `
        <div class="admin-row">
          <div>${escapeHtml(r.name)}</div>
          <div>${badge(r.result)}${r.equation ? ` <span style="font-size:11px;color:var(--muted)"> ${escapeHtml(r.equation)}</span>` : ''}</div>
          <div>${fmtDuration(r.elapsedMs)}</div>
          <div>${fmtTime(r.startedAtMs)}</div>
        </div>
      `;
    });
    list.innerHTML = html;
  });

  document.getElementById('admin-back').onclick = () => {
    unsubscribe();
    overlay.classList.add('hidden');
    if (onBack) onBack();
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
