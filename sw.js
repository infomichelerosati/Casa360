// sw.js - Service Worker per Family OS
// Aggiornando questo CACHE_NAME (es. v2, v3), forziamo il browser a scaricare i nuovi file cache-first, ma useremo Network-First per HTML/JS
const CACHE_NAME = 'family-os-v2';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './css/style.css',
    './js/app.js',
    './js/auth.js',
    './js/db.js',
    './js/dashboard.js',
    './js/spesa.js',
    './js/calendario.js',
    './js/finanze.js',
    './js/veicoli.js',
    './js/salute.js',
    './js/famiglia.js',
    './js/animali.js',
    './js/lavoro.js',
    './js/documenti.js',
    './modules/auth.html',
    './modules/dashboard.html',
    './modules/spesa.html',
    './modules/calendario.html',
    './modules/finanze.html',
    './modules/veicoli.html',
    './modules/salute.html',
    './modules/famiglia.html',
    './modules/animali.html',
    './modules/lavoro.html',
    './modules/documenti.html',
    './modules/menu.html',
    './assets/icon.svg',
    './manifest.json'
];

self.addEventListener('install', event => {
    // Precarica i file necessari ma FORZA l'attivazione immediata del nuovo Service Worker
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_TO_CACHE))
    );
});

self.addEventListener('activate', event => {
    // Prendi immediatamente il controllo delle pagine aperte appena attivato
    event.waitUntil(self.clients.claim());

    // Rimuovi vecchie cache non più valide
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
});

self.addEventListener('fetch', event => {
    // Strategia Network-First: prova SEMPRE prima a scaricare dalla rete la versione più recente
    // Se fallisce (offline o server irraggiungibile), usa la versione in Cache!
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Se la richiesta va a buon fine (200), aggiorniamo dinamicamente la cache!
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseToCache = response.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return response;
            })
            .catch(() => {
                // OFFILINE: Fallback alla Cache
                return caches.match(event.request);
            })
    );
});
