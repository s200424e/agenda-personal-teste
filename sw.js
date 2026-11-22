/* Agenda Personal — funciona sem internet: guarda os arquivos do app no aparelho.
   O nome do cache muda a cada publicação (scripts/build.js), então a versão nova sempre substitui a velha. */
const CACHE = 'agenda-personal-202611221156';
const FILES = [
  './', './index.html', './manifest.webmanifest',
  './css/base.css', './css/celular.css', './css/computador.css',
  './js/base.js', './js/temas.js', './js/dados.js', './js/entrada.js', './js/personal.js', './js/aluno.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// internet primeiro, sempre conferindo com o servidor (cache: 'no-cache'); sem internet, usa a cópia guardada
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request.url, { cache: 'no-cache', credentials: 'same-origin' })
    .then((r) => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); } return r; })
    .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('./index.html'))));
});
