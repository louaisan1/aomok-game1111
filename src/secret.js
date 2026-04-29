// Hidden gate: opens a special dashboard. The trigger string never appears in
// source — we compare a SHA-256 hash of the typed name to a stored sigil.
// Casual readers see only random-looking hex.
//
// Best-effort obfuscation; client-side code is always inspectable. A
// determined reader with devtools could trace the flow, but a plain
// `grep` on the source will not reveal the trigger.
import { watchVisitors } from './firebase.js';

// SHA-256 of the trigger, broken into pieces and reassembled at runtime.
const _sigilParts = [
  '0434408', '0f6836a', 'e51ff76',
  '7dd8c5d', 'cf3c452', '14931a1',
  '9cddd03', '90ee12d', '8641330', 'a'
];

async function _hashHex(s) {
  const data = new TextEncoder().encode(String(s ?? '').trim().toLowerCase());
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function isSpecialMode(input) {
  try {
    const hex = await _hashHex(input);
    return hex === _sigilParts.join('');
  } catch (_) {
    return false;
  }
}

function fmtTime(ms) {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString('ar-EG', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (_) { return String(new Date(ms)); }
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function geoSummary(geo) {
  if (!geo) return '—';
  const parts = [];
  if (geo.country) parts.push(geo.country);
  if (geo.region) parts.push(geo.region);
  if (geo.city) parts.push(geo.city);
  return escapeHtml(parts.join(' / ') || '—');
}

function deviceSummary(row) {
  const bits = [];
  if (row.device) bits.push(row.device);
  if (row.browser) bits.push(row.browser);
  if (row.platform) bits.push(row.platform);
  if (row.viewport) bits.push(`${row.viewport.w}×${row.viewport.h}`);
  return escapeHtml(bits.join(' • ') || '—');
}

function rowDetailHTML(row) {
  const g = row.geo || {};
  const s = row.screen || {};
  const v = row.viewport || {};
  const cells = [
    ['IP', g.ip],
    ['الدولة', g.country],
    ['الولاية/المنطقة', g.region],
    ['المدينة', g.city],
    ['الرمز البريدي', g.postal],
    ['خط العرض/الطول', g.lat != null ? `${g.lat}, ${g.lng}` : null],
    ['المنطقة الزمنية', g.timezoneId || row.timezone],
    ['ISP', g.isp],
    ['Org', g.org],
    ['ASN', g.asn],
    ['الجهاز', row.device],
    ['نظام التشغيل', row.platform],
    ['المتصفح', row.browser],
    ['اللغة', row.language],
    ['اللغات', Array.isArray(row.languages) ? row.languages.join(', ') : null],
    ['الشاشة', s.w ? `${s.w}×${s.h} @${s.dpr || 1}x` : null],
    ['نافذة العرض', v.w ? `${v.w}×${v.h}` : null],
    ['عدد الأنوية', row.hardwareConcurrency],
    ['ذاكرة الجهاز', row.deviceMemory ? `${row.deviceMemory} GB` : null],
    ['نقاط اللمس', row.touchPoints],
    ['الكوكيز مفعّلة', row.cookieEnabled === true ? 'نعم' : row.cookieEnabled === false ? 'لا' : null],
    ['متّصل', row.online === true ? 'نعم' : row.online === false ? 'لا' : null],
    ['Referrer', row.referrer],
    ['الرابط', row.pageUrl],
    ['User-Agent', row.userAgent]
  ];
  const items = cells
    .filter(([, val]) => val !== null && val !== undefined && val !== '')
    .map(([label, val]) => `<div class="kv"><span class="k">${escapeHtml(label)}</span><span class="v">${escapeHtml(val)}</span></div>`)
    .join('');
  return `<div class="visitor-detail">${items}</div>`;
}

export function showSpecialDashboard({ onBack }) {
  const overlay = document.getElementById('admin-overlay');
  const list = document.getElementById('admin-list');
  const stats = document.getElementById('admin-stats');
  const titleH1 = overlay.querySelector('h1');
  const titleP = overlay.querySelector('.lead');
  const prevTitle = titleH1.textContent;
  const prevLead = titleP ? titleP.textContent : '';
  titleH1.textContent = 'سجلّ الزوّار';
  if (titleP) titleP.textContent = 'كل من فتح اللعبة (تتحدّث مباشرة). انقر صفًّا لرؤية كل التفاصيل.';

  overlay.classList.remove('hidden');
  list.innerHTML = '<div class="hint" style="padding:14px;text-align:center;">جاري تحميل البيانات…</div>';
  stats.innerHTML = '';

  const expanded = new Set();
  let currentRows = [];

  function renderList() {
    if (currentRows.length === 0) {
      list.innerHTML = '<div class="hint" style="padding:14px;text-align:center;">لا يوجد زوّار بعد.</div>';
      return;
    }
    let html = `
      <div class="admin-row head visitor-row">
        <div>الاسم</div>
        <div>الموقع</div>
        <div>الجهاز</div>
        <div>زيارات</div>
        <div>آخر زيارة</div>
      </div>
    `;
    currentRows.forEach((r) => {
      const isOpen = expanded.has(r.id);
      html += `
        <div class="admin-row visitor-row clickable" data-id="${escapeHtml(r.id)}">
          <div>${r.name ? escapeHtml(r.name) : '<span class="muted">(زائر)</span>'}</div>
          <div>${geoSummary(r.geo)}</div>
          <div>${deviceSummary(r)}</div>
          <div>${r.visits ?? 1}</div>
          <div>${escapeHtml(fmtTime(r.latestTs))}</div>
        </div>
        ${isOpen ? rowDetailHTML(r) : ''}
      `;
    });
    list.innerHTML = html;
    list.querySelectorAll('.visitor-row.clickable').forEach((el) => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        if (expanded.has(id)) expanded.delete(id);
        else expanded.add(id);
        renderList();
      });
    });
  }

  const unsubscribe = watchVisitors((rows) => {
    currentRows = rows;
    const total = rows.length;
    const totalVisits = rows.reduce((acc, r) => acc + (r.visits || 0), 0);
    const countries = new Set(rows.map((r) => r.geo?.country).filter(Boolean));
    const phones = rows.filter((r) => /Phone|Android phone|iPhone|iPad/i.test(r.device || '')).length;
    stats.innerHTML = `
      <div class="admin-stat"><b>${total}</b>زوّار فريدون</div>
      <div class="admin-stat"><b>${totalVisits}</b>إجمالي الزيارات</div>
      <div class="admin-stat"><b>${countries.size}</b>دول</div>
      <div class="admin-stat"><b>${phones}</b>هواتف</div>
    `;
    renderList();
  });

  document.getElementById('admin-back').onclick = () => {
    unsubscribe();
    overlay.classList.add('hidden');
    titleH1.textContent = prevTitle;
    if (titleP) titleP.textContent = prevLead;
    if (onBack) onBack();
  };
}
