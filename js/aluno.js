/* Agenda Personal — Área do aluno: Início, Marcar, Minhas aulas, Meu plano, treino e localização */

// ---------- área do aluno ----------

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MAX_AHEAD = 60; // dias que o aluno pode marcar com antecedência
function monthCal(s, t) {
  const now = today();
  if (!ui.month) ui.month = ui.day.slice(0, 7);
  const [y, m] = ui.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const lastDay = new Date(y, m, 0).getDate();
  const limit = addDays(now, MAX_AHEAD);
  const canPrev = first > now;
  const canNext = new Date(y, m, 1) <= limit;
  const myDays = new Set(db.bookings.filter((b) => b.studentId === s.id && b.status === 'ok').map((b) => b.date));
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push('<span></span>');
  for (let d = 1; d <= lastDay; d++) {
    const dt = new Date(y, m - 1, d); const k = dkey(dt);
    const free = dt >= now && dt <= limit && slotsFor(t, k).some((time) => !isPast(k, time) && inSlot(t.id, k, time).length === 0 && !blockAt(t, k, time));
    const mine = myDays.has(k);
    const cls = [k === ui.day ? 'sel' : '', k === dkey(now) ? 'today' : '', free ? 'free' : '', mine ? 'mine' : ''].join(' ');
    const enabled = free || (mine && dt >= now);
    cells.push(`<button class="cal-d ${cls}" ${enabled ? `data-cal="${k}"` : 'disabled'} aria-label="${fmtDate(k)}${mine ? ', aula marcada' : free ? ', com horários' : ', sem horários'}">${d}</button>`);
  }
  return `<div class="card cal">
    <div class="row between cal-head">
      <button class="ghost small" data-month="-1" ${canPrev ? '' : 'disabled'} aria-label="Mês anterior">‹</button>
      <b>${MONTHS[m - 1]} ${y}</b>
      <button class="ghost small" data-month="1" ${canNext ? '' : 'disabled'} aria-label="Próximo mês">›</button>
    </div>
    <div class="cal-grid">${WD3.map((w) => `<span class="cal-w">${w}</span>`).join('')}${cells.join('')}</div>
    <div class="cal-legend small muted"><span><i class="dot free"></i> Tem horário</span><span><i class="dot mine"></i> Aula marcada</span></div>
  </div>`;
}

