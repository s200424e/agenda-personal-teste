/* Agenda Personal — Área do personal: Início, Agenda, Alunos, Métricas, Ajustes, lembretes e cobrança */

// ---------- área do personal ----------
const fmtShort = (k) => { const d = parseD(k); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
const daysUntil = (k) => Math.round((parseD(k) - today()) / 864e5);
const studentsOf = (t) => db.students.filter((s) => s.trainerId === t.id);
const findStudent = (id) => db.students.find((x) => x.id === id);

// vencimento do plano
function addPeriod(k, kind) {
  const d = parseD(k);
  if (kind === 'semanal') d.setDate(d.getDate() + 7);
  else if (kind === 'anual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return dkey(d);
}
function dueStatus(s, t) {
  const p = planOf(t, s.planId);
  if (!p) return { k: 'none', txt: 'Sem plano' };
  if (p.kind === 'avulsa') return s.credits > 0 ? { k: 'ok', txt: `${s.credits} aula(s) no saldo` } : { k: 'soon', txt: 'Sem aulas no saldo' };
  if (!s.due) return { k: 'none', txt: 'Sem vencimento definido' };
  const n = daysUntil(s.due);
  if (n < 0) return { k: 'late', txt: `Vencido há ${-n} dia${n === -1 ? '' : 's'}`, n };
  if (n <= 3) return { k: 'soon', txt: n === 0 ? 'Vence hoje' : n === 1 ? 'Vence amanhã' : `Vence em ${n} dias`, n };
  return { k: 'ok', txt: `Em dia · vence ${fmtShort(s.due)}`, n };
}
const statusTag = (st) => `<span class="tag ${st.k === 'late' ? 'danger' : st.k === 'soon' ? 'warn' : st.k === 'none' ? 'gray' : ''}">${st.k === 'ok' ? 'Em dia' : esc(st.txt)}</span>`;
function markPaid(s, t) {
  const p = planOf(t, s.planId); if (!p || p.kind === 'avulsa') return;
  db.payments.push({ id: uid(), trainerId: t.id, studentId: s.id, amount: +p.price, date: dkey(today()), desc: p.name });
  s.due = addPeriod(s.due || dkey(today()), p.kind);
}

// bloqueios de agenda
function blockAt(t, date, time) {
  const a = toMin(time), z = a + t.slotMin;
  return (t.blocks || []).find((b) => b.date === date && toMin(b.start) < z && toMin(b.end) > a);
}
const dayBlock = (t, date) => (t.blocks || []).find((b) => b.date === date && b.start === '00:00');

function trainerMetrics(t) {
  const studs = studentsOf(t);
  const all = db.bookings.filter((b) => b.trainerId === t.id);
  const now = new Date();
  const wk = weekStart(today());
  const thisWeek = all.filter((b) => b.status === 'ok' && weekStart(parseD(b.date)) === wk).length;
  const last30 = all.filter((b) => { const d = slotDate(b); return d <= now && d >= addDays(now, -30); });
  const cancelRate = last30.length ? Math.round((last30.filter((b) => b.status === 'cancelada').length / last30.length) * 100) : 0;
  const monthKey = dkey(today()).slice(0, 7);
  const received = db.payments.filter((p) => p.trainerId === t.id && p.date.startsWith(monthKey)).reduce((a, p) => a + p.amount, 0);
  const endMonth = dkey(new Date(today().getFullYear(), today().getMonth() + 1, 0));
  const toReceive = studs.reduce((a, s) => { const p = planOf(t, s.planId); return p && p.kind !== 'avulsa' && s.due && s.due <= endMonth ? a + +p.price : a; }, 0);
  const absent = studs.filter((s) => {
    const last = lastTraining(s);
    return !last || last < addDays(now, -14);
  });
  const attention = studs.map((s) => ({ s, st: dueStatus(s, t) })).filter((x) => x.st.k === 'late' || x.st.k === 'soon')
    .sort((a, b) => (a.st.n ?? 99) - (b.st.n ?? 99));
  const low = lowPresence(t);
  // ocupação da agenda nesta semana (seg a dom), sem contar horários bloqueados
  const ws = parseD(weekStart(today())); let slotsTotal = 0, slotsUsed = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i); const k = dkey(d); const h = t.hours[d.getDay()];
    if (!h?.on || dayBlock(t, k)) continue;
    for (let m = toMin(h.start); m + t.slotMin <= toMin(h.end); m += t.slotMin) {
      const time = toTime(m); const busy = inSlot(t.id, k, time).length > 0;
      if (!busy && blockAt(t, k, time)) continue;
      slotsTotal++; if (busy) slotsUsed++;
    }
  }
  const occ = slotsTotal ? Math.round((slotsUsed / slotsTotal) * 100) : 0;
  return { studs, thisWeek, cancelRate, received, toReceive, absent, attention, low, slotsTotal, slotsUsed, occ };
}
function lastTraining(s) {
  const now = new Date();
  return [
    ...db.bookings.filter((b) => b.studentId === s.id && b.status === 'ok' && slotDate(b) <= now).map(slotDate),
    ...db.checkins.filter((c) => c.studentId === s.id).map((c) => parseD(c.date)),
  ].sort((a, b) => b - a)[0];
}

function requestsHtml(t) {
  const reqs = db.requests.filter((r) => r.trainerId === t.id && findStudent(r.studentId) && planOf(t, r.planId));
  if (!reqs.length) return '';
  return `<h2>Pedidos para aprovar <span class="tag">${reqs.length}</span></h2>` + reqs.map((r) => {
    const st = findStudent(r.studentId); const pl = planOf(t, r.planId);
    const what = r.type === 'avulsa' ? `${r.qty} aula(s) avulsa(s) · ${money(pl.price * r.qty)}` : `Mudar para <b>${esc(pl.name)}</b> · ${money(pl.price)}`;
    return `<div class="card req"><div class="row"><div class="avatar">${initials(st.name)}</div><div class="grow"><b>${esc(st.name)}</b><div class="small">${what}</div></div></div>
      <div class="row" style="margin-top:10px"><button class="small" data-act="req-ok" data-id="${r.id}">Aprovar</button><button class="ghost small" data-act="req-no" data-id="${r.id}">Recusar</button></div></div>`;
  }).join('');
}

