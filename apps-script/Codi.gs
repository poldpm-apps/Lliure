/**
 * LLIURE — el servidor dels avisos de les pastilles
 *
 * Un sol fitxer. Fa una cosa: t'avisa al mòbil quan et toca una pastilla,
 * encara que l'app estigui tancada, i deixa de fer-ho sol quan s'acaba el
 * tractament.
 *
 * COM VA
 *   L'app (GitHub Pages) → doPost: registra el mòbil i la pauta
 *   Un automatisme cada minut → mira si toca una presa → l'envia per Firebase
 *   Passat el dia 25 → l'automatisme s'esborra a si mateix
 *
 * Fa servir el MATEIX projecte de Firebase que Nutrició i el cos (jefe-f0832)
 * i el mateix compte de servei, que va a les propietats de l'script.
 *
 * PROPIETATS DE L'SCRIPT (mai al codi ni al repositori)
 *   CLAU_ACCES       la clau que enganxes a l'app; la crea `instala()`
 *   FIREBASE_COMPTE  el JSON del compte de servei; el mateix que a Nutrició
 *   LLIURE_ESTAT     el mòbil, la pauta i què s'ha enviat; el gestiona l'script
 *
 * LA PRIMERA VEGADA: executa `instala()`, i després `provaNotificacio()`.
 */

var PROP_CLAU = 'CLAU_ACCES';
var PROP_FIREBASE = 'FIREBASE_COMPTE';
var PROP_ESTAT = 'LLIURE_ESTAT';
var CAU_TESTIMONI = 'fcm_testimoni';

var MIN = 60 * 1000, HORA = 60 * MIN, DIA = 24 * HORA;

/* La pauta: 25 dies, de 6 a 2 comprimits. És la mateixa que a l'app. */
var DIES_TRAC = 25;
var FASES = [
  { de: 1,  a: 3,  n: 6, cada: 2 },
  { de: 4,  a: 12, n: 5, cada: 2.5 },
  { de: 13, a: 16, n: 4, cada: 3 },
  { de: 17, a: 20, n: 3, cada: 5 },
  { de: 21, a: 25, n: 2, cada: 0 }    // 1 o 2 al dia: un sol recordatori
];

/* Un avís que arriba tard no serveix: si l'automatisme s'ha encallat més
   d'aquests minuts, aquella presa ja no s'avisa. */
var MARGE_MIN = 20;

// ===================================================================== porta

function doPost(e) {
  var resposta = function (obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
  };
  var p;
  try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); }
  catch (err) { return resposta({ ok: false, error: 'La petició no és JSON vàlid.' }); }

  var esperada = PropertiesService.getScriptProperties().getProperty(PROP_CLAU);
  if (!esperada) return resposta({ ok: false, error: 'El servidor no té clau d\'accés. Executa instala().' });
  if (String(p.clau || '') !== esperada) return resposta({ ok: false, error: 'La clau d\'accés no és correcta.' });

  try {
    return resposta({ ok: true, dades: accio_(p.accio, p.params || {}) });
  } catch (err) {
    return resposta({ ok: false, error: String(err && err.message || err) });
  }
}

function doGet() {
  return ContentService.createTextOutput('Lliure: servidor dels avisos. Funciona.');
}

function accio_(accio, params) {
  var bloc = LockService.getScriptLock();
  bloc.waitLock(10000);
  try {
    var estat = llegeixEstat_();
    var r;
    if (accio === 'registra') {
      var fitxa = String(params.fitxa || '').trim();
      if (fitxa.length < 20) throw new Error('La fitxa del mòbil no és vàlida.');
      estat.fitxa = fitxa;
      estat.nom = String(params.nom || 'Mòbil');
      aplicaPauta_(estat, params);
      r = { registrat: true };
    } else if (accio === 'pauta') {
      aplicaPauta_(estat, params);
      r = { desada: true };
    } else if (accio === 'presa') {
      var clau = String(params.data || '') + '#' + Number(params.k);
      estat.preses = estat.preses || {};
      if (params.feta) estat.preses[clau] = 1; else delete estat.preses[clau];
      r = { desada: true };
    } else if (accio === 'prova') {
      desaEstat_(estat);
      return envia_(estat, 'Pastilles', 'Els avisos funcionen. Et diré quan et toqui cada presa.', 'prova');
    } else if (accio === 'estat') {
      r = { fitxa: !!estat.fitxa, tracInici: estat.tracInici || '', tracHora: estat.tracHora || '',
            automatisme: teAutomatisme_(), firebase: !!compte_() };
    } else {
      throw new Error('Acció desconeguda: ' + accio);
    }
    desaEstat_(estat);
    return r;
  } finally {
    bloc.releaseLock();
  }
}

