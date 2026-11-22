/* Agenda Personal — Dados (localStorage), regras de agenda, aulas fixas, lista de espera e janelas */

// ---------- dados ----------
function seed() {
  const tId = uid();
  const plans = [
    { id: uid(), name: 'Aula avulsa individual', kind: 'avulsa', perWeek: 0, people: 1, price: 120 },
    { id: uid(), name: 'Aula avulsa em dupla', kind: 'avulsa', perWeek: 0, people: 2, price: 80 },
    { id: uid(), name: '2x por semana', kind: 'mensal', perWeek: 2, people: 1, price: 640 },
    { id: uid(), name: '3x por semana', kind: 'mensal', perWeek: 3, people: 1, price: 880 },
    { id: uid(), name: 'Anual 3x por semana', kind: 'anual', perWeek: 3, people: 1, price: 9000 },
  ];
  const hours = {};
  for (let i = 0; i < 7; i++) hours[i] = { on: i >= 1 && i <= 5, start: '06:00', end: '12:00' };
  hours[6] = { on: true, start: '08:00', end: '11:00' };
  const trainer = {
    id: tId, name: 'Carla Souza', phone: '11999990000', pin: '1234', code: 'CARLA1',
    slotMin: 60, capacity: 2, cancelHours: 6,
    locations: ['Academia Bem Estar', 'Parque da Cidade', 'Domicílio do aluno'],
    hours, plans, blocks: [], lowPct: 50, travelMin: 20,
    pix: { key: 'carla.souza@email.com', name: 'Carla Souza', city: 'Sao Paulo' },
    addr: { 'Academia Bem Estar': 'Av. Paulista, 1000, São Paulo - SP', 'Parque da Cidade': 'Parque Ibirapuera, São Paulo - SP' },
  };
  const s1 = { id: uid(), trainerId: tId, name: 'João Pereira', phone: '11988880000', pin: '1234', planId: plans[2].id, credits: 0, since: dkey(addDays(today(), -60)), due: dkey(addDays(today(), 2)),
    fixed: [{ id: uid(), wd: 2, time: '07:00', location: 'Academia Bem Estar' }, { id: uid(), wd: 4, time: '07:00', location: 'Academia Bem Estar' }] };
  const s2 = { id: uid(), trainerId: tId, name: 'Maria Lima', phone: '11977770000', pin: '1234', planId: plans[0].id, credits: 3, since: dkey(addDays(today(), -20)) };
  const s3 = { id: uid(), trainerId: tId, name: 'Sr. Antônio', phone: '11966660000', pin: '1234', planId: plans[3].id, credits: 0, since: dkey(addDays(today(), -120)), due: dkey(addDays(today(), -3)) };
  const bookings = [];
  const mk = (s, off, time, status = 'ok') => {
    const d = addDays(today(), off);
    bookings.push({ id: uid(), trainerId: tId, studentId: s.id, date: dkey(d), time, location: trainer.locations[0], status, dur: 60 });
  };
  mk(s1, -6, '07:00'); mk(s1, -4, '07:00'); mk(s3, -5, '08:00'); mk(s3, -3, '08:00', 'cancelada');
  mk(s2, -2, '09:00'); mk(s1, 1, '07:00'); mk(s3, 1, '09:00'); bookings[bookings.length - 1].location = 'Domicílio do aluno'; s3.addr = 'Rua Oscar Freire, 300, São Paulo - SP'; mk(s3, 2, '08:00'); mk(s2, 3, '10:00');
  const payments = [
    { id: uid(), trainerId: tId, studentId: s1.id, amount: 640, date: dkey(addDays(today(), -28)), desc: plans[2].name },
    { id: uid(), trainerId: tId, studentId: s2.id, amount: 360, date: dkey(addDays(today(), -3)), desc: '3 aula(s) avulsa(s)' },
  ];
  const checkins = [-2, -5, -9, -12].map((o) => ({ id: uid(), studentId: s1.id, date: dkey(addDays(today(), o)), time: '18:30', place: '' }));
  return { trainers: [trainer], students: [s1, s2, s3], bookings, checkins, requests: [], payments, session: null };
}
let db;
try { db = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { db = seed(); }
db.checkins ||= [];
db.requests ||= [];
db.payments ||= []; // pagamentos registrados pelo personal
db.trainers.forEach((t) => { t.blocks ||= []; t.lowPct ??= 50; t.travelMin ??= 20; t.pix ||= { key: '', name: t.name, city: '' }; t.addr ||= {}; });
db.waitlist ||= []; // lista de espera por horário
db.notices ||= [];  // avisos para o aluno (ex.: vagou um horário) // pedidos do aluno (avulsas / troca de plano) aguardando o personal // treinos que o aluno faz por conta própria
const save = () => localStorage.setItem(KEY, JSON.stringify(db));
save();

const ui = { tab: null, day: dkey(today()), month: null };
const me = () => {
  if (!db.session) return null;
  const list = db.session.role === 'personal' ? db.trainers : db.students;
  return list.find((x) => x.id === db.session.id) || null;
};
const trainerOf = (s) => db.trainers.find((t) => t.id === s.trainerId);
const planOf = (t, id) => t.plans.find((p) => p.id === id);
const activeBookings = (tId) => db.bookings.filter((b) => b.trainerId === tId && b.status === 'ok');

// ---------- regras de agenda ----------
function slotsFor(t, dateKey) {
  const d = parseD(dateKey);
  const h = t.hours[d.getDay()];
  const out = [];
  if (h && h.on) for (let m = toMin(h.start); m + t.slotMin <= toMin(h.end); m += t.slotMin) out.push(toTime(m));
  activeBookings(t.id).forEach((b) => { if (b.date === dateKey && !out.includes(b.time)) out.push(b.time); });
  return out.sort();
}
// aulas que se sobrepõem ao intervalo [time, time + duração atual) — usa a duração gravada em cada aula
const bDur = (b) => b.dur || 60;
function inSlot(tId, date, time) {
  const t = db.trainers.find((x) => x.id === tId); const a = toMin(time), z = a + t.slotMin;
  return activeBookings(tId).filter((b) => b.date === date && toMin(b.time) < z && toMin(b.time) + bDur(b) > a);
}
const isPast = (date, time) => slotDate({ date, time }) < new Date();

function canStudentBook(s, t) {
  const plan = planOf(t, s.planId);
  if (!plan) return { ok: false, why: 'Você ainda não tem um plano. Escolha um na aba "Meu plano".' };
  if (plan.kind === 'avulsa' && s.credits <= 0) return { ok: false, why: 'Suas aulas avulsas acabaram. Contrate mais na aba "Meu plano".' };
  return { ok: true, plan };
}
function weekCount(s, date) {
  const wk = weekStart(parseD(date));
  return db.bookings.filter((b) => b.studentId === s.id && b.status === 'ok' && weekStart(parseD(b.date)) === wk).length;
}

// ---------- aulas fixas: marca sozinho as próximas 4 semanas ----------
let fixedRanOn = '';
function applyFixed(force = false) {
  if (!force && fixedRanOn === dkey(today())) return;
  fixedRanOn = dkey(today());
  const now = new Date(); let changed = false;
  db.students.forEach((s) => (s.fixed || []).forEach((f) => {
    const t = trainerOf(s); if (!t) return;
    for (let i = 0; i <= 28; i++) {
      const d = addDays(today(), i); if (d.getDay() !== +f.wd) continue;
      const k = dkey(d);
      if (slotDate({ date: k, time: f.time }) < now) continue;
      if (db.bookings.some((b) => b.studentId === s.id && b.date === k && b.time === f.time)) continue; // já existe (ou foi desmarcada de propósito)
      if (inSlot(t.id, k, f.time).length || blockAt(t, k, f.time)) continue;
      db.bookings.push({ id: uid(), trainerId: t.id, studentId: s.id, date: k, time: f.time, location: f.location, status: 'ok', usedCredit: false, dur: t.slotMin, fixed: f.id });
      changed = true;
    }
  }));
  if (changed) save();
}

// ---------- lista de espera: quando um horário vaga, avisa o primeiro da fila ----------
function freeSlot(b) {
  const q = db.waitlist.filter((w) => w.trainerId === b.trainerId && w.date === b.date && w.time === b.time).sort((x, y) => x.created - y.created);
  const first = q.find((w) => w.studentId !== b.studentId); if (!first) return;
  db.waitlist = db.waitlist.filter((w) => w.id !== first.id);
  db.notices.push({ id: uid(), studentId: first.studentId, type: 'vaga', date: b.date, time: b.time, created: Date.now() });
}
function cancelBooking(b) { b.status = 'cancelada'; refund(b); freeSlot(b); }

// ---------- modal ----------
function openSheet(html) { $modal.innerHTML = `<div class="sheet">${html}</div>`; $modal.classList.remove('hidden'); }
function closeSheet() { $modal.classList.add('hidden'); $modal.innerHTML = ''; }
// tela larga (computador): menu lateral e janelas no centro
const WIDE = window.matchMedia('(min-width: 900px)');
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$modal.classList.contains('hidden')) closeSheet(); });
$modal.addEventListener('click', (e) => { if (e.target === $modal) closeSheet(); });

function confirmSheet({ title, text, ok, danger = false, onOk }) {
  ui.pendingOk = onOk;
  openSheet(`<h2 style="margin-top:0">${esc(title)}</h2><p>${esc(text)}</p>
    <div class="stack" style="margin-top:16px"><button class="${danger ? 'danger-solid' : ''}" data-act="sheet-ok">${esc(ok)}</button><button class="ghost" data-act="close">Voltar</button></div>`);
}