function viewTrainerHome(t) {
  const m = trainerMetrics(t);
  const now = new Date(); const tk = dkey(today());
  const todays = activeBookings(t.id).filter((b) => b.date === tk).sort((a, b) => toMin(a.time) - toMin(b.time));
  const nextIdx = todays.findIndex((b) => slotDate(b).getTime() + bDur(b) * 6e4 > now.getTime());
  const block = dayBlock(t, tk);
  // roteiro: tempo de deslocamento entre locais diferentes e horário de saída
  const travel = +t.travelMin || 20;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const placeKey = (b) => destOf(t, b) || b.location;
  const nextB = nextIdx >= 0 ? todays[nextIdx] : null;
  const nextLive = nextB && slotDate(nextB) <= now;
  const prevB = nextIdx > 0 ? todays[nextIdx - 1] : null;
  const needTravel = nextB && !nextLive && (!prevB || placeKey(prevB) !== placeKey(nextB));
  const leaveMin = nextB ? toMin(nextB.time) - travel : 0;
  const leaveBanner = needTravel && nowMin >= leaveMin - 10 && nowMin < toMin(nextB.time)
    ? `<div class="card leave-now"><div class="row"><span class="ico-r">🚗</span><div class="grow"><b>${nowMin >= leaveMin ? 'Hora de sair!' : `Saia às ${toTime(leaveMin)}`}</b>
        <div class="small">Aula com ${esc(firstName(findStudent(nextB.studentId)?.name))} às ${nextB.time} · ${esc(nextB.location)}</div></div></div>${routeBtns(destOf(t, nextB))}</div>` : '';
  const todayHtml = todays.length ? `${leaveBanner}<div class="card timeline">${todays.map((b, i) => {
    const s = findStudent(b.studentId); const past = i < nextIdx || nextIdx === -1;
    const live = i === nextIdx && slotDate(b) <= now;
    const prev = todays[i - 1];
    let trip = '';
    if (!past && !live) {
      if (prev && placeKey(prev) !== placeKey(b)) {
        const gap = toMin(b.time) - (toMin(prev.time) + bDur(prev));
        const tight = gap < travel;
        const endPrev = toTime(toMin(prev.time) + bDur(prev));
        trip = tight
          ? `<div class="trip tight"><span>🚗 ~${travel} min até lá · saia assim que terminar (<b>${endPrev}</b>)</span>
              <span class="trip-warn">⚠️ Apertado: só ${Math.max(0, gap)} min entre as aulas · risco de ~${travel - Math.max(0, gap)} min de atraso</span></div>`
          : `<div class="trip"><span>🚗 ~${travel} min até lá · saia às <b>${toTime(toMin(b.time) - travel)}</b></span><span class="muted">${gap} min livres entre as aulas</span></div>`;
      } else if (!prev || i === nextIdx && (!todays[i - 1] || placeKey(todays[i - 1]) !== placeKey(b))) {
        trip = `<div class="trip"><span>🚗 Saia até <b>${toTime(toMin(b.time) - travel)}</b> para chegar a tempo</span></div>`;
      }
    }
    return `${trip}<div class="tl ${past ? 'past' : ''} ${i === nextIdx ? 'next' : ''}">
      <b class="tl-time">${b.time}</b>
      <div class="grow"><b>${esc(s?.name || 'Aluno')}</b><div class="small muted">📍 ${esc(b.location)}</div></div>
      <div class="tl-side">${past ? '<span class="tag gray">Feita</span>' : live ? '<span class="tag">Agora</span>' : i === nextIdx ? '<span class="tag">Próxima</span>' : ''}${!past && i !== nextIdx ? wazeMini(t, b) : ''}</div>
      ${i === nextIdx && !leaveBanner && destOf(t, b) ? routeBtns(destOf(t, b)) : ''}
    </div>`;
  }).join('')}</div>`
    : `<div class="card empty">${block ? `Dia bloqueado${block.reason ? ` · ${esc(block.reason)}` : ''}.` : 'Nenhuma aula hoje.'}</div>`;

  const att = [
    ...m.attention.map(({ s, st }) => {
      const p = planOf(t, s.planId);
      return `<div class="att"><div class="avatar">${initials(s.name)}</div><div class="grow"><b>${esc(s.name)}</b><div class="small">${statusTag(st)} ${p && p.kind !== 'avulsa' ? `· ${money(p.price)}` : ''}</div></div>
        ${p && p.kind !== 'avulsa' ? `<div class="att-btns"><button class="ghost small" data-act="charge" data-id="${s.id}">Cobrar</button><button class="small" data-act="mark-paid" data-id="${s.id}">Recebi</button></div>` : `<button class="ghost small" data-act="student" data-id="${s.id}">Ver</button>`}</div>`;
    }),
    ...m.low.filter(({ s }) => !m.attention.some((x) => x.s.id === s.id)).map(({ s, p }) => `<div class="att"><div class="avatar">${initials(s.name)}</div><div class="grow"><b>${esc(s.name)} <span class="alert-blink">!</span></b><div class="small"><span class="tag danger">Presença ${p.pct}%</span></div></div>
        <a class="btn ghost small wa" href="${waLink(s.phone, msgSaudade(s))}" target="_blank" rel="noopener">WhatsApp</a></div>`),
    ...m.absent.filter((s) => !m.attention.some((x) => x.s.id === s.id) && !m.low.some((x) => x.s.id === s.id)).map((s) => `<div class="att"><div class="avatar">${initials(s.name)}</div><div class="grow"><b>${esc(s.name)}</b><div class="small muted">Sem treinar há 14+ dias</div></div>
        <a class="btn ghost small wa" href="${waLink(s.phone, msgSaudade(s))}" target="_blank" rel="noopener">WhatsApp</a></div>`),
  ];
  const d = today();
  return `
    <div class="hello"><h1>Olá, ${esc(t.name.split(' ')[0])} 👋</h1>${themeSwitchCompact()}</div>
    <p class="muted">${WD[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}</p>
    ${seasonBanner('personal')}
    ${requestsHtml(t)}
    <div class="dash"><section class="dash-a">
    ${(() => {
      const tm = dkey(addDays(today(), 1));
      const list = activeBookings(t.id).filter((b) => b.date === tm);
      if (!list.length) return '';
      const sent = list.filter((b) => b.reminded).length;
      return `<button class="card remind press" data-act="reminders"><span class="ico-r">⏰</span><div class="grow"><b>Lembretes de amanhã</b><div class="small muted">${list.length} aula(s) · ${sent === list.length ? 'todos enviados ✓' : `${list.length - sent} para enviar`}</div></div><span>›</span></button>`;
    })()}
    <div class="row between"><h2>Hoje ${todays.length ? `<span class="tag gray">${todays.length} aula${todays.length > 1 ? 's' : ''}</span>` : ''}</h2>
      <button class="ghost small" data-act="go-agenda-today">Abrir agenda</button></div>
    ${todayHtml}
    ${att.length ? `<h2>Precisa de atenção</h2><p class="small muted" style="margin:-4px 2px 8px">Pagamentos e presença dos últimos 30 dias (alerta abaixo de ${t.lowPct}%).</p><div class="card">${att.join('')}</div>` : ''}
    </section><section class="dash-b">
    <h2>Resumo</h2>
    <div class="metrics">
      <div class="metric"><b>${money(m.received)}</b><span>Recebido no mês</span></div>
      <div class="metric"><b>${money(m.toReceive)}</b><span>A receber no mês</span></div>
      <div class="metric"><b>${m.studs.length}</b><span>Alunos</span></div>
      <div class="metric"><b>${m.thisWeek}</b><span>Aulas na semana</span></div>
    </div>
    <div class="card occ">
      <div class="row between"><b>Agenda da semana</b><b class="occ-pct">${m.occ}%</b></div>
      <div class="bar occ-bar"><i style="width:${m.occ}%"></i></div>
      <div class="small muted">${m.slotsUsed} de ${m.slotsTotal} horários ocupados${m.slotsTotal - m.slotsUsed > 0 ? ` · ${m.slotsTotal - m.slotsUsed} livres` : ''}</div>
    </div>
    <p class="small muted" style="margin:8px 2px 0">Desmarcações nos últimos 30 dias: ${m.cancelRate}%</p>
    <div class="card" style="margin-top:16px"><p class="small muted">Código de convite para seus alunos</p><div class="row between"><b style="font-size:1.5rem;letter-spacing:2px">${esc(t.code)}</b><button class="secondary small" data-act="copy-code">Copiar</button></div></div>
    </section></div>`;
}