function aplicaPauta_(estat, params) {
  var abans = estat.tracInici + '|' + estat.tracHora;
  if (params.tracInici !== undefined) {
    var ini = String(params.tracInici || '');
    if (ini && !/^\d{4}-\d{2}-\d{2}$/.test(ini)) throw new Error('El dia 1 no té el format AAAA-MM-DD.');
    estat.tracInici = ini;
  }
  if (params.tracHora !== undefined) {
    var h = String(params.tracHora || '08:00');
    if (!/^\d{2}:\d{2}$/.test(h)) throw new Error('L\'hora no té el format HH:MM.');
    estat.tracHora = h;
  }
  // Una pauta NOVA vol dir horaris nous: el que constava com a enviat ja no
  // val. Si és la mateixa (l'app la reenvia en renovar la fitxa), no es toca:
  // si no, una presa avisada fa cinc minuts es tornaria a avisar.
  if (estat.tracInici + '|' + estat.tracHora !== abans) estat.enviades = {};
  // Si torna a haver-hi tractament, que torni a haver-hi automatisme.
  if (estat.tracInici && !acabat_(estat)) asseguraAutomatisme_();
}

// ================================================================ l'horari

/** Totes les preses d'un dia de tractament, amb l'hora de debò (Date). */
function presesDelDia_(estat, dia) {
  var f = null;
  for (var i = 0; i < FASES.length; i++) if (dia >= FASES[i].de && dia <= FASES[i].a) f = FASES[i];
  if (!f) return [];
  var parts = estat.tracInici.split('-').map(Number);
  var hm = (estat.tracHora || '08:00').split(':').map(Number);
  var base = new Date(parts[0], parts[1] - 1, parts[2] + (dia - 1), hm[0], hm[1], 0);
  var n = f.cada ? f.n : 1, llista = [];
  for (var k = 0; k < n; k++) {
    llista.push({
      dia: dia, k: k, n: f.n, lliure: !f.cada,
      quan: new Date(base.getTime() + k * f.cada * HORA),
      // la data del DIA DE TRACTAMENT, que és la que fa servir l'app per marcar
      data: Utilities.formatDate(base, Session.getScriptTimeZone(), 'yyyy-MM-dd')
    });
  }
  return llista;
}

function diaDeTractament_(estat, ara) {
  var parts = estat.tracInici.split('-').map(Number);
  var inici = new Date(parts[0], parts[1] - 1, parts[2], 12);
  var avui = new Date(ara.getFullYear(), ara.getMonth(), ara.getDate(), 12);
  return Math.round((avui - inici) / DIA) + 1;
}

function acabat_(estat) {
  if (!estat.tracInici) return true;
  var ara = new Date();
  var dia = diaDeTractament_(estat, ara);
  if (dia <= DIES_TRAC) return false;
  // El dia 26 encara pot quedar una presa del 25 passada la mitjanit.
  var ultimes = presesDelDia_(estat, DIES_TRAC);
  var darrera = ultimes[ultimes.length - 1];
  return !darrera || ara.getTime() > darrera.quan.getTime() + MARGE_MIN * MIN;
}

// ============================================================ l'automatisme

