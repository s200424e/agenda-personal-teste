/* Agenda Personal — Utilidades, tamanho da letra, Pix e tema claro/escuro */

const KEY = 'agenda-personal-v1';
const WD = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const WD3 = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const KINDS = { avulsa: 'Aula avulsa', semanal: 'Plano semanal', mensal: 'Plano mensal', anual: 'Plano anual' };

// ---------- utilidades ----------
const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseD = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const weekStart = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dkey(x); };
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const money = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtDate = (k) => { const d = parseD(k); return `${WD[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const slotDate = (b) => { const d = parseD(b.date); d.setMinutes(toMin(b.time)); return d; };
const initials = (n) => n.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
const onlyDigits = (s) => String(s).replace(/\D/g, '');
// rota até o local da aula (Waze abre o app se estiver instalado; senão, o site)
const addrOf = (t, loc) => (t?.addr || {})[loc] || '';
const wazeLink = (addr) => `https://waze.com/ul?q=${encodeURIComponent(addr)}&navigate=yes`;
const mapsLink = (addr) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`;
// destino da aula: endereço do local; se for "Domicílio do aluno", usa o endereço do aluno
const destOf = (t, b) => addrOf(t, b.location) || (/domic|casa/i.test(b.location) ? (findStudent(b.studentId)?.addr || '') : '');
const wazeMini = (t, b) => { const a = destOf(t, b); return a ? `<a class="waze-mini" href="${wazeLink(a)}" target="_blank" rel="noopener" aria-label="Rota no Waze até ${esc(a)}" title="${esc(a)}">🚗 Waze</a>` : ''; };
const routeBtns = (a) => { if (!a) return '';
  return `<div class="route"><a class="btn waze" href="${wazeLink(a)}" target="_blank" rel="noopener">🚗 Ir com Waze</a><a class="btn ghost small gmaps" href="${mapsLink(a)}" target="_blank" rel="noopener">Google Maps</a></div>`; };
// primeiro nome, mantendo tratamentos: "Sr. Antônio" -> "Sr. Antônio", "Dona Célia" -> "Dona Célia"
const TRATAMENTOS = /^(sr|sra|srta|dr|dra|prof|profa|dona|seu)\.?$/i;
const firstName = (n) => { const w = String(n || '').trim().split(/\s+/); return TRATAMENTOS.test(w[0]) && w[1] ? `${w[0]} ${w[1]}` : w[0]; };
const waLink = (phone, text) => `https://wa.me/55${onlyDigits(phone)}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
const msgSaudade = (s) => `Oi ${firstName(s.name)}, tudo bem? Senti sua falta nos treinos! Quer que eu reserve um horário pra você esta semana? 💪`;

// ---------- tamanho da letra ----------
const FONT_KEY = 'agenda-personal-fonte';
const FONTS = { normal: ['Normal', 18], grande: ['Grande', 20], enorme: ['Muito grande', 22] };
function applyFont(f) { document.documentElement.style.fontSize = (FONTS[f] || FONTS.normal)[1] + 'px'; }
applyFont(localStorage.getItem(FONT_KEY));
const fontChips = () => { const cur = localStorage.getItem(FONT_KEY) || 'normal';
  return `<div class="chips">${Object.entries(FONTS).map(([k, [l, px]]) => `<button class="chip ${k === cur ? 'on' : ''}" data-act="font" data-f="${k}" style="font-size:${px * 0.85}px">${l}</button>`).join('')}</div>`; };

// ---------- Pix (BR Code "copia e cola") ----------
const emv = (id, v) => id + String(v.length).padStart(2, '0') + v;
function crc16(str) {
  let crc = 0xffff;
  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = ((crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}
const pixClean = (v, n) => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9 ]/g, '').toUpperCase().trim().slice(0, n);
function pixCode(t, amount) {
  const mai = emv('00', 'br.gov.bcb.pix') + emv('01', t.pix.key.trim());
  const body = emv('00', '01') + emv('26', mai) + emv('52', '0000') + emv('53', '986') + (amount ? emv('54', Number(amount).toFixed(2)) : '')
    + emv('58', 'BR') + emv('59', pixClean(t.pix.name || t.name, 25) || 'PERSONAL') + emv('60', pixClean(t.pix.city, 15) || 'BRASIL') + emv('62', emv('05', '***')) + '6304';
  return body + crc16(body);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
}

// ---------- tema claro/escuro ----------
const THEME_KEY = 'agenda-personal-tema';
function applyTheme(th) {
  document.documentElement.dataset.theme = th;
  document.querySelector('meta[name="theme-color"]').content = th === 'dark' ? '#0d0e0f' : '#1d1e20';
}
applyTheme(localStorage.getItem(THEME_KEY) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
const themeSwitch = () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<div class="theme-row"><span>${dark ? 'Tema escuro' : 'Tema claro'}</span>
    <label class="switch"><input type="checkbox" role="switch" data-theme-toggle ${dark ? 'checked' : ''} aria-label="Tema escuro" />
    <span class="track"><span class="thumb">${dark ? '🌙' : '☀️'}</span></span></label></div>`;
};
const themeSwitchCompact = () => {
  const dark = document.documentElement.dataset.theme === 'dark';
  return `<label class="switch" title="${dark ? 'Tema escuro' : 'Tema claro'}"><input type="checkbox" role="switch" data-theme-toggle ${dark ? 'checked' : ''} aria-label="Tema escuro" />
    <span class="track"><span class="thumb">${dark ? '🌙' : '☀️'}</span></span></label>`;
};
function setTheme(th) { localStorage.setItem(THEME_KEY, th); applyTheme(th); render(); }
document.addEventListener('change', (e) => { if (e.target.matches('[data-theme-toggle]')) setTheme(e.target.checked ? 'dark' : 'light'); });
// arrastar a bolinha de qualquer chave: direita = liga, esquerda = desliga (muda só a chave arrastada)
let drag = null, skipClick = false;
document.addEventListener('pointerdown', (e) => {
  const tr = e.target.closest('.switch .track');
  if (tr) { const inp = tr.previousElementSibling; drag = { x: e.clientX, tr, inp, base: inp.checked ? 34 : 2 }; tr.setPointerCapture?.(e.pointerId); }
});
document.addEventListener('pointermove', (e) => {
  if (!drag) return; const th = drag.tr.querySelector('.thumb');
  th.style.transition = 'none'; th.style.left = Math.min(34, Math.max(2, drag.base + e.clientX - drag.x)) + 'px';
});
const endDrag = (e) => {
  if (!drag) return; const dx = e.clientX - drag.x;
  const { inp, tr } = drag; drag = null;
  const th = tr.querySelector('.thumb'); th.style.transition = ''; th.style.left = '';
  if (Math.abs(dx) > 8) {
    skipClick = true; setTimeout(() => { skipClick = false; }, 300);
    const want = dx > 0;
    if (inp.checked !== want) { inp.checked = want; inp.dispatchEvent(new Event('change', { bubbles: true })); }
  }
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);
document.addEventListener('click', (e) => { if (skipClick && e.target.closest('.switch')) { e.preventDefault(); e.stopPropagation(); } }, true);