function dayStrip(days, t) {
  return `<div class="days">${days.map((d) => {
    const k = dkey(d); const off = !t.hours[d.getDay()]?.on || !!dayBlock(t, k);
    return `<button class="day ${k === ui.day ? 'sel' : ''} ${off ? 'off' : ''}" data-day="${k}">${WD3[d.getDay()]}<b>${d.getDate()}</b></button>`;
  }).join('')}</div>`;
}

function trainerCal(t) {
  if (!ui.month) ui.month = ui.day.slice(0, 7);
  const [y, m] = ui.month.split('-').map(Number);
  const first = new Date(y, m - 1, 1); const lastDay = new Date(y, m, 0).getDate();
  const count = {};
  activeBookings(t.id).forEach((b) => { if (b.date.startsWith(ui.month)) count[b.date] = (count[b.date] || 0) + 1; });
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push('<span></span>');
  for (let d = 1; d <= lastDay; d++) {
    const dt = new Date(y, m - 1, d); const k = dkey(dt); const n = count[k] || 0;
    const off = !t.hours[dt.getDay()]?.on; const blk = !!dayBlock(t, k);
    const cls = ['t-cal', k === ui.day ? 'sel' : '', k === dkey(today()) ? 'today' : '', dt < today() ? 'past' : '', off ? 'off' : '', blk ? 'blk' : ''].join(' ');
    cells.push(`<button class="cal-d ${cls}" data-cal="${k}" aria-label="${fmtDate(k)}${n ? `, ${n} aula(s)` : ''}${blk ? ', bloqueado' : ''}">${d}${n ? `<em>${n}</em>` : blk ? '<em class="lock">🔒</em>' : ''}</button>`);
  }
  return `<div class="card cal">
    <div class="row between cal-head">
      <button class="ghost small" data-month="-1" aria-label="Mês anterior">‹</button>
      <b>${MONTHS[m - 1]} ${y}</b>
      <button class="ghost small" data-month="1" aria-label="Próximo mês">›</button>
    </div>
    <div class="cal-grid">${WD3.map((w) => `<span class="cal-w">${w}</span>`).join('')}${cells.join('')}</div>
    <div class="cal-legend small muted"><span><i class="dot count"></i> Nº de aulas</span><span>🔒 Bloqueado</span><span><i class="dot off"></i> Disponível</span></div>
  </div>`;
}

function viewTrainerAgenda(t) {
  const dBlock = dayBlock(t, ui.day);
  const pastDay = parseD(ui.day) < today();
  const slots = slotsFor(t, ui.day).filter((time) => { const ov = inSlot(t.id, ui.day, time); return !ov.length || ov.some((b) => b.time === time); });
  const body = slots.map((time) => {
    const bs = inSlot(t.id, ui.day, time).filter((b) => b.time === time);
    const past = isPast(ui.day, time);
    if (bs.length) {
      const nWait = db.waitlist.filter((w) => w.trainerId === t.id && w.date === ui.day && w.time === time).length;
      return `<div class="card slot-card"><div class="row between"><b class="tl-time">${time}</b><span>${nWait ? `<span class="tag warn">⏳ ${nWait} na espera</span> ` : ''}<span class="tag">Ocupado</span></span></div>
        ${bs.map((b) => { const s = findStudent(b.studentId); return `<div class="row" style="margin-top:8px"><div class="avatar">${initials(s?.name || '?')}</div><div class="grow">${esc(s?.name)}${b.fixed ? ' <span class="tag gray">🔁 fixa</span>' : ''}<div class="small muted">📍 ${esc(b.location)}</div>${past ? '' : wazeMini(t, b)}</div>${past ? '' : `<button class="danger small" data-act="t-cancel" data-id="${b.id}">Desmarcar</button>`}</div>`; }).join('')}
      </div>`;
    }
    const bl = blockAt(t, ui.day, time);
    if (bl) {
      return `<div class="card slot-card blocked"><div class="row between"><b class="tl-time">${time}</b><span class="tag gray">🔒 Bloqueado</span></div>
        ${bl.reason ? `<div class="small muted" style="margin-top:4px">${esc(bl.reason)}</div>` : ''}
        ${past || bl.start === '00:00' ? '' : `<div class="row t-actions"><button class="ghost small" data-act="unblock" data-id="${bl.id}">Liberar horário</button></div>`}</div>`;
    }
    return `<div class="card slot-card ${past ? 'is-past' : ''}"><div class="row between"><b class="tl-time">${time}</b><span class="tag gray">Livre</span></div>
      ${past ? '' : `<div class="row t-actions"><button class="small" data-act="t-book" data-time="${time}">Marcar aluno</button><button class="ghost small" data-act="t-block" data-time="${time}">Bloquear</button></div>`}</div>`;
  }).join('');
  const dayBar = pastDay ? '' : dBlock
    ? `<div class="card blocked row between"><div class="grow"><b>🔒 Dia bloqueado</b>${dBlock.reason ? `<div class="small muted">${esc(dBlock.reason)}</div>` : ''}</div><button class="ghost small" data-act="unblock" data-id="${dBlock.id}">Liberar dia</button></div>`
    : `<button class="ghost small" data-act="t-block" data-time="day" style="margin-bottom:12px">🔒 Bloquear o dia inteiro</button>`;
  return `<div class="hello"><h1>Agenda</h1>${ui.day !== dkey(today()) ? '<button class="ghost small" data-act="go-agenda-today">Hoje</button>' : ''}</div>
    <div class="split"><section class="split-a"><div style="height:12px"></div>${trainerCal(t)}</section>
    <section class="split-b"><h2 id="slots-title">${fmtDate(ui.day)}</h2>${dayBar}
    ${slots.length ? `<div class="slot-list">${body}</div>` : '<div class="card empty">Você não atende neste dia.<br><span class="small">Altere em Ajustes → Dias e horários.</span></div>'}</section></div>`;
}

function sheetTrainerBook(t, time) {
  const studs = studentsOf(t).sort((a, b) => a.name.localeCompare(b.name));
  if (!studs.length) { toast('Você ainda não tem alunos'); return; }
  openSheet(`<h2 style="margin-top:0">Marcar aula</h2>
    <p style="font-size:1.1rem"><b>${fmtDate(ui.day)}</b> às <b>${time}</b> (${t.slotMin} min)</p>
    <form id="f-tbook" data-time="${time}">
      <label>Aluno</label>
      <select name="studentId" required>${studs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select>
      ${t.locations.length ? `<label>Local</label><select name="location">${t.locations.map((l) => `<option>${esc(l)}</option>`).join('')}</select>` : '<input type="hidden" name="location" value="A combinar" />'}
      <p class="small muted" style="margin-top:10px">Se o aluno usa aulas avulsas, 1 aula sai do saldo dele.</p>
      <div class="stack"><button type="submit">Marcar aula</button><button type="button" class="ghost" data-act="close">Voltar</button></div>
    </form>`);
}
function sheetBlock(t, time) {
  const isDay = time === 'day';
  const n = isDay ? activeBookings(t.id).filter((b) => b.date === ui.day).length : 0;
  openSheet(`<h2 style="margin-top:0">🔒 ${isDay ? 'Bloquear o dia' : 'Bloquear horário'}</h2>
    <p><b>${fmtDate(ui.day)}</b>${isDay ? '' : ` às <b>${time}</b>`}</p>
    <form id="f-block" data-time="${time}">
      <label>Motivo (opcional, só você vê)</label>
      <input name="reason" placeholder="Ex.: médico, feriado, viagem" />
      <div class="chips">${['Feriado', 'Médico', 'Viagem', 'Compromisso'].map((c) => `<button type="button" class="chip" data-chip="${c}">${c}</button>`).join('')}</div>
      ${n ? `<p class="card" style="background:var(--warn-soft);margin-top:12px">Há ${n} aula(s) marcada(s) nesse dia. Elas continuam marcadas: desmarque na agenda se precisar.</p>` : ''}
      <p class="small muted" style="margin-top:10px">Os alunos vão ver ${isDay ? 'o dia' : 'o horário'} como indisponível.</p>
      <div class="stack"><button type="submit">Bloquear</button><button type="button" class="ghost" data-act="close">Voltar</button></div>
    </form>`);
}

