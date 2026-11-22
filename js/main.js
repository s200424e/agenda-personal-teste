/* Agenda Personal — Navegação, eventos de clique/formulário e inicialização */

// ---------- render ----------
// ícones de linha (herdam a cor via currentColor)
const svg = (d) => `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  plus: svg('<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>'),
  cal: svg('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  doc: svg('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>'),
  home: svg('<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>'),
  users: svg('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.6c2.4.2 4.2 1.9 5 4.9"/>'),
  chart: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
};
const TABS = {
  personal: [['inicio', ICON.home, 'Início'], ['agenda', ICON.cal, 'Agenda'], ['alunos', ICON.users, 'Alunos'], ['metricas', ICON.chart, 'Métricas'], ['ajustes', ICON.gear, 'Ajustes']],
  aluno: [['inicio', ICON.home, 'Início'], ['agendar', ICON.plus, 'Marcar'], ['aulas', ICON.cal, 'Minhas aulas'], ['plano', ICON.doc, 'Meu plano']],
};
let route = 'welcome';

function render() {
  const u = me();
  if (!u) {
    const [r, arg] = route.split(':');
    $app.innerHTML = r === 'login' ? viewLogin(arg) : r === 'signup' ? viewSignup(arg) : viewWelcome();
    return;
  }
  const role = db.session.role;
  applyFixed();
  if (!ui.tab || !TABS[role].some((x) => x[0] === ui.tab)) ui.tab = TABS[role][0][0];
  let html;
  if (role === 'personal') {
    html = { inicio: viewTrainerHome, agenda: viewTrainerAgenda, alunos: viewTrainerStudents, metricas: viewTrainerMetrics, ajustes: viewTrainerSettings }[ui.tab](u);
  } else {
    const t = trainerOf(u);
    html = { inicio: viewStudentHome, agendar: viewStudentBook, aulas: viewStudentClasses, plano: viewStudentPlan }[ui.tab](u, t);
  }
  document.body.dataset.role = role;
  $app.innerHTML = `<header class="top"></header><main class="v-${ui.tab}">${html}</main>
    <nav class="tabs" aria-label="Menu"><div class="nav-brand"><img src="icons/icon-192.png" alt="" width="36" height="36" /><span>Agenda Personal<small>${role === 'personal' ? 'Área do personal' : 'Área do aluno'}</small></span></div><div class="inner">${TABS[role].map(([k, i, l]) => `<button class="${k === ui.tab ? 'on' : ''}" data-tab="${k}" aria-current="${k === ui.tab}"><span class="i">${i}</span>${l}</button>`).join('')}</div></nav>`;
}
const rerender = () => { save(); render(); };

// ---------- eventos ----------
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-go],[data-tab],[data-day],[data-act],[data-cal],[data-month],[data-chip]');
  if (!el) return;
  if (el.dataset.chip) { const inp = el.closest('form')?.querySelector('[name=reason]'); if (inp) inp.value = el.dataset.chip; return; }
  if (el.dataset.cal) { ui.day = el.dataset.cal; render(); if (!WIDE.matches) document.getElementById('slots-title')?.scrollIntoView({ behavior: 'smooth' }); return; }
  if (el.dataset.month) {
    const [y, m] = ui.month.split('-').map(Number); const d = new Date(y, m - 1 + +el.dataset.month, 1);
    ui.month = dkey(d).slice(0, 7); render(); return;
  }
  if (el.dataset.go) { route = el.dataset.go; render(); return; }
  if (el.dataset.tab) { ui.tab = el.dataset.tab; closeSheet(); render(); window.scrollTo(0, 0); return; }
  if (el.dataset.day) { ui.day = el.dataset.day; render(); return; }
  const u = me(); const act = el.dataset.act; const id = el.dataset.id;
  const t = u && (db.session.role === 'personal' ? u : trainerOf(u));
  switch (act) {
    case 'close': closeSheet(); break;
    case 'logout': db.session = null; route = 'welcome'; ui.tab = null; ui.atGym = false; closeSheet(); rerender(); startGeo(); break;
    case 'reset': confirmSheet({ title: 'Restaurar demonstração?', text: 'Todos os dados deste aparelho serão apagados e trocados pelos dados de exemplo.', ok: 'Apagar e restaurar', danger: true,
      onOk: () => { db = seed(); fixedRanOn = ''; route = 'welcome'; rerender(); } }); break;
    case 'copy-code': navigator.clipboard?.writeText(t.code); toast('Código copiado!'); break;
    case 't-cancel': {
      const b = db.bookings.find((x) => x.id === id); const st = db.students.find((x) => x.id === b.studentId);
      confirmSheet({ title: 'Desmarcar aula?', text: `${st?.name || 'Aluno'} · ${fmtDate(b.date)} às ${b.time}. Se for aula avulsa, ela volta para o saldo do aluno.`, ok: 'Desmarcar', danger: true,
        onOk: () => { cancelBooking(b); rerender(); toast('Aula desmarcada'); } }); break;
    }
    case 'student': sheetStudent(t, db.students.find((s) => s.id === id)); break;
    case 'remove-student':
      confirmSheet({ title: 'Remover aluno?', text: 'As aulas futuras dele serão desmarcadas e ele perde o acesso à sua agenda.', ok: 'Remover aluno', danger: true,
        onOk: () => {
          db.bookings.forEach((b) => { if (b.studentId === id && b.status === 'ok' && slotDate(b) > new Date()) { b.status = 'cancelada'; freeSlot(b); } });
          db.waitlist = db.waitlist.filter((w) => w.studentId !== id); db.notices = db.notices.filter((n) => n.studentId !== id);
          db.requests = db.requests.filter((r) => r.studentId !== id);
          db.students = db.students.filter((s) => s.id !== id); rerender(); toast('Aluno removido');
        } }); break;
    case 'del-loc': { const [l] = t.locations.splice(+el.dataset.i, 1); delete t.addr[l]; rerender(); break; }
    case 'new-plan': sheetNewPlan(); break;
    case 'del-plan':
      if (db.students.some((s) => s.planId === id)) { toast('Há alunos neste plano. Mude o plano deles antes.'); break; }
      t.plans = t.plans.filter((p) => p.id !== id); db.requests = db.requests.filter((r) => r.planId !== id); rerender(); break;
    case 'slot': sheetBook(u, t, el.dataset.time); break;
    case 'open-b': sheetCancel(u, t, db.bookings.find((b) => b.id === id)); break;
    case 's-cancel': {
      const b = db.bookings.find((x) => x.id === id);
      cancelBooking(b); closeSheet(); rerender(); toast('Aula desmarcada'); break;
    }
    case 'buy': {
      const p = planOf(t, id);
      openSheet(`<h2 style="margin-top:0">${esc(p.name)}</h2><p>Valor: <b>${money(p.price)}</b> por aula</p>
        <form id="f-buy" data-id="${p.id}"><label>Quantas aulas?</label><input name="qty" type="number" min="1" max="20" value="1"/>
        <p class="small muted" style="margin-top:10px">Seu personal confirma o pedido depois de combinar o pagamento com você. As aulas entram no seu saldo assim que ele aprovar.</p>
        <div class="stack"><button type="submit">Enviar pedido</button><button type="button" class="ghost" data-act="close">Voltar</button></div></form>`);
      break;
    }
    case 'change-plan': {
      const p = planOf(t, id);
      openSheet(`<h2 style="margin-top:0">Mudar de plano?</h2><p>Novo plano: <b>${esc(p.name)}</b><br>${money(p.price)}</p><p class="small muted">Seu pedido vai para o personal confirmar. Até lá, seu plano atual continua valendo.</p>
        <div class="stack"><button data-act="confirm-plan" data-id="${p.id}">Enviar pedido</button><button class="ghost" data-act="close">Voltar</button></div>`);
      break;
    }
    case 'checkin': doCheckin(u, ''); break;
    case 'undo-checkin': db.checkins = db.checkins.filter((c) => !(c.studentId === u.id && c.date === dkey(today()))); rerender(); break;
    case 'geo-yes': closeSheet(); doCheckin(u, u.geo?.name || ''); break;
    case 'geo-no': sessionStorage.setItem('geo-asked-' + dkey(today()), '1'); closeSheet(); break;
    case 'set-gym': {
      if (!navigator.geolocation) { toast('Seu aparelho não permite localização'); break; }
      toast('Buscando sua localização...');
      navigator.geolocation.getCurrentPosition((pos) => {
        ui.pendingPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        openSheet(`<h2 style="margin-top:0">📍 Localização salva</h2><form id="f-gym"><label for="gym">Qual o nome da sua academia?</label>
          <input id="gym" name="name" value="${esc(u.geo?.name || t.locations[0] || 'Minha academia')}" required />
          <div class="stack" style="margin-top:16px"><button type="submit">Salvar</button><button type="button" class="ghost" data-act="close">Cancelar</button></div></form>`);
      }, () => toast('Não foi possível pegar a localização. Permita o acesso nas configurações.'), { enableHighAccuracy: true, timeout: 15000 });
      break;
    }
    case 'confirm-plan': {
      db.requests = db.requests.filter((r) => !(r.studentId === u.id && r.type === 'plano'));
      db.requests.push({ id: uid(), studentId: u.id, trainerId: t.id, type: 'plano', planId: id, qty: 0, date: dkey(today()) });
      closeSheet(); rerender(); toast('Pedido enviado ao seu personal'); break;
    }
    case 'new-student':
      openSheet(`<h2 style="margin-top:0">Novo aluno</h2>
        <form id="f-newstudent">
          <label>Nome</label><input name="name" required autocomplete="off" />
          <label>Celular com DDD</label><input name="phone" inputmode="numeric" placeholder="Ex.: 11988887777" required autocomplete="off" />
          <label>Plano</label>
          <select name="planId"><option value="">Escolher depois</option>${t.plans.map((x) => `<option value="${x.id}">${esc(x.name)} — ${money(x.price)}</option>`).join('')}</select>
          <label>Aulas avulsas no saldo</label><input name="credits" type="number" min="0" value="0" />
          <p class="small muted" style="margin-top:10px">O aluno entra no app em "Primeiro acesso", com o seu código <b>${esc(t.code)}</b> e este celular, e cria a própria senha.</p>
          <div class="stack"><button type="submit">Adicionar aluno</button><button type="button" class="ghost" data-act="close">Cancelar</button></div>
        </form>`);
      break;
    case 'm-period': ui.mPeriod = +el.dataset.p; ui.mDay = null; render(); break;
    case 'm-day': ui.mDay = ui.mDay === el.dataset.d ? null : el.dataset.d; document.getElementById('m-body').innerHTML = metricsBody(t); break;
    case 'm-card': sheetMetric(t, el.dataset.k); break;
    case 'm-clear': ui.mQuery = ''; render(); document.getElementById('m-q')?.focus(); break;
    case 'font': localStorage.setItem(FONT_KEY, el.dataset.f); applyFont(el.dataset.f); render(); toast('Tamanho da letra alterado'); break;
    case 'season-close': localStorage.setItem(`season-closed-${el.dataset.k}-${today().getFullYear()}`, '1'); render(); break;
    case 'reminders': sheetReminders(t); break;
    case 'remind-sent': { const b = db.bookings.find((x) => x.id === id); b.reminded = true; save(); setTimeout(() => { sheetReminders(t); render(); }, 300); break; }
    case 'charge': sheetCharge(t, findStudent(id)); break;
    case 'copy-pix': navigator.clipboard?.writeText(el.dataset.code); toast('Código Pix copiado!'); break;
    case 'go-settings': ui.tab = 'ajustes'; closeSheet(); render(); break;
    case 'del-fixed': {
      const st = findStudent(id); const fid = el.dataset.f;
      st.fixed = (st.fixed || []).filter((x) => x.id !== fid);
      db.bookings = db.bookings.filter((b) => !(b.fixed === fid && b.status === 'ok' && slotDate(b) > new Date()));
      rerender(); sheetStudent(t, st); toast('Aula fixa removida (as próximas foram desmarcadas)'); break;
    }
    case 'resched': ui.resched = id; ui.tab = 'agendar'; const ob = db.bookings.find((b) => b.id === id); ui.day = ob.date; ui.month = ob.date.slice(0, 7); closeSheet(); render(); window.scrollTo(0, 0); break;
    case 'resched-cancel': ui.resched = null; render(); break;
    case 'wait': {
      const time = el.dataset.time; const inList = db.waitlist.find((w) => w.studentId === u.id && w.date === ui.day && w.time === time);
      const pos = db.waitlist.filter((w) => w.trainerId === t.id && w.date === ui.day && w.time === time).sort((a, b) => a.created - b.created).findIndex((w) => w.studentId === u.id) + 1;
      openSheet(inList
        ? `<h2 style="margin-top:0">⏳ Você está na lista de espera</h2><p>${fmtDate(ui.day)} às <b>${time}</b> · posição <b>${pos}</b></p><p class="small muted">Se esse horário vagar, aparece um aviso na sua tela Início.</p>
           <div class="stack"><button class="danger" data-act="wait-leave" data-time="${time}">Sair da lista</button><button class="ghost" data-act="close">Voltar</button></div>`
        : `<h2 style="margin-top:0">Horário indisponível</h2><p>${fmtDate(ui.day)} às <b>${time}</b> já está ocupado.</p><p>Quer entrar na <b>lista de espera</b>? Se vagar, avisamos você na tela Início.</p>
           <div class="stack"><button data-act="wait-join" data-time="${time}">Entrar na lista de espera</button><button class="ghost" data-act="close">Agora não</button></div>`);
      break;
    }
    case 'wait-join': db.waitlist.push({ id: uid(), trainerId: t.id, studentId: u.id, date: ui.day, time: el.dataset.time, created: Date.now() }); closeSheet(); rerender(); toast('Você entrou na lista de espera'); break;
    case 'wait-leave': db.waitlist = db.waitlist.filter((w) => !(w.studentId === u.id && w.date === ui.day && w.time === el.dataset.time)); closeSheet(); rerender(); toast('Você saiu da lista'); break;
    case 'notice-dismiss': db.notices = db.notices.filter((n) => n.id !== id); rerender(); break;
    case 'notice-book': {
      const n = db.notices.find((x) => x.id === id); db.notices = db.notices.filter((x) => x.id !== id); save();
      if (inSlot(t.id, n.date, n.time).length || blockAt(t, n.date, n.time) || isPast(n.date, n.time)) { render(); toast('Esse horário já foi preenchido 😕'); break; }
      ui.tab = 'agendar'; ui.day = n.date; ui.month = n.date.slice(0, 7); render(); sheetBook(u, t, n.time); break;
    }
    case 'go-agenda-today': ui.tab = 'agenda'; ui.day = dkey(today()); ui.month = ui.day.slice(0, 7); closeSheet(); render(); window.scrollTo(0, 0); break;
    case 't-book': sheetTrainerBook(t, el.dataset.time); break;
    case 't-block': sheetBlock(t, el.dataset.time); break;
    case 'unblock': t.blocks = t.blocks.filter((b) => b.id !== id); rerender(); toast('Horário liberado'); break;
    case 'mark-paid': {
      const st = findStudent(id); markPaid(st, t); rerender();
      toast(`Pagamento registrado · próximo vencimento ${fmtShort(st.due)}`);
      if (el.closest('#modal')) sheetStudent(t, st);
      break;
    }
    case 'cancel-req': db.requests = db.requests.filter((r) => r.id !== id); rerender(); toast('Pedido cancelado'); break;
    case 'req-ok': case 'req-no': {
      const r = db.requests.find((x) => x.id === id); const st = db.students.find((x) => x.id === r?.studentId);
      if (r && st && act === 'req-ok') {
        const pl = planOf(t, r.planId);
        if (r.type === 'avulsa') {
          st.credits += r.qty; if (!planOf(t, st.planId)) st.planId = r.planId;
          db.payments.push({ id: uid(), trainerId: t.id, studentId: st.id, amount: pl.price * r.qty, date: dkey(today()), desc: `${r.qty} aula(s) avulsa(s)` });
        } else { st.planId = r.planId; if (pl.kind !== 'avulsa') st.due = dkey(today()); }
      }
      db.requests = db.requests.filter((x) => x.id !== id); rerender();
      toast(act === 'req-ok' ? 'Pedido aprovado' : 'Pedido recusado'); break;
    }
    case 'sheet-ok': { const fn = ui.pendingOk; ui.pendingOk = null; closeSheet(); fn?.(); break; }
  }
});

function refund(b) {
  const s = db.students.find((x) => x.id === b.studentId); if (!s) return;
  const p = planOf(trainerOf(s), s.planId);
  if (b.usedCredit || (b.usedCredit === undefined && p && p.kind === 'avulsa')) s.credits += 1;
}

document.addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target; const v = Object.fromEntries(new FormData(f));
  const u = me(); const t = u && (db.session.role === 'personal' ? u : trainerOf(u));
  switch (f.id) {
    case 'f-login': {
      const role = route.split(':')[1];
      const list = role === 'personal' ? db.trainers : db.students;
      const found = list.find((x) => onlyDigits(x.phone) === onlyDigits(v.phone) && x.pin === v.pin);
      if (!found) {
        const noPin = role === 'aluno' && db.students.some((x) => onlyDigits(x.phone) === onlyDigits(v.phone) && !x.pin);
        return toast(noPin ? 'Faça o "Primeiro acesso" com o código do seu personal' : 'Celular ou senha incorretos');
      }
      db.session = { role, id: found.id }; ui.tab = null; ui.day = dkey(today()); rerender(); startGeo(); break;
    }
    case 'f-signup': {
      const role = f.dataset.role; const phone = onlyDigits(v.phone);
      if (!/^\d{4}$/.test(v.pin)) return toast('A senha deve ter 4 números');
      if (phone.length < 10) return toast('Digite o celular com DDD');
      if (role === 'personal') {
        if (db.trainers.some((x) => x.phone === phone)) return toast('Já existe conta com este celular');
        const hours = {}; for (let i = 0; i < 7; i++) hours[i] = { on: i >= 1 && i <= 5, start: '07:00', end: '19:00' };
        let code; do { code = (v.name.split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5) || 'PT') + Math.floor(10 + Math.random() * 90); } while (db.trainers.some((x) => x.code === code));
        const nt = { id: uid(), name: v.name.trim(), phone, pin: v.pin, code, slotMin: 60, capacity: 1, cancelHours: 12, locations: [], hours,
          plans: [{ id: uid(), name: 'Aula avulsa', kind: 'avulsa', perWeek: 0, people: 1, price: 100 }] };
        db.trainers.push(nt); db.session = { role, id: nt.id }; ui.tab = 'ajustes';
        rerender(); toast('Conta criada! Configure seus dias, locais e planos.');
      } else {
        const tr = db.trainers.find((x) => x.code.toUpperCase() === v.code.trim().toUpperCase());
        if (!tr) return toast('Código do personal não encontrado');
        const pre = db.students.find((x) => x.trainerId === tr.id && x.phone === phone);
        if (pre && pre.pin) return toast('Você já tem conta. Use "Entrar".');
        if (pre) { pre.pin = v.pin; db.session = { role: 'aluno', id: pre.id }; ui.tab = null; rerender(); toast(`Bem-vindo(a), ${pre.name.split(' ')[0]}!`); break; }
        const ns = { id: uid(), trainerId: tr.id, name: v.name.trim(), phone, pin: v.pin, planId: '', credits: 0, since: dkey(today()) };
        db.students.push(ns); db.session = { role: 'aluno', id: ns.id }; ui.tab = 'plano';
        rerender(); toast(`Bem-vindo(a)! Escolha seu plano com ${tr.name.split(' ')[0]}.`);
      }
      break;
    }
    case 'f-settings': {
      for (let i = 0; i < 7; i++) {
        const st = v['start' + i], en = v['end' + i];
        if (v['on' + i] && toMin(en) <= toMin(st)) return toast(`${WD[i]}: o horário final deve ser depois do inicial`);
        t.hours[i] = { on: !!v['on' + i], start: st, end: en };
      }
      t.slotMin = +v.slotMin; t.cancelHours = +v.cancelHours; t.lowPct = +v.lowPct || 50; t.travelMin = +v.travelMin || 20;
      rerender(); toast('Ajustes salvos'); break;
    }
    case 'f-pix': t.pix = { key: v.key.trim(), name: v.name.trim(), city: v.city.trim() }; rerender(); toast('Pix salvo'); break;
    case 'f-fixed': {
      const st = findStudent(f.dataset.id); const h = t.hours[+v.wd];
      if (!h?.on || toMin(v.time) < toMin(h.start) || toMin(v.time) + t.slotMin > toMin(h.end)) return toast(`Nesse dia você atende das ${h?.start} às ${h?.end}`);
      if (db.students.some((x) => x.id !== st.id && (x.fixed || []).some((ff) => +ff.wd === +v.wd && ff.time === v.time))) return toast('Outro aluno já tem aula fixa nesse dia e horário');
      (st.fixed ||= []).push({ id: uid(), wd: +v.wd, time: v.time, location: v.location || 'A combinar' });
      applyFixed(true); rerender(); sheetStudent(t, st); toast('Aula fixa criada. As próximas 4 semanas já foram marcadas.'); break;
    }
    case 'f-loc': { const l = v.loc.trim(); if (!t.locations.includes(l)) t.locations.push(l); if (v.addr?.trim()) t.addr[l] = v.addr.trim(); rerender(); toast('Local adicionado'); break; }
    case 'f-plan':
      t.plans.push({ id: uid(), name: v.name.trim(), kind: v.kind, perWeek: v.kind === 'avulsa' ? 0 : Math.max(1, +v.perWeek || 1), people: Math.max(1, +v.people || 1), price: +v.price });
      closeSheet(); rerender(); toast('Plano criado'); break;
    case 'f-student': {
      const s = db.students.find((x) => x.id === f.dataset.id);
      const ph = onlyDigits(v.phone);
      if (ph.length < 10) return toast('Digite o celular com DDD');
      if (db.students.some((x) => x.id !== s.id && x.trainerId === t.id && x.phone === ph)) return toast('Já existe outro aluno com este celular');
      s.name = v.name.trim() || s.name; s.phone = ph; s.addr = (v.addr || '').trim();
      s.planId = v.planId; s.credits = Math.max(0, +v.credits || 0); s.due = v.due || undefined;
      const np = planOf(t, s.planId); if (np && np.kind !== 'avulsa' && !s.due) s.due = dkey(today());
      closeSheet(); rerender(); toast('Aluno atualizado'); break;
    }
    case 'f-book': {
      const time = f.dataset.time;
      if (inSlot(t.id, ui.day, time).length > 0 || blockAt(t, ui.day, time)) { closeSheet(); render(); return toast('Esse horário ficou indisponível'); }
      if (f.dataset.resched) {
        const old = db.bookings.find((b) => b.id === f.dataset.resched);
        old.status = 'cancelada'; freeSlot(old);
        db.bookings.push({ id: uid(), trainerId: t.id, studentId: u.id, date: ui.day, time, location: v.location, status: 'ok', usedCredit: !!old.usedCredit, dur: t.slotMin });
        ui.resched = null; closeSheet(); rerender(); toast('Aula remarcada! ✓'); break;
      }
      const usedCredit = f.dataset.credit === '1';
      if (usedCredit) u.credits -= 1;
      db.bookings.push({ id: uid(), trainerId: t.id, studentId: u.id, date: ui.day, time, location: v.location, status: 'ok', usedCredit, dur: t.slotMin });
      db.waitlist = db.waitlist.filter((w) => !(w.studentId === u.id && w.date === ui.day && w.time === time));
      closeSheet(); rerender(); toast('Aula marcada! ✓'); break;
    }
    case 'f-newstudent': {
      const ph = onlyDigits(v.phone);
      if (ph.length < 10) return toast('Digite o celular com DDD');
      if (db.students.some((x) => x.trainerId === t.id && x.phone === ph)) return toast('Já existe um aluno com este celular');
      const pl = planOf(t, v.planId);
      const ns = { id: uid(), trainerId: t.id, name: v.name.trim(), phone: ph, pin: '', planId: v.planId, credits: Math.max(0, +v.credits || 0), since: dkey(today()), due: pl && pl.kind !== 'avulsa' ? dkey(today()) : undefined };
      db.students.push(ns); rerender();
      const msg = `Olá, ${ns.name.split(' ')[0]}! Agora você marca suas aulas comigo pelo app Agenda Personal. Abra o app, toque em "Sou aluno" → "Primeiro acesso" e use o código ${t.code} com este celular.`;
      openSheet(`<div style="text-align:center"><div style="font-size:2.4rem">✅</div><h2 style="margin-top:6px">${esc(ns.name)} foi adicionado</h2>
        <p class="muted">Envie o convite para ele entrar no app.</p></div>
        <div class="stack" style="margin-top:14px"><a class="btn" style="display:block;text-align:center;text-decoration:none" href="https://wa.me/55${ph}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviar convite pelo WhatsApp</a>
        <button class="ghost" data-act="close">Agora não</button></div>`);
      break;
    }
    case 'f-tbook': {
      const time = f.dataset.time; const st = findStudent(v.studentId);
      if (inSlot(t.id, ui.day, time).length || blockAt(t, ui.day, time)) { closeSheet(); render(); return toast('Esse horário não está mais livre'); }
      const pl = planOf(t, st.planId); const usedCredit = !!(pl && pl.kind === 'avulsa' && st.credits > 0);
      if (usedCredit) st.credits -= 1;
      db.bookings.push({ id: uid(), trainerId: t.id, studentId: st.id, date: ui.day, time, location: v.location, status: 'ok', usedCredit, dur: t.slotMin, byTrainer: true });
      closeSheet(); rerender(); toast(`Aula marcada para ${st.name.split(' ')[0]}`); break;
    }
    case 'f-block': {
      const time = f.dataset.time; const reason = (v.reason || '').trim();
      if (time === 'day') t.blocks.push({ id: uid(), date: ui.day, start: '00:00', end: '23:59', reason });
      else t.blocks.push({ id: uid(), date: ui.day, start: time, end: toTime(toMin(time) + t.slotMin), reason });
      closeSheet(); rerender(); toast(time === 'day' ? 'Dia bloqueado' : 'Horário bloqueado'); break;
    }
    case 'f-gym': {
      const pos = ui.pendingPos; if (!pos) return closeSheet();
      u.geo = { on: true, lat: pos.lat, lng: pos.lng, name: v.name.trim() || 'Minha academia' }; ui.pendingPos = null;
      closeSheet(); rerender(); startGeo(); toast('Pronto! Vamos te avisar quando chegar.');
      if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
      break;
    }
    case 'f-buy': {
      const p = planOf(t, f.dataset.id); const q = Math.min(20, Math.max(1, +v.qty || 1));
      db.requests.push({ id: uid(), studentId: u.id, trainerId: t.id, type: 'avulsa', planId: p.id, qty: q, date: dkey(today()) });
      closeSheet(); rerender(); toast('Pedido enviado ao seu personal'); break;
    }
  }
});

document.addEventListener('touchstart', () => {}, { passive: true }); // ativa o efeito :active no iPhone
render();
startGeo();