function viewStudentHome(s, t) {
  const now = new Date();
  const mine = db.bookings.filter((b) => b.studentId === s.id && b.status === 'ok');
  const next = mine.filter((b) => slotDate(b) >= now).sort((a, b) => slotDate(a) - slotDate(b))[0];
  const done = mine.filter((b) => slotDate(b) < now);
  const plan = planOf(t, s.planId);

  // próxima aula
  let nextHtml;
  if (next) {
    const diff = Math.round((parseD(next.date) - today()) / 864e5);
    const when = diff === 0 ? 'Hoje' : diff === 1 ? 'Amanhã' : `Em ${diff} dias`;
    const limit = new Date(slotDate(next) - t.cancelHours * 36e5);
    const limitTxt = +t.cancelHours ? `Pode desmarcar até ${fmtDate(dkey(limit)).split(',')[0].toLowerCase()} às ${pad(limit.getHours())}:${pad(limit.getMinutes())}` : 'Pode desmarcar a qualquer momento';
    nextHtml = `<div class="card next-card">
      <span class="tag">${when}</span>
      <p class="next-time">${next.time}</p>
      <p class="next-date">${fmtDate(next.date)}</p>
      <div class="info-line"><span>📍 ${esc(next.location)}${addrOf(t, next.location) ? `<div class="small muted">${esc(addrOf(t, next.location))}</div>` : ''}</span></div>
      <div class="info-line"><span>👤 ${esc(t.name)} · ${t.slotMin} min</span></div>
      <p class="small muted" style="margin-top:6px">${limitTxt}</p>
      <div style="height:10px"></div>
      ${routeBtns(destOf(t, next))}<button class="ghost" data-act="open-b" data-id="${next.id}">Ver ou desmarcar</button>
    </div>`;
  } else {
    nextHtml = `<div class="card empty">Você não tem aula marcada.<br><br><button data-tab="agendar">Marcar uma aula</button></div>`;
  }

  // frequência da semana (Seg a Dom)
  const ws = parseD(weekStart(today()));
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const classDays = new Set(done.map((b) => b.date));
  const selfDays = new Set(db.checkins.filter((c) => c.studentId === s.id).map((c) => c.date));
  const trainedDays = new Set([...classDays, ...selfDays]);
  const todayK = dkey(today());
  const todayCheck = db.checkins.find((c) => c.studentId === s.id && c.date === todayK);
  const classToday = classDays.has(todayK);
  const bookedDays = new Set(mine.filter((b) => slotDate(b) >= now).map((b) => b.date));
  const weekDone = weekDays.filter((d) => classDays.has(dkey(d))).length;
  const weekAll = weekDays.filter((d) => trainedDays.has(dkey(d))).length;
  const goal = plan?.perWeek || 0;
  const strip = weekDays.map((d) => {
    const k = dkey(d); const st = classDays.has(k) ? 'done' : selfDays.has(k) ? 'self' : bookedDays.has(k) ? 'booked' : k === todayK ? 'today' : '';
    return `<div class="wk ${st}"><span>${WD3[d.getDay()][0]}</span><i>${st === 'done' || st === 'self' ? '✓' : d.getDate()}</i></div>`;
  }).join('');

  // mês e sequência de semanas
  const monthKey = dkey(today()).slice(0, 7);
  const monthDays = [...trainedDays].filter((k) => k.startsWith(monthKey)).length;
  let streak = 0; let w = addDays(ws, -7);
  while ([...trainedDays].some((k) => weekStart(parseD(k)) === dkey(w))) { streak++; w = addDays(w, -7); }
  if (weekAll) streak++;

  const planLine = !plan ? '<button class="secondary small" data-tab="plano">Escolher plano</button>'
    : plan.kind === 'avulsa' ? `<b>${s.credits}</b> aula(s) avulsa(s) disponível(is)`
    : `${esc(plan.name)}${s.credits ? ` · +${s.credits} avulsa(s)` : ''}`;

  return `<div class="hello"><h1>Olá, ${esc(s.name.split(' ')[0])} 👋</h1>${themeSwitchCompact()}</div>
    <p class="muted">${goal ? (weekDone >= goal ? 'Meta da semana cumprida. Parabéns!' : `Faltam ${goal - weekDone} aula(s) para sua meta da semana.`) : 'Bom te ver por aqui!'}</p>
    ${seasonBanner('aluno')}
    ${db.notices.filter((n) => n.studentId === s.id).map((n) => `<div class="card notice"><div class="row"><span class="ico-r">🎉</span><div class="grow"><b>Vagou um horário!</b><div class="small">${fmtDate(n.date)} às ${n.time}</div></div></div>
      <div class="row" style="margin-top:10px"><button class="small grow" data-act="notice-book" data-id="${n.id}">Marcar agora</button><button class="ghost small" data-act="notice-dismiss" data-id="${n.id}">Dispensar</button></div></div>`).join('')}
    ${(() => {
      const b = mine.filter((x) => slotDate(x) >= now).sort((a, c) => slotDate(a) - slotDate(c))[0];
      if (!b) return '';
      const n = Math.round((parseD(b.date) - today()) / 864e5); if (n > 1) return '';
      remindOnce(b, t);
      return `<div class="card remind"><span class="ico-r">⏰</span><div class="grow"><b>Lembrete: sua aula é ${n === 0 ? 'hoje' : 'amanhã'} às ${b.time}</b><div class="small muted">📍 ${esc(b.location)}</div>${routeBtns(destOf(t, b))}</div></div>`;
    })()}
    <div class="dash"><section class="dash-a">
    <h2>Próxima aula</h2>${nextHtml}
    <h2>Treino de hoje</h2>
    ${todayCheck
      ? `<div class="card checkin done"><div class="check-ico">✓</div><div class="grow"><b>Treino registrado</b><div class="small muted">Hoje às ${todayCheck.time}${todayCheck.place ? ` · ${esc(todayCheck.place)}` : ''}</div></div><button class="ghost small" data-act="undo-checkin">Desfazer</button></div>`
      : classToday
      ? `<div class="card checkin done"><div class="check-ico">✓</div><div class="grow"><b>Você treinou com ${esc(t.name.split(' ')[0])} hoje</b><div class="small muted">Já contou na sua frequência</div></div></div>`
      : ui.atGym
      ? `<button class="checkin-btn alerta" data-act="checkin"><span class="check-ico">✓</span><span><b>Você está na academia!</b><small>Toque para registrar seu treino</small></span></button>`
      : `<button class="checkin-btn" data-act="checkin"><span class="check-ico">✓</span><span><b>Treinei hoje</b><small>Toque para registrar seu treino</small></span></button>`}
    </section><section class="dash-b">
    <h2>Sua frequência</h2>
    <div class="card">
      <div class="row between"><b>Esta semana</b><span class="muted">${weekAll} dia(s) de treino</span></div>
      ${goal ? `<div class="small muted" style="margin-top:6px">Aulas com personal: ${weekDone} de ${goal}</div><div class="bar"><i style="width:${Math.min(100, (weekDone / goal) * 100)}%"></i></div>` : ''}
      <div class="week">${strip}</div>
      <div class="legend small muted"><span><i class="dot done"></i> Com personal</span><span><i class="dot self"></i> Sozinho</span><span><i class="dot booked"></i> Marcada</span></div>
    </div>
    <div class="metrics">
      <div class="metric"><b>${monthDays}</b><span>Dias treinados no mês</span></div>
      <div class="metric"><b>${streak}</b><span>${streak === 1 ? 'Semana seguida' : 'Semanas seguidas'} 🔥</span></div>
      <div class="metric"><b>${done.length}</b><span>Aulas com personal</span></div>
      <div class="metric"><b>${mine.filter((b) => slotDate(b) >= now).length}</b><span>Aulas marcadas</span></div>
    </div>
    <h2>Conquistas</h2>
    ${(() => {
      const total = trainedDays.size;
      const list = [
        ['🎯', 'Primeiro treino', total >= 1, `${Math.min(total, 1)}/1`],
        ['✅', 'Meta da semana', goal ? weekDone >= goal : weekAll >= 2, goal ? `${weekDone}/${goal}` : `${weekAll}/2`],
        ['🏅', '10 treinos no mês', monthDays >= 10, `${monthDays}/10`],
        ['🔥', '4 semanas seguidas', streak >= 4, `${streak}/4`],
        ['🏆', '50 treinos', total >= 50, `${total}/50`],
      ];
      return `<div class="badges">${list.map(([i, l, ok, prog]) => `<div class="badge ${ok ? 'on' : ''}" title="${l}"><span class="b-ico">${i}</span><b>${l}</b><small>${ok ? 'Conquistado!' : prog}</small></div>`).join('')}</div>`;
    })()}
    <h2>Seu plano</h2>
    <div class="card row between"><span>${planLine}</span>${plan ? '<button class="ghost small" data-tab="plano">Ver</button>' : ''}</div>
    </section></div>`;
}