function viewTrainerStudents(t) {
  const studs = studentsOf(t).sort((a, b) => a.name.localeCompare(b.name));
  return `<div class="hello"><h1>Alunos</h1><button class="small add-btn" data-act="new-student">+ Novo aluno</button></div>
  <p class="muted">Seus alunos entram com o código <b>${esc(t.code)}</b>.</p>
  ${studs.length ? '<div class="cards-grid">' + studs.map((s) => {
    const p = planOf(t, s.planId); const st = dueStatus(s, t);
    return `<button class="card row ghost student-row" data-act="student" data-id="${s.id}">
      <div class="avatar">${initials(s.name)}</div>
      <div class="grow"><b>${esc(s.name)}</b><div class="small muted">${p ? esc(p.name) : 'Sem plano'}</div><div style="margin-top:4px">${statusTag(st)}</div></div><span class="muted">›</span></button>`;
  }).join('') + '</div>' : '<div class="card empty">Nenhum aluno ainda. Envie seu código de convite.</div>'}`;
}

function sheetStudent(t, s) {
  const now = new Date();
  const mine = db.bookings.filter((b) => b.studentId === s.id && b.status === 'ok');
  const classDays = new Set(mine.filter((b) => slotDate(b) <= now).map((b) => b.date));
  const selfDays = new Set(db.checkins.filter((c) => c.studentId === s.id).map((c) => c.date));
  const since30 = dkey(addDays(today(), -29));
  const n30c = [...classDays].filter((k) => k >= since30).length;
  const n30s = [...selfDays].filter((k) => k >= since30 && !classDays.has(k)).length;
  const last = lastTraining(s);
  const lastTxt = !last ? 'nunca' : (() => { const n = Math.round((today() - new Date(last.getFullYear(), last.getMonth(), last.getDate())) / 864e5); return n === 0 ? 'hoje' : n === 1 ? 'ontem' : `há ${n} dias`; })();
  // 4 semanas (seg a dom)
  const ws = parseD(weekStart(today()));
  const weeks = [3, 2, 1, 0].map((w) => Array.from({ length: 7 }, (_, i) => addDays(ws, -7 * w + i)));
  const heat = weeks.map((wd) => `<div class="heat-row">${wd.map((d) => {
    const k = dkey(d); const c = classDays.has(k) ? 'done' : selfDays.has(k) ? 'self' : d > today() ? 'future' : '';
    return `<i class="${c}" title="${fmtShort(k)}"></i>`;
  }).join('')}</div>`).join('');
  const upcoming = mine.filter((b) => slotDate(b) > now).sort((a, b) => slotDate(a) - slotDate(b)).slice(0, 3);
  const p = planOf(t, s.planId); const st = dueStatus(s, t);
  const pays = db.payments.filter((x) => x.studentId === s.id).sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);
  openSheet(`
    <div class="row"><div class="avatar big">${initials(s.name)}</div><div class="grow"><h2 style="margin:0">${esc(s.name)}</h2><div class="small muted">📱 ${esc(s.phone)} · aluno desde ${s.since ? fmtShort(s.since) : '—'}</div></div></div>
    <div class="row" style="margin-top:12px"><a class="btn secondary small grow" style="text-align:center;text-decoration:none" href="${waLink(s.phone, `Oi ${firstName(s.name)}!`)}" target="_blank" rel="noopener">WhatsApp</a><button class="small grow" data-act="go-agenda-today">Marcar aula</button></div>

    <div class="info-block"><p class="info-title">Frequência · últimas 4 semanas</p>
      <div class="heat"><div class="heat-row heat-head">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((x) => `<span>${x}</span>`).join('')}</div>${heat}</div>
      <div class="legend small muted"><span><i class="dot done"></i> Com você</span><span><i class="dot self"></i> Sozinho</span></div>
      <div class="mini-stats"><div><b>${n30c}</b><span>aulas com você</span></div><div><b>${n30s}</b><span>treinos sozinho</span></div><div><b>${lastTxt}</b><span>último treino</span></div></div>
    </div>

    <div class="info-block"><p class="info-title">🔁 Aulas fixas</p>
      ${(s.fixed || []).map((f) => `<div class="info-line"><span>${[0, 6].includes(+f.wd) ? 'Todo' : 'Toda'} ${WD[f.wd].toLowerCase()} às <b>${f.time}</b><div class="small muted">📍 ${esc(f.location)}</div></span><button class="ghost small" data-act="del-fixed" data-id="${s.id}" data-f="${f.id}">Remover</button></div>`).join('') || '<p class="small muted">Nenhuma. Aulas fixas são marcadas sozinhas toda semana.</p>'}
      <form id="f-fixed" data-id="${s.id}" class="fixed-form">
        <select name="wd" aria-label="Dia da semana">${[1, 2, 3, 4, 5, 6, 0].filter((i) => t.hours[i].on).map((i) => `<option value="${i}">${WD[i]}</option>`).join('')}</select>
        <input type="time" name="time" step="900" value="${t.hours[1]?.start || '07:00'}" required aria-label="Horário" />
        ${t.locations.length > 1 ? `<select name="location" aria-label="Local">${t.locations.map((l) => `<option>${esc(l)}</option>`).join('')}</select>` : `<input type="hidden" name="location" value="${esc(t.locations[0] || 'A combinar')}" />`}
        <button class="small secondary" type="submit">+ Adicionar aula fixa</button>
      </form>
    </div>

    <div class="info-block"><p class="info-title">Próximas aulas</p>
      ${upcoming.length ? upcoming.map((b) => `<div class="info-line"><span>${fmtDate(b.date)}</span><b>${b.time}</b></div>`).join('') : '<p class="small muted">Nenhuma aula marcada.</p>'}
    </div>

    <div class="info-block"><p class="info-title">Pagamento</p>
      <div class="info-line"><span>${p ? esc(p.name) : 'Sem plano'}</span>${statusTag(st)}</div>
      ${p && p.kind !== 'avulsa' ? `<div class="row" style="margin-top:8px"><button class="secondary small grow" data-act="charge" data-id="${s.id}">Cobrar via Pix</button><button class="small grow" data-act="mark-paid" data-id="${s.id}">Recebi ${money(p.price)}</button></div>` : ''}
      ${pays.length ? `<div class="small muted" style="margin-top:10px">Últimos pagamentos</div>${pays.map((x) => `<div class="info-line small"><span>${fmtShort(x.date)} · ${esc(x.desc || '')}</span><b>${money(x.amount)}</b></div>`).join('')}` : ''}
    </div>

    <form id="f-student" data-id="${s.id}" class="info-block"><p class="info-title">Dados do aluno</p>
      <label>Nome</label>
      <input name="name" value="${esc(s.name)}" required autocomplete="off" />
      <label>Celular com DDD</label>
      <input name="phone" value="${esc(s.phone)}" inputmode="numeric" required autocomplete="off" />
      <label>Endereço do aluno <span class="muted small">(para aulas em domicílio)</span></label>
      <input name="addr" value="${esc(s.addr || '')}" placeholder="Rua, número, bairro, cidade" autocomplete="off" />
      ${s.pin ? '' : '<p class="small muted" style="margin-top:6px">⏳ Ainda não fez o primeiro acesso no app.</p>'}
      <p class="info-title" style="margin-top:18px">Plano e saldo</p>
      <label>Plano</label>
      <select name="planId"><option value="">Sem plano</option>${t.plans.map((x) => `<option value="${x.id}" ${x.id === s.planId ? 'selected' : ''}>${esc(x.name)} — ${money(x.price)}</option>`).join('')}</select>
      <label>Próximo vencimento</label>
      <input name="due" type="date" value="${s.due || ''}" />
      <label>Aulas avulsas no saldo</label>
      <input name="credits" type="number" min="0" value="${s.credits}" />
      <div class="stack" style="margin-top:14px"><button type="submit" class="secondary">Salvar alterações</button>
      <button type="button" class="danger" data-act="remove-student" data-id="${s.id}">Remover aluno</button>
      <button type="button" class="ghost" data-act="close">Fechar</button></div>
    </form>`);
}

