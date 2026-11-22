/* Agenda Personal — funciona sem internet: guarda os arquivos do app no aparelho */
const CACHE = 'agenda-personal-v4';
const FILES = [
  './', './index.html', './style.css', './manifest.webmanifest',
  './js/base.js', './js/temas.js', './js/dados.js', './js/entrada.js', './js/personal.js', './js/aluno.js', './js/main.js',
  './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
// rede primeiro (pega atualizações); sem internet, usa a cópia guardada
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))));
});
