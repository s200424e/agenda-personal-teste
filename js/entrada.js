/* Agenda Personal — Telas de boas-vindas, login e primeiro acesso */

// ---------- telas de entrada ----------
function viewWelcome() {
  return `
  <div class="welcome stack">
    ${themeSwitch()}
    <div class="logo">🗓️</div>
    <h1>Agenda Personal</h1>
    <p class="muted">Marque suas aulas de forma simples.</p>
    <div style="height:16px"></div>
    <button class="choice" data-go="login:aluno"><span class="ico">🙋</span><div><strong>Sou aluno</strong><span>Ver horários e marcar aulas</span></div></button>
    <button class="choice secondary" data-go="login:personal"><span class="ico">💪</span><div><strong>Sou personal</strong><span>Gerenciar agenda, alunos e planos</span></div></button>
    <p class="small muted" style="margin-top:28px">Demonstração: personal 11999990000 · aluno 11988880000 · senha 1234</p>
  </div>`;
}

function viewLogin(role) {
  const isP = role === 'personal';
  return `
  <header class="top"><button class="ghost small" data-go="welcome">← Voltar</button></header>
  <main>
    <h1>${isP ? 'Entrar como personal' : 'Entrar como aluno'}</h1>
    <form id="f-login">
      <label for="ph">Celular</label>
      <input id="ph" name="phone" inputmode="numeric" autocomplete="tel" placeholder="Somente números" required />
      <label for="pin">Senha (4 números)</label>
      <input id="pin" name="pin" type="password" inputmode="numeric" maxlength="4" required />
      <div style="height:16px"></div>
      <button type="submit">Entrar</button>
    </form>
    <div style="height:12px"></div>
    <button class="ghost" data-go="signup:${role}">${isP ? 'Criar minha conta de personal' : 'Primeiro acesso (tenho o código do meu personal)'}</button>
  </main>`;
}

function viewSignup(role) {
  const isP = role === 'personal';
  return `
  <header class="top"><button class="ghost small" data-go="login:${role}">← Voltar</button></header>
  <main>
    <h1>${isP ? 'Criar conta de personal' : 'Primeiro acesso'}</h1>
    ${isP ? '' : '<p class="muted">Peça ao seu personal o código de convite.</p>'}
    <form id="f-signup" data-role="${role}">
      ${isP ? '' : '<label for="code">Código do personal</label><input id="code" name="code" required style="text-transform:uppercase" />'}
      <label for="nm">Seu nome</label>
      <input id="nm" name="name" autocomplete="name" required />
      <label for="ph">Celular</label>
      <input id="ph" name="phone" inputmode="numeric" autocomplete="tel" required />
      <label for="pin">Crie uma senha de 4 números</label>
      <input id="pin" name="pin" type="password" inputmode="numeric" maxlength="4" minlength="4" required />
      <div style="height:16px"></div>
      <button type="submit">Criar conta</button>
    </form>
  </main>`;
}