// ---------- métricas dos alunos ----------
function studentStats(s, days, endOffset = 0) {
  const end = addDays(today(), -endOffset); const start = addDays(end, -(days - 1));
  const a = dkey(start), z = dkey(end); const now = new Date();
  const bk = db.bookings.filter((b) => b.studentId === s.id && b.date >= a && b.date <= z);
  const classDays = new Set(bk.filter((b) => b.status === 'ok' && slotDate(b) <= now).map((b) => b.date));
  const cancels = bk.filter((b) => b.status === 'cancelada').length;
  const selfDays = new Set(db.checkins.filter((c) => c.studentId === s.id && c.date >= a && c.date <= z && !classDays.has(c.date)).map((c) => c.date));
  const total = classDays.size + selfDays.size;
  return { classes: classDays.size, self: selfDays.size, total, cancels, perWeek: total / (days / 7) };
}
// presença = dias treinados (com personal ou sozinho) em relação à meta semanal do plano (ou 2x/semana se não tiver meta)
const lowLimit = () => (db.session?.role === 'personal' ? me()?.lowPct : null) ?? 50;
function presenceOf(s, t, P) {
  const st = studentStats(s, P); const plan = planOf(t, s.planId);
  const goalW = plan?.perWeek || 2;
  const joined = s.since ? Math.round((today() - parseD(s.since)) / 864e5) + 1 : P;
  const days = Math.min(P, joined);
  if (days < 7) return { st, pct: null, goalW, isNew: true };
  return { st, pct: Math.min(100, Math.round((st.total / (goalW * days / 7)) * 100)), goalW };
}
const presClass = (pct) => pct === null ? 'none' : pct >= 75 ? 'good' : pct >= lowLimit() ? 'mid' : 'low';
const lowPresence = (t) => studentsOf(t).map((s) => ({ s, p: presenceOf(s, t, 30) })).filter((x) => x.p.pct !== null && x.p.pct < lowLimit());
// índice "aluno|data" → treinou com personal (T) ou sozinho (S); refeito só quando os dados mudam
let trainIdx = null, trainIdxSig = '';
function trainIndex() {
  const sig = db.bookings.length + ':' + db.checkins.length + ':' + db.bookings.filter((b) => b.status === 'ok').length + ':' + new Date().getHours();
  if (trainIdx && sig === trainIdxSig) return trainIdx;
  const now = new Date(); trainIdx = new Map(); trainIdxSig = sig;
  db.checkins.forEach((c) => trainIdx.set(c.studentId + '|' + c.date, 'S'));
  db.bookings.forEach((b) => { if (b.status === 'ok' && slotDate(b) <= now) trainIdx.set(b.studentId + '|' + b.date, 'T'); });
  return trainIdx;
}
function trainedOn(k, ids) {
  const idx = trainIndex(); const out = [];
  ids.forEach((id) => { const v = idx.get(id + '|' + k); if (v) out.push({ s: findStudent(id), withT: v === 'T' }); });
  return out;
}
function metricsData(t) {
  const P = ui.mPeriod || 30;
  const q = (ui.mQuery || '').trim().toLowerCase();
  const list = studentsOf(t).filter((s) => !q || s.name.toLowerCase().includes(q) || s.phone.includes(q)).map((s) => {
    const pres = presenceOf(s, t, P);
    return { s, cur: pres.st, prev: studentStats(s, P, P), plan: planOf(t, s.planId), pres };
  });
  return { P, list };
}