function viewStudentBook(s, t) {
  if (parseD(ui.day) < today()) ui.day = dkey(today());
  const slots = slotsFor(t, ui.day).filter((time) => !isPast(ui.day, time));
  const check = canStudentBook(s, t);
  const plan = check.plan || planOf(t, s.planId);
  const grid = slots.length ? `<div class="slots">${slots.map((time) => {
    const bs = inSlot(t.id, ui.day, time);
    const mine = bs.some((b) => b.studentId === s.id && b.time === time);
    const blocked = !mine && !bs.length && !!blockAt(t, ui.day, time);
    const taken = !mine && (bs.length > 0 || blocked);
    const waiting = taken && !blocked && db.waitlist.some((w) => w.studentId === s.id && w.date === ui.day && w.time === time);
    const cls = mine ? 'mine' : waiting ? 'full waiting' : taken ? 'full' : '';
    const sub = mine ? 'Marcada ✓' : waiting ? 'Na espera ⏳' : taken ? 'Indisponível' : 'Livre';
    return `<button class="slot ${cls}" data-act="${taken && !blocked ? 'wait' : 'slot'}" data-time="${time}" ${blocked ? 'disabled' : ''} aria-label="${time} ${sub}">${time}<small>${sub}</small></button>`;
  }).join('')}</div>` : '<div class="card empty">Sem horários neste dia.</div>';
  const rb = ui.resched && db.bookings.find((b) => b.id === ui.resched && b.status === 'ok');
  if (ui.resched && !rb) ui.resched = null;
  return `<h1>${rb ? 'Remarcar aula' : 'Marcar aula'}</h1><p class="muted">com ${esc(t.name)}</p>
    ${rb ? `<div class="card resched-bar row"><span class="ico-r">🔁</span><div class="grow"><b>Remarcando: ${fmtDate(rb.date)} às ${rb.time}</b><div class="small muted">Escolha o novo dia e horário.</div></div><button class="ghost small" data-act="resched-cancel">Cancelar</button></div>` : ''}
    ${plan ? `<div class="card row"><div class="grow small">${esc(plan.name)}${plan.kind === 'avulsa' ? ` · <b>${s.credits}</b> aula(s) disponível(is)` : ` · ${KINDS[plan.kind]}`}</div></div>` : ''}
    ${check.ok ? '' : `<div class="card" style="background:var(--warn-soft)">${esc(check.why)}</div>`}
    <div class="split"><section class="split-a"><h2>Escolha o dia</h2>${monthCal(s, t)}</section>
    <section class="split-b"><h2 id="slots-title">${fmtDate(ui.day)}</h2>${grid}</section></div>`;
}