/** Cada minut. Si toca una presa i no s'ha avisat ni l'has marcada, avisa. */
function cadaMinut() {
  var bloc = LockService.getScriptLock();
  if (!bloc.tryLock(5000)) return;
  try {
    var estat = llegeixEstat_();
    if (!estat.tracInici) return;
    if (acabat_(estat)) {
      treuAutomatisme_();
      console.log('Tractament acabat: automatisme esborrat.');
      return;
    }
    if (!estat.fitxa) return;

    var ara = new Date(), dia = diaDeTractament_(estat, ara);
    var candidates = presesDelDia_(estat, dia - 1).concat(presesDelDia_(estat, dia));
    estat.enviades = estat.enviades || {};
    estat.preses = estat.preses || {};
    var canvis = false;

    candidates.forEach(function (p) {
      var id = p.data + '#' + p.k;
      var t = p.quan.getTime();
      if (ara.getTime() < t || ara.getTime() > t + MARGE_MIN * MIN) return;
      if (estat.enviades[id] || estat.preses[id]) return;
      var hora = Utilities.formatDate(p.quan, Session.getScriptTimeZone(), 'HH:mm');
      var titol = p.lliure ? 'Pastilles' : 'Pastilla · ' + (p.k + 1) + ' de ' + p.n;
      var cos = p.lliure
        ? 'Avui, 1 o 2 comprimits. Dia ' + p.dia + ' de ' + DIES_TRAC + '.'
        : 'Toca la de les ' + hora + '. Dia ' + p.dia + ' de ' + DIES_TRAC + '.';
      var r = envia_(estat, titol, cos, 'presa', { data: p.data, k: String(p.k) });
      estat.enviades[id] = r.enviades ? 'ok' : 'error';
      canvis = true;
    });

    if (canvis) { netejaVell_(estat); desaEstat_(estat); }
  } finally {
    bloc.releaseLock();
  }
}

/** Només es guarden els últims dies: la propietat té un límit de mida. */
function netejaVell_(estat) {
  var limit = Utilities.formatDate(new Date(Date.now() - 3 * DIA), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  ['enviades', 'preses'].forEach(function (camp) {
    var o = estat[camp] || {};
    Object.keys(o).forEach(function (k) { if (k.split('#')[0] < limit) delete o[k]; });
  });
}

function teAutomatisme_() {
  return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'cadaMinut'; });
}
function asseguraAutomatisme_() {
  if (!teAutomatisme_()) ScriptApp.newTrigger('cadaMinut').timeBased().everyMinutes(1).create();
}
function treuAutomatisme_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'cadaMinut') ScriptApp.deleteTrigger(t);
  });
}

// ================================================================= l'estat

function llegeixEstat_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(PROP_ESTAT) || '{}'); }
  catch (e) { return {}; }
}
function desaEstat_(estat) {
  PropertiesService.getScriptProperties().setProperty(PROP_ESTAT, JSON.stringify(estat));
}

// =============================================================== Firebase
/* El mateix camí que Nutrició: JWT signat amb el compte de servei → testimoni
   de Google → FCM v1. Apps Script no pot fer Web Push directe (li falten les
   primitives ECDSA/ECDH), però sí signar amb RSA, que és el que cal aquí. */

function compte_() {
  var brut = PropertiesService.getScriptProperties().getProperty(PROP_FIREBASE);
  if (!brut) return null;
  try {
    var c = JSON.parse(brut);
    return (c && c.client_email && c.private_key && c.project_id) ? c : null;
  } catch (e) { return null; }
}

function b64url_(dades) { return Utilities.base64EncodeWebSafe(dades).replace(/=+$/, ''); }

/** La clau ve d'un JSON i pot portar els salts de línia escrits com a «\n». */
function plegaPem_(text) {
  var brut = String(text || '').replace(/\\n/g, '\n').trim();
  if (brut.indexOf('\n') !== -1) return brut;
  var m = brut.match(/-----BEGIN ([A-Z0-9 ]+)-----([\s\S]*?)-----END [A-Z0-9 ]+-----/);
  if (!m) return brut;
  var cos = m[2].replace(/\s+/g, ''), linies = [];
  for (var i = 0; i < cos.length; i += 64) linies.push(cos.slice(i, i + 64));
  return '-----BEGIN ' + m[1] + '-----\n' + linies.join('\n') + '\n-----END ' + m[1] + '-----';
}