function metricsBody(t) {
  const { P, list } = metricsData(t);
  const sort = ui.mSort || 'mais';
  list.sort((x, y) => sort === 'nome' ? x.s.name.localeCompare(y.s.name) : sort === 'menos' ? x.cur.total - y.cur.total : y.cur.total - x.cur.total);
  if (!list.length) return `<div class="card empty">Nenhum aluno encontrado para "${esc(ui.mQuery)}".</div>`;

  const active = list.filter((x) => x.cur.total > 0).length;
  const withP = list.filter((x) => x.pres.pct !== null);
  const presence = withP.length ? Math.round(withP.reduce((a, x) => a + x.pres.pct, 0) / withP.length) : 0;
  const avgWeek = list.reduce((a, x) => a + x.cur.perWeek, 0) / list.length;
  const prevTotal = list.reduce((a, x) => a + x.prev.total, 0); const curTotal = list.reduce((a, x) => a + x.cur.total, 0);
  const trend = prevTotal ? Math.round(((curTotal - prevTotal) / prevTotal) * 100) : null;
  const one = list.length === 1 ? list[0] : null;
  const lows = withP.filter((x) => x.pres.pct < lowLimit()).length;

  // gráfico: % de alunos que treinaram em cada dia
  const N = Math.min(P, 30); const ids = list.map((x) => x.s.id);
  const days = Array.from({ length: N }, (_, i) => addDays(today(), -(N - 1 - i)));
  const data = days.map((d) => { const k = dkey(d); const n = trainedOn(k, ids).length; return { d, k, n, pct: Math.round((n / ids.length) * 100) }; });
  const showPct = N <= 14;
  const chart = `<div class="chart day-chart ${N > 14 ? 'dense' : ''}" style="grid-template-columns:repeat(${N},1fr)">${data.map((x) => `
    <button class="bar-col ${ui.mDay === x.k ? 'sel' : ''}" data-act="m-day" data-d="${x.k}" aria-label="${fmtDate(x.k)}: ${x.pct}% dos alunos treinaram">
      ${showPct ? `<em>${x.pct}%</em>` : ''}
      <div class="bar-stack"><i class="b-pct" style="height:${x.pct}%"></i></div>
      <span>${N > 14 ? (x.d.getDate() % 5 === 0 || x.d.getDate() === 1 ? x.d.getDate() : '') : `${WD3[x.d.getDay()][0]}<br>${x.d.getDate()}`}</span></button>`).join('')}</div>`;
  let dayList = '<p class="small muted" style="margin-top:10px">Toque em uma barra para ver quem treinou no dia.</p>';
  if (ui.mDay) {
    const who = trainedOn(ui.mDay, ids);
    dayList = `<div class="day-list"><div class="row between"><b>${fmtDate(ui.mDay)}</b><span class="muted small">${who.length} de ${ids.length} aluno(s)</span></div>
      ${who.length ? who.map((w) => `<div class="info-line"><span>${esc(w.s.name)}</span><span class="tag ${w.withT ? '' : 'gray'}">${w.withT ? 'Com você' : 'Sozinho'}</span></div>`).join('') : '<p class="small muted">Ninguém treinou neste dia.</p>'}</div>`;
  }

  const arrow = (c, p) => c > p ? '<span class="up">▲</span>' : c < p ? '<span class="down">▼</span>' : '<span class="flat">•</span>';
  const rows = list.map((x) => {
    const pc = presClass(x.pres.pct);
    return `<button class="card m-row press" data-act="student" data-id="${x.s.id}">
      <div class="row"><div class="avatar">${initials(x.s.name)}</div>
        <div class="grow"><b>${esc(x.s.name)}</b>${pc === 'low' ? ' <span class="alert-blink" title="Baixa presença">!</span>' : ''}<div class="small muted">${x.plan ? esc(x.plan.name) : 'Sem plano'}</div></div>
        <div class="m-score"><b>${x.cur.total}</b>${arrow(x.cur.total, x.prev.total)}<span>dias</span></div></div>
      <div class="m-split"><span><i class="dot done"></i> ${x.cur.classes} com você</span><span><i class="dot self"></i> ${x.cur.self} sozinho</span>${x.cur.cancels ? `<span class="m-cancel">${x.cur.cancels} desmarc.</span>` : ''}</div>
      ${x.pres.pct === null ? '<div class="m-adh">Aluno novo: presença calculada após 7 dias</div>'
        : `<div class="m-adh"><div class="bar pres ${pc}"><i style="width:${x.pres.pct}%"></i></div><span>${x.pres.pct}% de presença · meta ${x.pres.goalW}x por semana</span></div>`}
    </button>`;
  }).join('');

  const card = (k, val, label) => `<button class="metric clickable press" data-act="m-card" data-k="${k}"><b>${val}</b><span>${label}</span><small class="more">Ver detalhes ›</small></button>`;
  return `
    ${one ? `<p class="small muted" style="margin:0 2px 8px">Mostrando só: <b>${esc(one.s.name)}</b></p>` : ''}
    ${!one && lows ? `<button class="card low-alert press" data-act="m-card" data-k="presenca"><span class="alert-blink">!</span><div class="grow"><b>${lows} aluno${lows > 1 ? 's' : ''} com baixa presença</b><div class="small muted">Vale entrar em contato. Toque para ver.</div></div><span>›</span></button>` : ''}
    <div class="metrics">
      ${card('semana', avgWeek.toFixed(1).replace('.', ','), `Treinos por semana${one ? '' : ' (média)'}`)}
      ${card('presenca', `${presence}%`, 'Presença na academia')}
      ${card('ativos', `${active}/${list.length}`, 'Alunos ativos no período')}
      ${card('trend', trend === null ? '—' : `${trend > 0 ? '+' : ''}${trend}%`, 'Treinos vs período anterior')}
    </div>
    <h2>Alunos treinando por dia</h2>
    <div class="card">${chart}${dayList}</div>
    <div class="row between"><h2>${one ? 'Aluno' : 'Alunos'} <span class="tag gray">${list.length}</span></h2>
      <select class="m-sort" data-msort aria-label="Ordenar"><option value="mais" ${sort === 'mais' ? 'selected' : ''}>Mais ativos</option><option value="menos" ${sort === 'menos' ? 'selected' : ''}>Menos ativos</option><option value="nome" ${sort === 'nome' ? 'selected' : ''}>Nome</option></select></div>
    <div class="cards-grid m-list">${rows}</div>`;
}

