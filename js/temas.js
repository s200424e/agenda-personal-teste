/* Agenda Personal — Temas de datas comemorativas (trocam sozinhos pela data) */

const SEASON_KEY = 'agenda-personal-datas'; // 'auto' | 'off' | chave de um tema (pré-visualização)

// Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher)
function easterDate(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const nthSunday = (y, m, n) => { const d = new Date(y, m, 1); return new Date(y, m, 1 + ((7 - d.getDay()) % 7) + 7 * (n - 1)); };
const between = (d, a, b) => d >= a && d <= b;
const md = (y, m, d) => new Date(y, m - 1, d);

// cores escolhidas para manter o texto legível; onAccent = cor do texto sobre o destaque
const SEASONS = {
  anonovo:   { name: 'Ano Novo', emoji: '✨', accent: '#f5c542', on: '#1d1e20', aluno: 'Feliz Ano Novo! Bora começar o ano treinando com tudo.', personal: 'Feliz Ano Novo! Que seja um ano cheio de alunos e conquistas.',
               when: (d) => d.getMonth() === 11 && d.getDate() >= 26 || d.getMonth() === 0 && d.getDate() <= 6, range: '26/12 a 06/01' },
  carnaval:  { name: 'Carnaval', emoji: '🎉', accent: '#9333ea', on: '#ffffff', aluno: 'É Carnaval! Curta com energia e não esqueça de se hidratar.', personal: 'Carnaval chegando: vale bloquear os dias de folga na agenda.',
               when: (d) => { const e = easterDate(d.getFullYear()); return between(d, addDays(e, -51), addDays(e, -46)); }, range: 'semana do Carnaval' },
  pascoa:    { name: 'Páscoa', emoji: '🐰', accent: '#f0a8c8', on: '#1d1e20', aluno: 'Feliz Páscoa! Chocolate com moderação e treino em dia. 🍫', personal: 'Feliz Páscoa! Bom descanso e ótimos treinos.',
               when: (d) => { const e = easterDate(d.getFullYear()); return between(d, addDays(e, -7), e); }, range: 'semana da Páscoa' },
  maes:      { name: 'Dia das Mães', emoji: '💐', accent: '#ff8fb1', on: '#1d1e20', aluno: 'Feliz Dia das Mães! Que tal convidar sua mãe para treinar junto?', personal: 'Semana das Mães: ótima hora para oferecer aula em dupla.',
               when: (d) => { const s = nthSunday(d.getFullYear(), 4, 2); return between(d, addDays(s, -6), s); }, range: 'semana do 2º domingo de maio' },
  namorados: { name: 'Dia dos Namorados', emoji: '❤️', accent: '#e11d48', on: '#ffffff', aluno: 'Dia dos Namorados: treinar a dois também é programa!', personal: 'Dia dos Namorados: divulgue sua aula em dupla.',
               when: (d) => between(d, md(d.getFullYear(), 6, 5), md(d.getFullYear(), 6, 12)), range: '05/06 a 12/06' },
  junina:    { name: 'Festa Junina', emoji: '🌽', accent: '#f59e0b', on: '#1d1e20', aluno: 'Arraiá do treino! Aproveite as festas sem perder o ritmo.', personal: 'Arraiá! Época ótima para um treino especial com os alunos.',
               when: (d) => between(d, md(d.getFullYear(), 6, 13), md(d.getFullYear(), 6, 30)), range: '13/06 a 30/06' },
  pais:      { name: 'Dia dos Pais', emoji: '👔', accent: '#2563eb', on: '#ffffff', aluno: 'Feliz Dia dos Pais! Que tal trazer seu pai para um treino?', personal: 'Semana dos Pais: ótima hora para oferecer aula em dupla.',
               when: (d) => { const s = nthSunday(d.getFullYear(), 7, 2); return between(d, addDays(s, -6), s); }, range: 'semana do 2º domingo de agosto' },
  edfisica:  { name: 'Dia do Profissional de Ed. Física', emoji: '🏅', accent: '#15803d', on: '#ffffff', aluno: '1º de setembro é o Dia do Profissional de Educação Física. Mande um parabéns para seu personal!', personal: 'Parabéns pelo seu dia! 1º de setembro, Dia do Profissional de Educação Física. 💪',
               when: (d) => between(d, md(d.getFullYear(), 8, 29), md(d.getFullYear(), 9, 2)), range: '29/08 a 02/09' },
  rosa:      { name: 'Outubro Rosa', emoji: '🎀', accent: '#db2777', on: '#ffffff', aluno: 'Outubro Rosa: cuide de você e faça seus exames preventivos.', personal: 'Outubro Rosa: um bom momento para falar de saúde com suas alunas.',
               when: (d) => d.getMonth() === 9, range: 'outubro' },
  azul:      { name: 'Novembro Azul', emoji: '💙', accent: '#2563eb', on: '#ffffff', aluno: 'Novembro Azul: cuidar da saúde também é treino. Faça seus exames.', personal: 'Novembro Azul: um bom momento para falar de saúde com seus alunos.',
               when: (d) => d.getMonth() === 10, range: 'novembro' },
  natal:     { name: 'Natal', emoji: '🎄', accent: '#dc2626', on: '#ffffff', aluno: 'Boas festas! Aproveite o Natal e volte com tudo para os treinos.', personal: 'Boas festas! Lembre de bloquear os feriados na agenda.',
               when: (d) => d.getMonth() === 11 && d.getDate() <= 25, range: '01/12 a 25/12' },
};
// datas curtas têm prioridade sobre as que duram o mês inteiro
const SEASON_ORDER = ['edfisica', 'namorados', 'carnaval', 'pascoa', 'maes', 'pais', 'natal', 'anonovo', 'junina', 'rosa', 'azul'];

function seasonPref() { return localStorage.getItem(SEASON_KEY) || 'auto'; }
function currentSeason(d = today()) {
  const pref = seasonPref();
  if (pref === 'off') return null;
  if (SEASONS[pref]) return pref;
  return SEASON_ORDER.find((k) => SEASONS[k].when(d)) || null;
}
function applySeason() {
  const k = currentSeason(); const root = document.documentElement;
  if (!k) { delete root.dataset.season; root.style.removeProperty('--accent'); root.style.removeProperty('--on-accent'); return; }
  root.dataset.season = k;
  root.style.setProperty('--accent', SEASONS[k].accent);
  root.style.setProperty('--on-accent', SEASONS[k].on);
}
applySeason();

function nextSeason() {
  for (let i = 1; i <= 366; i++) {
    const d = addDays(today(), i); const k = SEASON_ORDER.find((x) => SEASONS[x].when(d));
    if (k && k !== SEASON_ORDER.find((x) => SEASONS[x].when(today()))) return { k, d };
  }
  return null;
}

// faixa discreta no Início (pode ser fechada; volta só na próxima data)
function seasonBanner(role) {
  const k = currentSeason(); if (!k) return '';
  const dk = `season-closed-${k}-${today().getFullYear()}`;
  if (localStorage.getItem(dk) && seasonPref() === 'auto') return '';
  const s = SEASONS[k];
  return `<div class="season-banner"><span class="season-emoji">${s.emoji}</span><div class="grow"><b>${esc(s.name)}</b><div class="small">${esc(role === 'personal' ? s.personal : s.aluno)}</div></div>
    <button class="ghost small season-x" data-act="season-close" data-k="${k}" aria-label="Fechar mensagem">✕</button></div>`;
}

// controle em Ajustes / Meu plano
function seasonControls() {
  const pref = seasonPref(); const nx = nextSeason(); const cur = currentSeason();
  return `<div class="card">
    <div class="theme-row"><span>Temas de datas comemorativas</span>
      <label class="switch"><input type="checkbox" role="switch" data-season-toggle ${pref !== 'off' ? 'checked' : ''} aria-label="Temas de datas comemorativas" />
      <span class="track"><span class="thumb">${cur ? SEASONS[cur].emoji : '🎈'}</span></span></label></div>
    <p class="small muted" style="margin-top:8px">${pref === 'off' ? 'Desligado: o app fica sempre com as cores normais.'
      : cur ? `Agora: <b>${esc(SEASONS[cur].name)}</b> ${SEASONS[cur].emoji}${SEASONS[pref] ? ' (pré-visualização)' : ''}.` : 'Nenhuma data comemorativa hoje.'}
      ${pref === 'auto' && nx ? ` Próximo: ${SEASONS[nx.k].emoji} ${esc(SEASONS[nx.k].name)} em ${pad(nx.d.getDate())}/${pad(nx.d.getMonth() + 1)}.` : ''}</p>
    <label for="season-sel">Ver como fica</label>
    <select id="season-sel" data-season-select>
      <option value="auto" ${pref === 'auto' ? 'selected' : ''}>Automático (pela data)</option>
      ${SEASON_ORDER.slice().sort((a, b) => SEASONS[a].name.localeCompare(SEASONS[b].name)).map((x) => `<option value="${x}" ${pref === x ? 'selected' : ''}>${SEASONS[x].emoji} ${esc(SEASONS[x].name)} · ${SEASONS[x].range}</option>`).join('')}
    </select>
  </div>`;
}

document.addEventListener('change', (e) => {
  if (e.target.matches('[data-season-toggle]')) { localStorage.setItem(SEASON_KEY, e.target.checked ? 'auto' : 'off'); applySeason(); render(); }
  if (e.target.matches('[data-season-select]')) { localStorage.setItem(SEASON_KEY, e.target.value); applySeason(); render(); toast(e.target.value === 'auto' ? 'Tema automático pela data' : `Pré-visualizando: ${SEASONS[e.target.value].name}`); }
});