function testimoni_() {
  var cache = CacheService.getScriptCache();
  var desat = cache.get(CAU_TESTIMONI);
  if (desat) return desat;
  var c = compte_();
  if (!c) throw new Error('Falta FIREBASE_COMPTE a les propietats de l\'script (copia el de Nutrició).');
  var ara = Math.floor(Date.now() / 1000);
  var cap = b64url_(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  var cos = b64url_(JSON.stringify({
    iss: c.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token', iat: ara, exp: ara + 3600
  }));
  // La signatura es passa en bytes TAL QUAL: convertir-la a text la corromp.
  var sig = Utilities.computeRsaSha256Signature(cap + '.' + cos, plegaPem_(c.private_key));
  var r = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cap + '.' + cos + '.' + b64url_(sig) }
  });
  if (r.getResponseCode() !== 200) throw new Error('Google no ha donat testimoni (' + r.getResponseCode() + '): ' + r.getContentText().slice(0, 200));
  var t = JSON.parse(r.getContentText()).access_token;
  cache.put(CAU_TESTIMONI, t, 3300);
  return t;
}

function envia_(estat, titol, cos, etiqueta, extra) {
  var c = compte_();
  if (!c) return { enviades: 0, motiu: 'Falta FIREBASE_COMPTE.' };
  if (!estat.fitxa) return { enviades: 0, motiu: 'Cap mòbil registrat. Activa els avisos des de l\'app.' };
  var r = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + c.project_id + '/messages:send', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + testimoni_() },
    payload: JSON.stringify({ message: {
      token: estat.fitxa,
      // `data` i no `notification`: la pinta el nostre treballador de servei.
      // `data` i `k` diuen quina presa és: el botó «Presa ✓» la marca.
      data: Object.assign({ titol: titol, cos: cos, url: './', etiqueta: 'lliure-' + etiqueta }, extra || {}),
      // Urgent: Android no la retarda encara que el mòbil estigui en repòs.
      // TTL curt: un avís de pastilla que arriba una hora tard no serveix.
      webpush: { headers: { Urgency: 'high', TTL: '1800' }, fcm_options: { link: './' } }
    } })
  });
  var codi = r.getResponseCode();
  if (codi === 200) return { enviades: 1 };
  console.warn('FCM ' + codi + ': ' + r.getContentText().slice(0, 300));
  // 404/403: la fitxa ja no serveix (l'app s'ha reinstal·lat). L'app la
  // tornarà a enviar la propera vegada que l'obris.
  if (codi === 404 || codi === 403) { estat.fitxa = ''; }
  return { enviades: 0, codi: codi, motiu: r.getContentText().slice(0, 200) };
}

// ========================================================== per a l'editor

/** La primera vegada. Crea la clau d'accés i l'automatisme, i diu què falta. */
function instala() {
  var props = PropertiesService.getScriptProperties();
  var clau = props.getProperty(PROP_CLAU);
  if (!clau) {
    clau = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty(PROP_CLAU, clau);
  }
  asseguraAutomatisme_();
  console.log('CLAU D\'ACCÉS (enganxa-la a l\'app): ' + clau);
  console.log(compte_() ? 'Firebase: correcte.' : 'FALTA: afegeix FIREBASE_COMPTE a les propietats de l\'script, el mateix valor que a Nutrició.');
  console.log('Automatisme cada minut: instal·lat.');
  console.log('Ara: Desplega → Desplegament nou → Aplicació web (executa com a tu, accés: qualsevol) i copia l\'adreça que acaba en /exec.');
}

/** T'envia un avís de prova al mòbil registrat. */
function provaNotificacio() {
  var r = envia_(llegeixEstat_(), 'Pastilles', 'Avís de prova des de l\'editor.', 'prova');
  console.log(JSON.stringify(r));
}

/** Què hi ha desat i quines són les properes preses. */
function mostraEstat() {
  var e = llegeixEstat_();
  console.log('Mòbil: ' + (e.fitxa ? (e.nom || 'sí') : 'cap') + ' · dia 1: ' + (e.tracInici || '—') + ' · primera presa: ' + (e.tracHora || '—'));
  console.log('Automatisme: ' + (teAutomatisme_() ? 'sí' : 'no') + ' · Firebase: ' + (compte_() ? 'sí' : 'no'));
  if (!e.tracInici) return;
  var dia = diaDeTractament_(e, new Date());
  presesDelDia_(e, dia).forEach(function (p) {
    console.log('Dia ' + p.dia + ' · ' + Utilities.formatDate(p.quan, Session.getScriptTimeZone(), 'dd/MM HH:mm') + ' · ' + (p.k + 1) + ' de ' + p.n);
  });
}