function sheetMetric(t, k) {
  const { P, list } = metricsData(t);
  const per = P === 7 ? 'últimos 7 dias' : P === 30 ? 'últimos 30 dias' : 'últimos 3 meses';
  const ids = list.map((x) => x.s.id); const now = new Date();
  let html = '';
  if (k === 'semana') {
    const ws = parseD(weekStart(today()));
    const weeks = Array.from({ length: 8 }, (_, i) => addDays(ws, -7 * (7 - i)));
    const vals = weeks.map((w) => {
      let tot = 0, withT = 0;
      for (let i = 0; i < 7; i++) { const day = addDays(w, i); if (day > today()) break; trainedOn(dkey(day), ids).forEach((x) => { tot++; if (x.withT) withT++; }); }
      return { w, avg: ids.length ? tot / ids.length : 0, withT, self: tot - withT };
    });
    const max = Math.max(1, ...vals.map((v) => v.avg));
    const tot = vals.reduce((a, v) => a + v.withT + v.self, 0);
    html = `<h2 style="margin-top:0">Treinos por semana</h2><p class="muted small">Média de dias de treino por aluno, nas últimas 8 semanas</p>
      <div class="chart wk-chart">${vals.map((v) => `<div class="bar-col"><em>${v.avg.toFixed(1).replace('.', ',')}</em><div class="bar-stack"><i class="b-pct" style="height:${(v.avg / max) * 100}%"></i></div><span>${pad(v.w.getDate())}/${pad(v.w.getMonth() + 1)}</span></div>`).join('')}</div>
      <div class="mini-stats"><div><b>${(vals.slice(-4).reduce((a, v) => a + v.avg, 0) / 4).toFixed(1).replace('.', ',')}</b><span>média últimas 4 sem.</span></div>
        <div><b>${tot ? Math.round((vals.reduce((a, v) => a + v.withT, 0) / tot) * 100) : 0}%</b><span>dos treinos com você</span></div>
        <div><b>${tot ? Math.round((vals.reduce((a, v) => a + v.self, 0) / tot) * 100) : 0}%</b><span>treinos sozinho</span></div></div>`;
  } else if (k === 'presenca') {
    const rows = [...list].sort((a, b) => (a.pres.pct ?? 101) - (b.pres.pct ?? 101));
    html = `<h2 style="margin-top:0">Presença na academia</h2><p class="muted small">Dias treinados em relação à meta semanal de cada aluno · ${per}</p>
      <div class="pres-legend small"><span><i class="dot good"></i> 75%+</span><span><i class="dot mid"></i> ${lowLimit()}–74%</span><span><i class="dot low"></i> abaixo de ${lowLimit()}%</span></div>
      ${rows.map((x) => { const pc = presClass(x.pres.pct); return `<button class="pres-row press ${pc}" data-act="student" data-id="${x.s.id}">
        <div class="row between"><span>${pc === 'low' ? '<span class="alert-blink">!</span> ' : ''}<b>${esc(x.s.name)}</b></span><b>${x.pres.pct === null ? 'novo' : x.pres.pct + '%'}</b></div>
        <div class="bar pres ${pc}"><i style="width:${x.pres.pct ?? 0}%"></i></div>
        <div class="small muted">${x.cur.total} dia(s) · meta ${x.pres.goalW}x/semana${pc === 'low' ? ' · aparece em Início → Precisa de atenção' : ''}</div></button>`; }).join('')}`;
  } else if (k === 'ativos') {
    const act = list.filter((x) => x.cur.total > 0).sort((a, b) => b.cur.total - a.cur.total);
    const ina = list.filter((x) => x.cur.total === 0);
    const lastTxt = (s) => { const l = lastTraining(s); if (!l) return 'nunca treinou'; const n = Math.round((today() - new Date(l.getFullYear(), l.getMonth(), l.getDate())) / 864e5); return `último treino há ${n} dia(s)`; };
    html = `<h2 style="margin-top:0">Alunos ativos</h2><p class="muted small">${per}</p>
      <p class="info-title" style="margin-top:14px">✅ Treinaram (${act.length})</p>
      ${act.map((x) => `<button class="list-row press" data-act="student" data-id="${x.s.id}"><div class="avatar">${initials(x.s.name)}</div><span class="grow">${esc(x.s.name)}</span><b>${x.cur.total} dia(s)</b></button>`).join('') || '<p class="small muted">Ninguém treinou no período.</p>'}
      <p class="info-title" style="margin-top:18px">💤 Não treinaram (${ina.length})</p>
      ${ina.map((x) => `<div class="list-row"><div class="avatar">${initials(x.s.name)}</div><span class="grow">${esc(x.s.name)}<div class="small muted">${lastTxt(x.s)}</div></span><a class="btn ghost small wa" href="${waLink(x.s.phone, msgSaudade(x.s))}" target="_blank" rel="noopener">WhatsApp</a></div>`).join('') || '<p class="small muted">Todos treinaram. 🎉</p>'}`;
  } else if (k === 'trend') {
    const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);
    const c = { t: sum(list, (x) => x.cur.total), w: sum(list, (x) => x.cur.classes), s: sum(list, (x) => x.cur.self), x: sum(list, (x) => x.cur.cancels) };
    const p = { t: sum(list, (x) => x.prev.total), w: sum(list, (x) => x.prev.classes), s: sum(list, (x) => x.prev.self), x: sum(list, (x) => x.prev.cancels) };
    const cmp = (label, a, b, inverse = false) => {
      const max = Math.max(1, a, b); const d = a - b; const good = inverse ? d < 0 : d > 0;
      return `<div class="cmp"><div class="row between"><b>${label}</b><span class="${d === 0 ? 'flat' : good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}${b ? ` (${d > 0 ? '+' : ''}${Math.round((d / b) * 100)}%)` : ''}</span></div>
        <div class="cmp-bar"><span>Agora</span><div class="bar"><i style="width:${(a / max) * 100}%"></i></div><b>${a}</b></div>
        <div class="cmp-bar prev"><span>Antes</span><div class="bar"><i style="width:${(b / max) * 100}%"></i></div><b>${b}</b></div></div>`;
    };
    const deltas = [...list].map((x) => ({ x, d: x.cur.total - x.prev.total })).sort((a, b) => b.d - a.d);
    html = `<h2 style="margin-top:0">Comparação com o período anterior</h2><p class="muted small">${per} comparado aos ${P} dias anteriores</p>
      ${cmp('Dias de treino (total)', c.t, p.t)}${cmp('Aulas com você', c.w, p.w)}${cmp('Treinos sozinho', c.s, p.s)}${cmp('Desmarcações', c.x, p.x, true)}
      <p class="info-title" style="margin-top:18px">Por aluno</p>
      ${deltas.map(({ x, d }) => `<button class="list-row press" data-act="student" data-id="${x.s.id}"><span class="grow">${esc(x.s.name)}<div class="small muted">${x.prev.total} → ${x.cur.total} dia(s)</div></span><b class="${d > 0 ? 'up' : d < 0 ? 'down' : 'flat'}">${d > 0 ? '▲ +' : d < 0 ? '▼ ' : '• '}${d}</b></button>`).join('')}`;
  }
  openSheet(`${html}<div style="height:14px"></div><button class="ghost" data-act="close">Fechar</button>`);
}

function viewTrainerMetrics(t) {
  const P = ui.mPeriod || 30;
  return `<h1>Métricas</h1><p class="muted">Desempenho dos seus alunos</p>
    <div class="m-tools"><div class="search"><span aria-hidden="true">🔍</span><input id="m-q" type="search" placeholder="Buscar aluno pelo nome" value="${esc(ui.mQuery || '')}" autocomplete="off" />${ui.mQuery ? '<button class="ghost small" data-act="m-clear" aria-label="Limpar busca">✕</button>' : ''}</div>
    <div class="chips period">${[[7, '7 dias'], [30, '30 dias'], [90, '3 meses']].map(([d, l]) => `<button class="chip ${P === d ? 'on' : ''}" data-act="m-period" data-p="${d}">${l}</button>`).join('')}</div></div>
    <div id="m-body">${metricsBody(t)}</div>`;
}
document.addEventListener('input', (e) => {
  if (e.target.id !== 'm-q') return;
  ui.mQuery = e.target.value; const t = me(); document.getElementById('m-body').innerHTML = metricsBody(t);
  const wrap = e.target.parentElement; const has = !!wrap.querySelector('[data-act="m-clear"]');
  if (!!ui.mQuery !== has) { if (has) wrap.querySelector('[data-act="m-clear"]').remove(); else wrap.insertAdjacentHTML('beforeend', '<button class="ghost small" data-act="m-clear" aria-label="Limpar busca">✕</button>'); }
});
document.addEventListener('change', (e) => { if (e.target.matches('[data-msort]')) { ui.mSort = e.target.value; render(); } });

