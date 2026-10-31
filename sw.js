/* LLIURE — treballador de servei de l'app.
 *
 * Fa dues coses: que Chrome ofereixi INSTAL·LAR l'app (sense treballador només
 * ofereix una drecera) i que s'obri sense cobertura. Primer la xarxa, i si no
 * n'hi ha, el que hi ha desat: així una versió nova entra sempre que hi ha
 * connexió. Els avisos els porta un altre treballador (firebase-messaging-sw.js,
 * abast ./fcm/), perquè un abast només en pot tenir un.
 */
var CAU = 'lliure-v2';
var BASICS = ['./', 'index.html', 'manifest.webmanifest', 'fonts/hanken-grotesk.woff2', 'icona.svg', 'favicon.svg', 'icona-192.png'];

self.addEventListener('install', function (ev) {
  ev.waitUntil(caches.open(CAU).then(function (c) { return c.addAll(BASICS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (ev) {
  ev.waitUntil(caches.keys().then(function (claus) {
    return Promise.all(claus.filter(function (k) { return k !== CAU; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (ev) {
  var req = ev.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  ev.respondWith(fetch(req).then(function (r) {
    if (r.ok) { var copia = r.clone(); caches.open(CAU).then(function (c) { c.put(req, copia); }); }
    return r;
  }).catch(function () {
    return caches.match(req).then(function (r) { return r || caches.match('./'); });
  }));
});