function sheetBook(s, t, time) {
  const date = ui.day;
  const mineB = inSlot(t.id, date, time).find((b) => b.studentId === s.id && b.time === time);
  if (ui.resched) {
    if (mineB) { toast('Escolha um horário diferente do atual'); return; }
    const old = db.bookings.find((b) => b.id === ui.resched);
    openSheet(`<h2 style="margin-top:0">Confirmar remarcação</h2>
      <p><span class="muted">De:</span> <s>${fmtDate(old.date)} às ${old.time}</s><br><span class="muted">Para:</span> <b>${fmtDate(date)} às ${time}</b></p>
      <form id="f-book" data-time="${time}" data-resched="${old.id}">
        ${t.locations.length > 1 ? `<label>Onde?</label><select name="location">${t.locations.map((l) => `<option ${l === old.location ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>` : `<input type="hidden" name="location" value="${esc(old.location)}"/>`}
        <div class="stack" style="margin-top:14px"><button type="submit">Confirmar remarcação</button><button type="button" class="ghost" data-act="close">Voltar</button></div>
      </form>`);
    return;
  }
  if (mineB) return sheetCancel(s, t, mineB);
  const check = canStudentBook(s, t);
  if (!check.ok) { toast(check.why); return; }
  const extra = check.plan.kind !== 'avulsa' && check.plan.perWeek && weekCount(s, date) >= check.plan.perWeek;
  if (extra && s.credits <= 0) {
    toast(`Seu plano permite ${check.plan.perWeek} aula(s) por semana. Você já marcou todas desta semana. Contrate uma aula avulsa para marcar mais.`); return;
  }
  openSheet(`<h2 style="margin-top:0">Confirmar aula</h2>
    <p style="font-size:1.2rem"><b>${fmtDate(date)}</b><br>às <b>${time}</b> (${t.slotMin} min)</p>
    <form id="f-book" data-time="${time}" data-credit="${check.plan.kind === 'avulsa' || extra ? 1 : 0}">
      ${t.locations.length > 1 ? `<label>Onde?</label><select name="location">${t.locations.map((l) => `<option>${esc(l)}</option>`).join('')}</select>` : `<input type="hidden" name="location" value="${esc(t.locations[0] || 'A combinar')}"/><p>📍 ${esc(t.locations[0] || 'Local a combinar com o personal')}</p>`}
      ${check.plan.kind === 'avulsa' || extra ? '<p class="small muted">Será usada 1 aula avulsa do seu saldo.</p>' : ''}
      <div style="height:14px"></div>
      <div class="stack"><button type="submit">Confirmar aula</button><button type="button" class="ghost" data-act="close">Voltar</button></div>
    </form>`);
}

function canCancel(t, b) { return (slotDate(b) - new Date()) / 36e5 >= +t.cancelHours; }

function sheetCancel(s, t, b) {
  const ok = canCancel(t, b);
  openSheet(`<h2 style="margin-top:0">Sua aula</h2>
    <p style="font-size:1.2rem"><b>${fmtDate(b.date)}</b> às <b>${b.time}</b><br>📍 ${esc(b.location)}</p>
    ${ok ? '' : `<p class="card" style="background:var(--warn-soft)">Desmarcação só é permitida até ${t.cancelHours} horas antes. Fale com seu personal.</p>`}
    <div class="stack">
      <button data-act="resched" data-id="${b.id}" ${ok ? '' : 'disabled'}>🔁 Remarcar para outro horário</button>
      <button class="danger" data-act="s-cancel" data-id="${b.id}" ${ok ? '' : 'disabled'}>Desmarcar aula</button>
      <button class="ghost" data-act="close">Voltar</button>
    </div>`);
}

function viewStudentClasses(s, t) {
  const now = new Date();
  const mine = db.bookings.filter((b) => b.studentId === s.id && b.status === 'ok');
  const next = mine.filter((b) => slotDate(b) >= now).sort((a, b) => slotDate(a) - slotDate(b));
  const past = mine.filter((b) => slotDate(b) < now).sort((a, b) => slotDate(b) - slotDate(a)).slice(0, 10);
  const item = (b, canAct) => `<div class="card row"><div class="grow"><b>${fmtDate(b.date)} · ${b.time}</b>${b.fixed ? ' <span class="tag gray">🔁 fixa</span>' : ''}<div class="small muted">📍 ${esc(b.location)}</div></div>${canAct ? `<button class="danger small" data-act="open-b" data-id="${b.id}">Alterar</button>` : '<span class="tag gray">Feita</span>'}</div>`;
  return `<h1>Minhas aulas</h1>
    <h2>Próximas</h2>${next.length ? `<div class="cards-grid">${next.map((b) => item(b, true)).join('')}</div>` : '<div class="card empty">Nenhuma aula marcada.<br><br><button class="small" data-tab="agendar">Marcar aula</button></div>'}
    ${past.length ? `<h2>Anteriores</h2><div class="cards-grid">${past.map((b) => item(b, false)).join('')}</div>` : ''}`;
}

function viewStudentPlan(s, t) {
  const cur = planOf(t, s.planId);
  const avulsas = t.plans.filter((p) => p.kind === 'avulsa');
  const planos = t.plans.filter((p) => p.kind !== 'avulsa');
  // agrupa dias seguidos com o mesmo horário: "Seg a Sex  06:00–12:00"
  const groups = [];
  [1, 2, 3, 4, 5, 6, 0].forEach((i, idx) => {
    const h = t.hours[i]; if (!h.on) return;
    const g = groups[groups.length - 1]; const hr = `${h.start}–${h.end}`;
    if (g && g.hr === hr && g.lastIdx === idx - 1) { g.to = i; g.lastIdx = idx; g.n++; }
    else groups.push({ from: i, to: i, hr, lastIdx: idx, n: 1 });
  });
  const dayLabel = (g) => g.n === 1 ? WD3[g.from] : `${WD3[g.from]} ${g.n === 2 ? 'e' : 'a'} ${WD3[g.to]}`;
  const card = (p) => `<div class="card"><div class="row between"><b>${esc(p.name)}</b>${p.id === s.planId ? '<span class="tag">Seu plano</span>' : ''}</div>
    <div class="small muted">${KINDS[p.kind]}${p.perWeek ? ` · ${p.perWeek}x por semana` : ''} · ${p.people > 1 ? `até ${p.people} pessoas` : 'individual'}</div>
    <div style="font-size:1.2rem;margin:6px 0 10px"><b>${money(p.price)}</b>${p.kind === 'avulsa' ? ' por aula' : p.kind === 'anual' ? ' por ano' : p.kind === 'mensal' ? ' por mês' : ' por semana'}</div>
    ${p.kind === 'avulsa' ? `<button class="secondary" data-act="buy" data-id="${p.id}">Contratar aula avulsa</button>` : p.id === s.planId ? '' : `<button class="secondary" data-act="change-plan" data-id="${p.id}">Mudar para este plano</button>`}</div>`;
  const myReqs = db.requests.filter((r) => r.studentId === s.id);
  const reqHtml = myReqs.map((r) => {
    const pl = planOf(t, r.planId); if (!pl) return '';
    const what = r.type === 'avulsa' ? `${r.qty} aula(s) avulsa(s)` : `Mudar para ${esc(pl.name)}`;
    return `<div class="card req pending"><div class="row between"><div class="grow"><span class="tag warn">Aguardando o personal</span><div style="margin-top:6px"><b>${what}</b></div></div><button class="ghost small" data-act="cancel-req" data-id="${r.id}">Cancelar</button></div></div>`;
  }).join('');
  return `<h1>Meu plano</h1>${reqHtml}
    <div class="set-grid"><section>
    <div class="card"><p class="small muted">Seu personal</p><div class="row"><div class="avatar">${initials(t.name)}</div><div class="grow"><b>${esc(t.name)}</b><div class="small muted">Aulas de ${t.slotMin} min</div></div></div>
      <div class="info-block"><p class="info-title">🗓️ Dias e horários</p>
        ${groups.length ? groups.map((g) => `<div class="info-line"><span>${dayLabel(g)}</span><b>${g.hr}</b></div>`).join('') : '<p class="muted small">Sem dias definidos</p>'}</div>
      <div class="info-block"><p class="info-title">📍 Locais</p>
        ${t.locations.map((l) => `<div class="info-line"><span>${esc(l)}</span></div>`).join('') || '<p class="muted small">Sem locais definidos</p>'}</div></div>
    <div class="card"><b>Plano atual:</b> ${cur ? esc(cur.name) : 'nenhum'}${cur?.kind === 'avulsa' || s.credits ? `<br><b>Aulas avulsas disponíveis:</b> ${s.credits}` : ''}${cur && cur.kind !== 'avulsa' && s.due ? `<br><b>Próximo vencimento:</b> ${fmtShort(s.due)}${daysUntil(s.due) < 0 ? ' <span class="tag danger">Vencido</span>' : ''}` : ''}</div>
    ${(() => {
      if (!cur || cur.kind === 'avulsa' || !s.due || !t.pix?.key || daysUntil(s.due) > 5) return '';
      const code = pixCode(t, cur.price);
      return `<div class="card pay"><b>Pagamento do plano</b><div class="small muted">${daysUntil(s.due) < 0 ? 'Vencido' : 'Vence'} em ${fmtShort(s.due)} · ${money(cur.price)}</div>
        <div class="stack" style="margin-top:10px"><button data-act="copy-pix" data-code="${esc(code)}">Copiar código Pix · ${money(cur.price)}</button>
        <a class="btn ghost" style="display:block;text-align:center;text-decoration:none" href="${waLink(t.phone, `Oi ${firstName(t.name)}! Fiz o Pix de ${money(cur.price)} do meu plano.`)}" target="_blank" rel="noopener">Avisar que paguei</a></div></div>`;
    })()}
    </section><section>
    ${planos.length ? `<h2>Planos</h2>${planos.map(card).join('')}` : ''}
    ${avulsas.length ? `<h2>Aulas avulsas</h2>${avulsas.map(card).join('')}` : ''}
    </section><section>
    <h2>Tamanho da letra</h2>
    <div class="card">${fontChips()}</div>
    <h2>Datas comemorativas</h2>
    ${seasonControls()}
    </section><section>
    <h2>Aviso na academia</h2>
    <div class="card">
      <div class="theme-row"><span>Avisar quando eu chegar</span>
        <label class="switch"><input type="checkbox" role="switch" data-geo-toggle ${s.geo?.on ? 'checked' : ''} aria-label="Avisar quando eu chegar na academia" />
        <span class="track"><span class="thumb">📍</span></span></label></div>
      <p class="small muted" style="margin-top:8px">${s.geo?.lat ? `Sua academia: <b>${esc(s.geo.name)}</b>.` : 'Academia ainda não definida.'} Quando você estiver lá, o app pergunta se vai começar a treinar.</p>
      <button class="secondary" data-act="set-gym" style="margin-top:6px">${s.geo?.lat ? 'Atualizar: estou na academia agora' : 'Estou na academia agora'}</button>
    </div>
    <div class="card stack"><a class="btn secondary" style="display:block;text-align:center;text-decoration:none" href="https://wa.me/55${onlyDigits(t.phone)}" target="_blank" rel="noopener">Falar com meu personal</a><button class="ghost" data-act="logout">Sair</button></div>
    </section></div>`;
}

// ---------- treino por conta própria + aviso por localização ----------
function doCheckin(s, place) {
  const now = new Date(); const k = dkey(now);
  if (db.checkins.some((c) => c.studentId === s.id && c.date === k)) return;
  db.checkins.push({ id: uid(), studentId: s.id, date: k, time: `${pad(now.getHours())}:${pad(now.getMinutes())}`, place });
  rerender(); toast('Treino registrado! Bom treino 💪');
}
const distM = (a, b, c, d) => { const R = 6371e3, r = Math.PI / 180; const x = Math.sin((c - a) * r / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin((d - b) * r / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };
const GEO_RADIUS = 150; // metros
let geoWatch = null;
function startGeo() {
  const s = me();
  if (geoWatch !== null) { navigator.geolocation.clearWatch(geoWatch); geoWatch = null; }
  if (!s || db.session.role !== 'aluno' || !s.geo?.on || !s.geo.lat || !navigator.geolocation) return;
  geoWatch = navigator.geolocation.watchPosition((pos) => checkArrival(pos.coords.latitude, pos.coords.longitude), () => {}, { enableHighAccuracy: true, maximumAge: 60000 });
}
function checkArrival(lat, lng) {
  const s = me(); if (!s?.geo?.on) return;
  const k = dkey(today());
  const near = distM(lat, lng, s.geo.lat, s.geo.lng) <= GEO_RADIUS;
  if (near !== !!ui.atGym) { ui.atGym = near; if (!$modal.innerHTML) render(); }
  if (!near) return;
  if (sessionStorage.getItem('geo-asked-' + k) || db.checkins.some((c) => c.studentId === s.id && c.date === k)) return;
  sessionStorage.setItem('geo-asked-' + k, '1');
  const msg = `Você chegou na ${s.geo.name}. Vai começar a treinar agora?`;
  if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
    const n = new Notification('Hora do treino? 💪', { body: msg }); n.onclick = () => { window.focus(); askTrain(msg); };
  } else askTrain(msg);
}
function askTrain(msg) {
  openSheet(`<div style="text-align:center"><div style="font-size:2.6rem">📍</div><h2 style="margin-top:6px">Hora do treino?</h2><p>${esc(msg)}</p></div>
    <div class="stack" style="margin-top:14px"><button data-act="geo-yes">Sim, vou treinar agora</button><button class="ghost" data-act="geo-no">Agora não</button></div>`);
}
// para testes: simula a chegada na academia
window.__simularChegada = () => { const s = me(); if (s?.geo) { sessionStorage.removeItem('geo-asked-' + dkey(today())); checkArrival(s.geo.lat, s.geo.lng); } };
window.__simularSaida = () => { const s = me(); if (s?.geo) checkArrival(s.geo.lat + 0.01, s.geo.lng); };
document.addEventListener('change', (e) => {
  if (!e.target.matches('[data-geo-toggle]')) return;
  const s = me(); const on = e.target.checked;
  if (on && !s.geo?.lat) { e.target.checked = false; toast('Primeiro toque em "Estou na academia agora"'); render(); return; }
  s.geo.on = on; save(); startGeo();
  if (on && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  toast(on ? 'Aviso ligado' : 'Aviso desligado'); render();
});

// lembrete do navegador na véspera (só com o app aberto; envio automático de verdade precisa de servidor)
function remindOnce(b, t) {
  const key = 'lembrete-' + b.id;
  if (localStorage.getItem(key) || !('Notification' in window) || Notification.permission !== 'granted') return;
  localStorage.setItem(key, '1');
  try { new Notification('Lembrete de aula ⏰', { body: `${fmtDate(b.date)} às ${b.time} · ${b.location}` }); } catch {}
}