function viewTrainerSettings(t) {
  return `<h1>Ajustes</h1><p class="muted">Defina como, onde e quando você trabalha.</p>
  <div class="set-grid"><section>
  <form id="f-settings">
    <h2>Dias e horários</h2>
    <div class="card">
      ${[1, 2, 3, 4, 5, 6, 0].map((i) => `<div class="weekday-row">
        <label class="check"><input type="checkbox" name="on${i}" ${t.hours[i].on ? 'checked' : ''}/> ${WD3[i]}</label>
        <input type="time" name="start${i}" value="${t.hours[i].start}" step="900" />
        <input type="time" name="end${i}" value="${t.hours[i].end}" step="900" />
      </div>`).join('')}
    </div>
    <h2>Como você trabalha</h2>
    <div class="card">
      <label>Duração de cada aula</label>
      <select name="slotMin">${[30, 45, 50, 60, 90].map((m) => `<option value="${m}" ${m === +t.slotMin ? 'selected' : ''}>${m} minutos</option>`).join('')}</select>
      <label>Tempo médio de deslocamento entre locais</label>
      <select name="travelMin">${[10, 15, 20, 30, 45, 60].map((x) => `<option value="${x}" ${x === (+t.travelMin || 20) ? 'selected' : ''}>${x} minutos</option>`).join('')}</select>
      <label>Aluno pode desmarcar até</label>
      <select name="cancelHours">${[0, 2, 6, 12, 24, 48].map((h) => `<option value="${h}" ${h === +t.cancelHours ? 'selected' : ''}>${h ? h + ' horas antes' : 'a qualquer momento'}</option>`).join('')}</select>
      <label>Alerta de baixa presença abaixo de</label>
      <select name="lowPct">${[30, 40, 50, 60, 70].map((x) => `<option value="${x}" ${x === +t.lowPct ? 'selected' : ''}>${x}% da meta do aluno</option>`).join('')}</select>
    </div>
    <button type="submit">Salvar ajustes</button>
  </form>
  </section><section>
  <h2>Onde você atende</h2>
  <div class="card">
    ${t.locations.map((l, i) => `<div class="row between" style="margin-bottom:8px"><span class="grow">📍 ${esc(l)}<div class="small muted">${addrOf(t, l) ? esc(addrOf(t, l)) : 'Sem endereço (sem rota no Waze)'}</div></span><button class="danger small" data-act="del-loc" data-i="${i}">Remover</button></div>`).join('') || '<p class="muted">Nenhum local.</p>'}
    <form id="f-loc" class="loc-form"><input name="loc" placeholder="Nome. Ex.: Academia Centro" required /><input name="addr" placeholder="Endereço (para a rota no Waze)" autocomplete="street-address" /><button class="small" type="submit">Adicionar local</button></form>
  </div>

  <h2>Planos e aulas avulsas</h2>
  ${t.plans.map((p) => `<div class="card row"><div class="grow"><b>${esc(p.name)}</b><div class="small muted">${KINDS[p.kind]}${p.perWeek ? ` · ${p.perWeek}x por semana` : ''} · ${p.people > 1 ? `até ${p.people} pessoas` : 'individual'}</div><div>${money(p.price)}</div></div><button class="danger small" data-act="del-plan" data-id="${p.id}">Remover</button></div>`).join('')}
  <button class="secondary" data-act="new-plan">+ Novo plano ou aula avulsa</button>

  </section><section>
  <h2>Recebimento por Pix</h2>
  <form id="f-pix" class="card">
    <label>Chave Pix</label><input name="key" value="${esc(t.pix.key)}" placeholder="CPF, celular (+55...), e-mail ou chave aleatória" autocomplete="off" />
    <label>Nome do recebedor</label><input name="name" value="${esc(t.pix.name || t.name)}" maxlength="25" />
    <label>Cidade</label><input name="city" value="${esc(t.pix.city)}" maxlength="15" placeholder="Ex.: Sao Paulo" />
    <p class="small muted" style="margin-top:8px">Com a chave salva, o app gera o "Pix copia e cola" com o valor certo para cada aluno.</p>
    <button type="submit" class="secondary" style="margin-top:6px">Salvar Pix</button>
  </form>
  </section><section>
  <h2>Tamanho da letra</h2>
  <div class="card">${fontChips()}</div>
    <h2>Datas comemorativas</h2>
    ${seasonControls()}

  <h2>Conta</h2>
  <div class="card stack">
    <div class="row between"><span>Código de convite</span><b>${esc(t.code)}</b></div>
    <button class="ghost" data-act="logout">Sair</button>
    <button class="danger" data-act="reset">Restaurar dados de demonstração</button>
  </div>
  </section></div>`;
}

function sheetNewPlan() {
  openSheet(`<h2 style="margin-top:0">Novo plano</h2>
    <form id="f-plan">
      <label>Tipo</label>
      <select name="kind">${Object.entries(KINDS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
      <label>Nome (como o aluno vai ver)</label>
      <input name="name" placeholder="Ex.: 3x por semana" required />
      <label>Aulas por semana (deixe 0 para avulsa)</label>
      <input name="perWeek" type="number" min="0" max="7" value="0" />
      <label>Pessoas por aula</label>
      <input name="people" type="number" min="1" max="30" value="1" />
      <label>Preço (R$)</label>
      <input name="price" type="number" min="0" step="0.01" required />
      <div style="height:14px"></div>
      <div class="stack"><button type="submit">Criar</button><button type="button" class="ghost" data-act="close">Cancelar</button></div>
    </form>`);
}


function sheetReminders(t) {
  const tm = dkey(addDays(today(), 1));
  const list = activeBookings(t.id).filter((b) => b.date === tm).sort((a, c) => toMin(a.time) - toMin(c.time));
  openSheet(`<h2 style="margin-top:0">⏰ Lembretes de amanhã</h2><p class="muted small">${fmtDate(tm)} · toque em cada aluno para enviar pelo WhatsApp com a mensagem pronta.</p>
    ${list.map((b) => { const st = findStudent(b.studentId);
      const msg = `Oi ${firstName(st?.name)}! Lembrete: sua aula é amanhã (${fmtDate(b.date).toLowerCase()}) às ${b.time}, em ${b.location}.${destOf(t, b) ? ` Rota no Waze: ${wazeLink(destOf(t, b))}` : ''} Até lá! 💪`;
      return `<div class="list-row"><b class="tl-time">${b.time}</b><span class="grow">${esc(st?.name)}</span>${b.reminded ? '<span class="tag">Enviado ✓</span>' : `<a class="btn small wa-send" data-act="remind-sent" data-id="${b.id}" href="${waLink(st?.phone, msg)}" target="_blank" rel="noopener">Enviar</a>`}</div>`; }).join('')}
    <p class="small muted" style="margin-top:12px">Os alunos também veem o lembrete na tela Início do app.</p>
    <div style="height:10px"></div><button class="ghost" data-act="close">Fechar</button>`);
}

function sheetCharge(t, st) {
  const p = planOf(t, st.planId);
  if (!t.pix?.key) { openSheet(`<h2 style="margin-top:0">Cobrar via Pix</h2><p>Cadastre sua chave Pix em <b>Ajustes → Recebimento por Pix</b> para gerar a cobrança.</p><div class="stack"><button data-act="go-settings">Ir para Ajustes</button><button class="ghost" data-act="close">Voltar</button></div>`); return; }
  const code = pixCode(t, p.price);
  const msg = `Oi ${firstName(st.name)}! Segue o Pix do seu plano (${p.name}) de ${money(p.price)}${st.due ? `, vencimento ${fmtShort(st.due)}` : ''}.\n\nPix copia e cola:\n${code}\n\nQualquer dúvida é só falar. Obrigada! 🙂`;
  openSheet(`<h2 style="margin-top:0">Cobrar ${esc(firstName(st.name))}</h2>
    <p><b style="font-size:1.4rem">${money(p.price)}</b><br><span class="muted small">${esc(p.name)}${st.due ? ` · vence ${fmtShort(st.due)}` : ''}</span></p>
    <label>Pix copia e cola</label><textarea class="pix-code" readonly>${esc(code)}</textarea>
    <div class="stack" style="margin-top:12px">
      <a class="btn" style="display:block;text-align:center;text-decoration:none" href="${waLink(st.phone, msg)}" target="_blank" rel="noopener">Enviar cobrança pelo WhatsApp</a>
      <button class="secondary" data-act="copy-pix" data-code="${esc(code)}">Copiar código Pix</button>
      <button class="ghost" data-act="mark-paid" data-id="${st.id}">Já recebi</button>
      <button class="ghost" data-act="close">Fechar</button>
    </div>
    <p class="small muted" style="margin-top:10px">A confirmação automática do pagamento depende de integração com o banco (próxima etapa, com servidor). Por enquanto, toque em "Já recebi" quando o Pix cair.</p>`);
}
