/* LLIURE — treballador de servei dels avisos (abast ./fcm/)
 *
 * Copiat del de Nutrició. Quan arriba un avís amb l'app tancada, el navegador
 * arrenca aquest fitxer de zero i dispara l'esdeveniment tot seguit: per això
 * la configuració de Firebase va escrita aquí dins i no es demana. És pública
 * per disseny; el que és secret (el compte de servei) viu a l'Apps Script.
 *
 * Si canvies firebase.config.json, canvia també CONFIG aquí sota.
 */

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

var CONFIG = {
  "apiKey": "AIzaSyBJYsvwHI6S9krnYrQ_gBsNoAAezVE97uo",
  "projectId": "jefe-f0832",
  "messagingSenderId": "440469306446",
  "appId": "1:440469306446:web:c7020a8a44223e5374971f"
};

if (CONFIG && CONFIG.apiKey) {
  firebase.initializeApp(CONFIG);

  firebase.messaging().onBackgroundMessage(function (missatge) {
    var d = (missatge && missatge.data) || {};
    return self.registration.showNotification(d.titol || 'Lliure', {
      body: d.cos || '',
      // Sense `icon` a posta: Android no dibuixa icones SVG a les
      // notificacions, i la nostra ho és. Com que l'app està instal·lada,
      // el sistema hi posa la seva. Si la volem pròpia, caldrà un PNG.
      // Mateixa etiqueta = es reemplaça en comptes d'acumular-se. Sense
      // això, set recordatoris deixarien set línies a la barra.
      tag: d.etiqueta || 'lliure',
      renotify: true,
      data: { url: d.url || './' },
      vibrate: [60, 40, 60]
    });
  });
} else {
  console.warn('Lliure: falta la configuració de Firebase.');
}

/**
 * EN TOCAR LA NOTIFICACIÓ, ANAR ON DIU LA NOTIFICACIÓ.
 *
 * Aquí hi havia dos errors, i tots dos acabaven igual: toques l'avís i no vas
 * on toca.
 *
 *   1. `openWindow(desti)` amb un destí relatiu el resolia contra la carpeta
 *      del treballador. A GitHub Pages l'app viu a /jefe/, o sigui que «escola»
 *      es convertia en /jefe/escola i sortia un 404. Ara es construeix
 *      l'adreça sencera a partir de l'arrel, i mai es confia en la relativa.
 *
 *   2. Si l'app JA era oberta, se li feia el focus i s'ignorava el destí. O
 *      sigui que en el cas més habitual —tenir JEFE obert— la notificació et
 *      deixava exactament on ja eres. Ara se li canvia l'adreça i, si el
 *      navegador no ho permet, se li diu per missatge.
 *
 * L'app tria pantalla amb el hash: el destí bo és «./#escola».
 */
self.addEventListener('notificationclick', function (ev) {
  ev.notification.close();

  var arrel = self.registration.scope.replace(/fcm\/$/, '');
  var brut = (ev.notification.data && ev.notification.data.url) || './';

  /* La mateixa normalització que fa el servidor, repetida aquí a posta: una
     notificació desada al telèfon pot ser d'una versió antiga i portar encara
     el nom pelat. Val més arreglar-ho dues vegades que obrir un 404. */
  var vista = '';
  var u = String(brut).trim();
  if (u.indexOf('#') !== -1) vista = u.slice(u.indexOf('#') + 1);
  else if (u && u !== './' && u !== '.' && u !== '/') vista = u.replace(/^\.?\/*/, '');

  var desti = arrel + (vista ? '#' + vista : '');

  ev.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (finestres) {
      for (var i = 0; i < finestres.length; i++) {
        var f = finestres[i];
        if (f.url.indexOf(arrel) !== 0) continue;

        /* Amb finestra oberta: primer se li diu per missatge —l'app ho entén i
           hi navega sense recarregar, que és instantani— i a més se li canvia
           l'adreça per si el missatge no arriba. */
                if (vista && f.navigate) {
          return f.navigate(desti).then(function (c) { return (c || f).focus(); })
                  .catch(function () { return f.focus(); });
        }
        return f.focus();
      }
      return self.clients.openWindow(desti);
    })
  );
});

// Que una versió nova entri de seguida. Si no, es queda esperant que l'antiga
// quedi ociosa i pots passar-te el dia provant la d'abans sense saber-ho.
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (ev) { ev.waitUntil(self.clients.claim()); });
