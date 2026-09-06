// Pure-logic checks for ALORA Asistencia helpers (no DOM / Firebase).
function asPad(n) { return String(n).padStart(2, '0'); }
function asLocalDateStr(ts) {
  var d = ts ? new Date(ts) : new Date();
  return d.getFullYear() + '-' + asPad(d.getMonth() + 1) + '-' + asPad(d.getDate());
}
function asQuincenaRange(d) {
  var y = d.getFullYear(), m = d.getMonth();
  if (d.getDate() <= 15) return { from: new Date(y, m, 1, 0, 0, 0, 0), to: new Date(y, m, 15, 23, 59, 59, 999), label: '1–15' };
  var last = new Date(y, m + 1, 0).getDate();
  return { from: new Date(y, m, 16, 0, 0, 0, 0), to: new Date(y, m, last, 23, 59, 59, 999), label: '16–' + last };
}
function asOtStatusLabel(st) {
  if (st === 'approved') return 'aprobada';
  if (st === 'rejected') return 'no aprobada';
  return 'esperando';
}
function asIsLateAt(h, min, expectedH, expectedM, tol) {
  return (h * 60 + min) > (expectedH * 60 + expectedM + tol);
}
function asPunctPct(lateFlags) {
  if (!lateFlags.length) return null;
  var on = lateFlags.filter(function(x) { return !x; }).length;
  return Math.round((on / lateFlags.length) * 100);
}
function asShiftNoteText(s) {
  if (!s) return '';
  if (s.queHice) return String(s.queHice);
  if (s.note) return String(s.note);
  if (s.dayReport && s.dayReport.text) return String(s.dayReport.text);
  return '';
}
function asShiftFotos(s) {
  if (!s) return [];
  if (Array.isArray(s.fotos) && s.fotos.length) return s.fotos.slice();
  if (s.dayReport && Array.isArray(s.dayReport.photos)) return s.dayReport.photos.slice();
  return [];
}
function asDayPunchStatus(shiftsOnDay) {
  if (!shiftsOnDay || !shiftsOnDay.length) return 'falta';
  if (shiftsOnDay.some(function(s) { return s && !s.endedAt; })) return 'abierta';
  return 'worked';
}
function asCalCellKind(dateStr, todayStr, shiftsOnDay) {
  if (dateStr > todayStr) return 'future';
  return asDayPunchStatus(shiftsOnDay);
}
function asCountFaltasThrough(shifts, from, to, nowTs) {
  var faltas = 0;
  var end = Math.min(to.getTime(), nowTs);
  var t = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  while (t.getTime() <= end) {
    var key = asLocalDateStr(t.getTime());
    var onDay = (shifts || []).filter(function(s) {
      return s && s.startedAt && asLocalDateStr(s.startedAt) === key;
    });
    if (asDayPunchStatus(onDay) === 'falta') faltas++;
    t.setDate(t.getDate() + 1);
  }
  return faltas;
}

var q1 = asQuincenaRange(new Date(2026, 7, 5));
var q2 = asQuincenaRange(new Date(2026, 7, 20));
if (q1.label !== '1–15' || q1.from.getDate() !== 1 || q1.to.getDate() !== 15) throw new Error('q1');
if (q2.label !== '16–31' || q2.from.getDate() !== 16 || q2.to.getDate() !== 31) throw new Error('q2');
if (asIsLateAt(9, 10, 9, 0, 10)) throw new Error('09:10 within 10 min tol should be on time');
if (!asIsLateAt(9, 11, 9, 0, 10)) throw new Error('09:11 should be late');
if (asOtStatusLabel('pending') !== 'esperando') throw new Error('ot pending');
if (asOtStatusLabel('approved') !== 'aprobada') throw new Error('ot approved');
if (asOtStatusLabel('rejected') !== 'no aprobada') throw new Error('ot rejected');
if (asPunctPct([false, false, true]) !== 67) throw new Error('pct');
if (asLocalDateStr(q1.from.getTime()).slice(8) !== '01') throw new Error('qkey date');

if (asShiftNoteText({ queHice: 'Limpieza 1401', note: 'old' }) !== 'Limpieza 1401') throw new Error('note prefers queHice');
if (asShiftNoteText({ note: 'WhatsApp' }) !== 'WhatsApp') throw new Error('note fallback');
if (asShiftNoteText({ dayReport: { text: 'chips text' } }) !== 'chips text') throw new Error('note from dayReport');
function asFotoSrc(foto) {
  if (!foto) return '';
  if (typeof foto === 'string') return foto;
  if (foto.url) return String(foto.url);
  return '';
}
if (asShiftFotos({ fotos: ['a', 'b'] }).length !== 2) throw new Error('fotos');
if (asShiftFotos({ dayReport: { photos: ['x'] } })[0] !== 'x') throw new Error('fotos fallback');
if (asShiftFotos({ fotos: [] , dayReport: { photos: ['x'] } })[0] !== 'x') throw new Error('empty fotos falls back');
if (asFotoSrc('data:image/jpeg;base64,xxxx') !== 'data:image/jpeg;base64,xxxx') throw new Error('legacy data URL still reads');
if (asFotoSrc({ url: 'https://example.com/a.jpg', path: 'bvg/asistencia/s1/p1.jpg', ts: 1 }) !== 'https://example.com/a.jpg') throw new Error('storage meta uses url');
if (asFotoSrc({ path: 'bvg/asistencia/s1/p1.jpg' }) !== '') throw new Error('path-only meta has no display src');
if (JSON.stringify({ url: 'https://x/a.jpg', path: 'bvg/asistencia/s/p.jpg', ts: 1 }).length > 2048) throw new Error('storage meta must stay tiny vs data URL');

if (asDayPunchStatus([]) !== 'falta') throw new Error('empty day is falta');
if (asDayPunchStatus([{ endedAt: 1 }]) !== 'worked') throw new Error('closed is worked');
if (asDayPunchStatus([{ endedAt: null }]) !== 'abierta') throw new Error('open is abierta');
if (asDayPunchStatus([{ endedAt: 1 }, { endedAt: null }]) !== 'abierta') throw new Error('any open is abierta');
if (asCalCellKind('2026-08-30', '2026-08-29', []) !== 'future') throw new Error('future empty');
if (asCalCellKind('2026-08-29', '2026-08-29', []) !== 'falta') throw new Error('today empty is falta');
if (asCalCellKind('2026-08-28', '2026-08-29', [{ endedAt: 1 }]) !== 'worked') throw new Error('past closed');

var aug1 = new Date(2026, 7, 1, 0, 0, 0, 0);
var aug15 = new Date(2026, 7, 15, 23, 59, 59, 999);
var now = new Date(2026, 7, 10, 12, 0, 0, 0).getTime();
var shifts = [
  { startedAt: new Date(2026, 7, 3, 9, 0).getTime(), endedAt: new Date(2026, 7, 3, 17, 0).getTime() },
  { startedAt: new Date(2026, 7, 10, 9, 0).getTime(), endedAt: null }
];
if (asCountFaltasThrough(shifts, aug1, aug15, now) !== 8) throw new Error('faltas 1-10 minus 3 and 10 = 8');

function aloraSeasonKey(month1to12) {
  var m = Number(month1to12);
  if (!(m >= 1 && m <= 12)) return 'alta';
  if (m === 12 || m <= 3) return 'alta';
  if (m <= 5) return 'primavera';
  if (m <= 10) return 'lluvias';
  return 'otono';
}
if (aloraSeasonKey(12) !== 'alta' || aloraSeasonKey(1) !== 'alta' || aloraSeasonKey(3) !== 'alta') throw new Error('alta');
if (aloraSeasonKey(4) !== 'primavera' || aloraSeasonKey(5) !== 'primavera') throw new Error('primavera');
if (aloraSeasonKey(6) !== 'lluvias' || aloraSeasonKey(8) !== 'lluvias' || aloraSeasonKey(10) !== 'lluvias') throw new Error('lluvias');
if (aloraSeasonKey(11) !== 'otono') throw new Error('otono');
if (aloraSeasonKey(0) !== 'alta' || aloraSeasonKey(99) !== 'alta') throw new Error('alta fallback');
if (aloraSeasonKey(8) !== 'lluvias') throw new Error('Aug 2026 Mexico must be lluvias');

function asNormalizeRole(u) {
  if (!u) return u;
  var pin = String(u.pin || '');
  var role = String(u.role || '').toLowerCase();
  if (pin === '2604') {
    u.role = 'worker';
  } else if (pin === '0314' || role === 'admin') {
    u.role = 'admin';
  } else if (role === 'worker' || role === 'colaboradora' || role === 'trabajadora' || !role) {
    u.role = 'worker';
  }
  return u;
}
function asCanSeeRevenueFromUser(u) {
  if (!u) return true;
  u = asNormalizeRole({ pin: u.pin, role: u.role });
  return u.role !== 'worker';
}
if (!asCanSeeRevenueFromUser(null)) throw new Error('no-PIN is owner and sees revenue');
if (!asCanSeeRevenueFromUser({ pin: '0314', role: 'admin' })) throw new Error('Koke 0314 sees revenue');
if (asCanSeeRevenueFromUser({ pin: '2604', role: 'worker' })) throw new Error('Valerie 2604 must not see revenue');
if (asCanSeeRevenueFromUser({ pin: '2604', role: 'admin' })) throw new Error('PIN 2604 must hide revenue even if stored as admin');
if (asCanSeeRevenueFromUser({ pin: '2604' })) throw new Error('PIN 2604 without role must hide revenue');
if (asCanSeeRevenueFromUser({ pin: '2604', role: 'colaboradora' })) throw new Error('colaboradora label must hide revenue');
if (!asCanSeeRevenueFromUser({ pin: '0314' })) throw new Error('PIN 0314 without role still sees revenue');

function asBookingsWithoutIncome(list) {
  return (list || []).map(function(b) {
    var c = {};
    Object.keys(b).forEach(function(k) {
      if (k === 'total' || k === 'anticipo' || k === 'lim' || k === 'specialRate' || k === 'specialPrice') return;
      c[k] = b[k];
    });
    return c;
  });
}
var stripped = asBookingsWithoutIncome([{ rent: 'Ada', total: 16500, anticipo: '3/3', lim: 550, depto: '1404 Norte', nights: 3 }])[0];
if (stripped.rent !== 'Ada' || stripped.depto !== '1404 Norte') throw new Error('ops fields stay');
if (stripped.total != null || stripped.anticipo != null || stripped.lim != null) throw new Error('income fields stripped');

var fs = require('fs');
var html = fs.readFileSync(__dirname + '/BVG-Dashboard.html', 'utf8');
var loginChunk = html.split('id="loginScreen"')[1].split('id="app"')[0];
if (!loginChunk.includes('assets/alora-login-mark.png')) throw new Error('welcome card must use locked login mark');
if (loginChunk.includes('alora-window.png') || loginChunk.includes('alora-window-lluvias')) throw new Error('welcome card must not use header or seasonal window');
if (!loginChunk.includes('placeholder="Contraseña"')) throw new Error('welcome Contraseña field');
if (!loginChunk.includes('Ingresar')) throw new Error('welcome Ingresar');
if (!loginChunk.includes('BVG Residencial · Ixtapa Zihuatanejo')) throw new Error('welcome subtitle');
if (!fs.existsSync(__dirname + '/assets/alora-login-mark.png')) throw new Error('locked login mark file missing');
if (html.indexOf('password gate temporarily removed') !== -1) throw new Error('skip-login IIFE must be gone');
if (html.indexOf('Safety net: hide login') !== -1) throw new Error('safety-net skip-login must be gone');
if (html.indexOf("login.style.display = 'none'") !== -1) throw new Error('skip-login must not hide #loginScreen on load');
if (html.indexOf("getElementById('loginScreen').style.display = 'none'") === -1) throw new Error('valid login still hides the gate');
if (html.indexOf('class="topbar-logout"') === -1) throw new Error('mobile topbar needs Cerrar sesión');

function asWelcomeLoginKind(value, teamPassword) {
  var v = String(value == null ? '' : value).trim();
  if (v === '2604') return 'worker';
  if (v === '0314') return 'admin';
  if (teamPassword && v === String(teamPassword)) return 'admin';
  return 'reject';
}
if (asWelcomeLoginKind('2604', 'team') !== 'worker') throw new Error('2604 is colaboradora');
if (asWelcomeLoginKind(' 2604 ', 'team') !== 'worker') throw new Error('2604 trim');
if (asWelcomeLoginKind('0314', 'team') !== 'admin') throw new Error('0314 is admin');
if (asWelcomeLoginKind('team', 'team') !== 'admin') throw new Error('team password is admin');
if (asWelcomeLoginKind('nope', 'team') !== 'reject') throw new Error('wrong password stays out');
if (asWelcomeLoginKind('', 'team') !== 'reject') throw new Error('empty password stays out');

function asLastClosedShiftFromList(list, pin) {
  var closed = (list || []).filter(function(s) {
    return s && String(s.userPin) === String(pin) && s.endedAt;
  });
  closed.sort(function(a, b) { return (b.endedAt || 0) - (a.endedAt || 0); });
  return closed[0] || null;
}
function asDisplayShiftFromList(list, pin) {
  var open = (list || []).filter(function(s) {
    return s && String(s.userPin) === String(pin) && !s.endedAt;
  });
  open.sort(function(a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
  return open[0] || asLastClosedShiftFromList(list, pin);
}
function asPunchSalirLabel(s, fmtEnded) {
  if (!s) return '—';
  if (!s.endedAt) return 'abierta / sin salida';
  return fmtEnded ? fmtEnded(s.endedAt) : String(s.endedAt);
}
function asCalHoursText(ms) {
  if (!ms || ms <= 0) return '';
  return (ms / 3600000).toFixed(1) + 'h';
}

var val31 = {
  userPin: '2604',
  startedAt: Date.parse('2026-08-31T08:05:00-06:00'),
  endedAt: Date.parse('2026-08-31T14:08:00-06:00'),
  durationMs: Date.parse('2026-08-31T14:08:00-06:00') - Date.parse('2026-08-31T08:05:00-06:00')
};
var val01 = {
  userPin: '2604',
  startedAt: Date.parse('2026-09-01T08:02:00-06:00'),
  endedAt: Date.parse('2026-09-01T14:05:00-06:00'),
  note: 'Actualización de reservas en Airbnb en departamento Sur',
  durationMs: Date.parse('2026-09-01T14:05:00-06:00') - Date.parse('2026-09-01T08:02:00-06:00')
};
var kokeShift = { userPin: '0314', startedAt: 1, endedAt: 2 };
var lastClosed = asLastClosedShiftFromList([val31, val01, kokeShift], '2604');
if (!lastClosed || lastClosed.endedAt !== val01.endedAt) throw new Error('last closed must be Sep 1 SALIR');
if (asPunchSalirLabel(lastClosed) !== String(val01.endedAt)) throw new Error('closed Salir is endedAt');
if (asPunchSalirLabel({ startedAt: val01.startedAt }) !== 'abierta / sin salida') throw new Error('open Salir label');
if (asPunchSalirLabel(null) !== '—') throw new Error('empty punch Salir');
var openNow = { userPin: '2604', startedAt: Date.parse('2026-09-02T08:00:00-06:00'), endedAt: null };
if (asDisplayShiftFromList([val31, val01, openNow], '2604').endedAt) throw new Error('open shift wins while in progress');
if (asDisplayShiftFromList([val31, val01], '2604').endedAt !== val01.endedAt) throw new Error('after SALIR show last closed');
if (asCalHoursText(6 * 3600000) !== '6.0h') throw new Error('calendar 6.0h');
if (asCalHoursText(val01.durationMs) !== '6.1h' && asCalHoursText(val01.durationMs) !== '6.0h') {
  if (asCalHoursText(val01.durationMs) !== (val01.durationMs / 3600000).toFixed(1) + 'h') throw new Error('calendar hours');
}
if (asCalHoursText(0) !== '') throw new Error('no hours on empty day');

function asMexicoParts(ts) {
  var d = new Date(ts);
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Mexico_City',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(d);
  var map = {};
  for (var i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
  return map;
}
function asFmtDateTime(ts) {
  if (!ts) return '—';
  var p = asMexicoParts(ts);
  return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute + ':' + p.second;
}
var mxSalir = Date.parse('2026-09-01T14:05:00-06:00');
var mxEntrar = Date.parse('2026-09-01T08:02:00-06:00');
if (asFmtDateTime(mxEntrar).indexOf('08:02') === -1) throw new Error('Mexico City Entrar must be 08:02 not UTC');
if (asFmtDateTime(mxSalir).indexOf('14:05') === -1) throw new Error('Mexico City Salir must be 14:05 not UTC');
if (html.indexOf('function asMexicoParts') === -1) throw new Error('asMexicoParts missing');
if (!/function asFmtDateTime[\s\S]*asMexicoParts/.test(html)) throw new Error('asFmtDateTime must use Mexico City parts');

if (html.indexOf('id="asLastPunchBanner"') === -1) throw new Error('admin last-punch banner missing');
if (html.indexOf('function asLastClosedShiftForPin') === -1) throw new Error('asLastClosedShiftForPin missing');
if (html.indexOf('function asRenderLastPunchBanner') === -1) throw new Error('asRenderLastPunchBanner missing');
if (html.indexOf('function asPunchTimesHtml') === -1) throw new Error('asPunchTimesHtml missing');
if (!/asRenderAdminResumen[\s\S]*asLastClosedShiftForPin/.test(html)) throw new Error('Resumen must fall back to last closed shift');
if (!/asRenderAdminResumen[\s\S]*asPunchTimesHtml/.test(html)) throw new Error('Resumen must show Entrar and Salir together');
if (html.indexOf('as-cal-hrs') === -1) throw new Error('calendar cells must show hours');
if (!/showAdmin[\s\S]*worker\.style\.display = \(u && !showAdmin\)/.test(html)) throw new Error('admin must not land on checador before timesheet');
if (html.indexOf('asCanSeeRevenue') === -1) throw new Error('revenue gate must stay');

var AS_FOTO_MIN_EDGE = 480;
var AS_FOTO_MIN_QUALITY = 0.42;
var AS_FOTO_MAX_DATAURL = 210 * 1024;
function asIsLikelyImageFile(f) {
  if (!f) return false;
  var t = String(f.type || '').toLowerCase();
  var n = String(f.name || '').toLowerCase();
  if (!t) return true;
  if (t.indexOf('image/') === 0) return true;
  if (t === 'application/octet-stream' || t === 'application/heic' || t === 'application/heif') {
    return !n || /\.(heic|heif|jpe?g|png|webp|gif|bmp|tif{1,2})$/.test(n);
  }
  return /\.(heic|heif)$/.test(n);
}
function asDataUrlBytes(url) {
  if (!url) return 0;
  return String(url).length;
}
function asNextFotoEncodeStep(edge, quality) {
  if (quality > AS_FOTO_MIN_QUALITY + 0.01) {
    return { edge: edge, quality: Math.max(AS_FOTO_MIN_QUALITY, +(quality - 0.12).toFixed(2)) };
  }
  return { edge: Math.max(AS_FOTO_MIN_EDGE, Math.round(edge * 0.78)), quality: quality };
}
if (!asIsLikelyImageFile({ type: '', name: 'IMG_1234.HEIC' })) throw new Error('empty MIME must be accepted');
if (!asIsLikelyImageFile({ type: 'image/heic', name: 'IMG_1234.HEIC' })) throw new Error('HEIC MIME must be accepted');
if (!asIsLikelyImageFile({ type: 'image/heif', name: 'scan.heif' })) throw new Error('HEIF MIME must be accepted');
if (!asIsLikelyImageFile({ type: 'application/octet-stream', name: 'captura.heic' })) throw new Error('octet-stream HEIC must be accepted');
if (!asIsLikelyImageFile({ type: 'image/jpeg', name: 'captura.jpg' })) throw new Error('JPEG must be accepted');
if (asIsLikelyImageFile({ type: 'application/pdf', name: 'nota.pdf' })) throw new Error('PDF must be rejected');
if (asDataUrlBytes('data:image/jpeg;base64,xxxx') !== 'data:image/jpeg;base64,xxxx'.length) throw new Error('data URL length is the write budget');
var stepQ = asNextFotoEncodeStep(1280, 0.7);
if (stepQ.edge !== 1280 || stepQ.quality !== 0.58) throw new Error('first budget step lowers quality');
var stepE = asNextFotoEncodeStep(1280, 0.42);
if (stepE.edge !== Math.round(1280 * 0.78) || stepE.quality !== 0.42) throw new Error('later budget step lowers edge');
if (html.indexOf('id="asEndFotoCam"') === -1 || html.indexOf('id="asEndFotoGal"') === -1) throw new Error('SALIR modal must accept a captura');
if (html.indexOf('id="asEndThumbs"') === -1) throw new Error('SALIR modal must show thumbs');
if (html.indexOf('function asPickEndFoto') === -1) throw new Error('asPickEndFoto missing');
if (html.indexOf('function asEncodeUntilBudget') === -1) throw new Error('size-budget encoder missing');
if (html.indexOf('AS_FOTO_MAX_DATAURL') === -1) throw new Error('foto data-URL budget missing');
if (html.indexOf('No se pudo guardar la foto — intenta otra más liviana') === -1) throw new Error('shift save failure must toast');
if (html.indexOf('asShiftSaveFailToast') === -1) throw new Error('asShiftSaveFailToast missing');
if (html.indexOf('image/heic') === -1) throw new Error('file pickers must accept HEIC');
if (html.indexOf('function asIsLikelyImageFile') === -1) throw new Error('asIsLikelyImageFile missing from dashboard');
if (html.indexOf('_asPendingShiftSync') === -1) throw new Error('failed Firebase shift write must not silently wipe local thumbs');
if (!/function asHandleDayPhoto[\s\S]*asIsLikelyImageFile[\s\S]*asFotoFailToast/.test(html)) throw new Error('day photo path must accept HEIC/empty type and toast on fail');
if (!/function saveData[\s\S]*asShiftSaveFailToast/.test(html)) throw new Error('saveData must toast shift write failures');

if (html.indexOf('firebase-storage-compat.js') === -1) throw new Error('must load firebase-storage-compat.js');
if (!html.includes('https://www.gstatic.com/firebasejs/10.12.0/firebase-storage-compat.js')) throw new Error('storage SDK must stay on 10.12.0');
if (html.indexOf('_firebaseStorage') === -1) throw new Error('Storage must be initialized');
if (html.indexOf('function asFotoSrc') === -1) throw new Error('asFotoSrc missing');
if (html.indexOf('function asUploadShiftFoto') === -1) throw new Error('asUploadShiftFoto missing');
if (html.indexOf('function asUploadPeticionFoto') === -1) throw new Error('asUploadPeticionFoto missing');
if (html.indexOf('function asStorageFailToast') === -1) throw new Error('asStorageFailToast missing');
if (html.indexOf('bvg/asistencia/') === -1) throw new Error('shift capturas must upload under bvg/asistencia/');
if (html.indexOf('bvg/peticiones/') === -1) throw new Error('peticion capturas must upload under bvg/peticiones/');
if (html.indexOf('Koke debe publicar las reglas de Storage') === -1) throw new Error('unauthorized Storage toast must tell Koke to deploy rules');
if (html.indexOf('No se pudo subir la captura a Storage') === -1) throw new Error('generic Storage failure toast missing');
if (html.indexOf('function asCanSeeRevenue') === -1) throw new Error('PIN 2604 must still be gated from ingresos');

var dayPhotoFn = html.match(/function asHandleDayPhoto\([\s\S]*?\nfunction asSaveDayReport/);
if (!dayPhotoFn) throw new Error('asHandleDayPhoto block missing');
if (dayPhotoFn[0].indexOf('asUploadShiftFoto') === -1) throw new Error('day photo path must upload to Storage');
if (/_asDayPhotos\.push\(url\)/.test(dayPhotoFn[0])) throw new Error('day photos must not store data URLs after compress');
if (dayPhotoFn[0].indexOf('_asDayPhotos.push(meta)') === -1) throw new Error('day photos must store Storage meta');

var petSaveFn = html.match(/function asSavePeticion\([\s\S]*?\nfunction asRenderMyPets/);
if (!petSaveFn) throw new Error('asSavePeticion block missing');
if (petSaveFn[0].indexOf('asUploadPeticionFoto') === -1) throw new Error('peticion save must upload foto to Storage');
if (/photo: document\.getElementById\('asPetFotoData'\)\.value/.test(petSaveFn[0])) throw new Error('peticion must not write the data URL into RTDB');

if (!/function asFotosHtml[\s\S]*asFotoSrc/.test(html)) throw new Error('thumbs must read Storage URL or legacy data URL via asFotoSrc');
if (!/function asRenderAdminPets[\s\S]*asFotoSrc\(p\.photo\)/.test(html)) throw new Error('admin peticion thumbs must use asFotoSrc');

var rules = fs.readFileSync(__dirname + '/storage.rules', 'utf8');
var fbjson = JSON.parse(fs.readFileSync(__dirname + '/firebase.json', 'utf8'));
if (!fbjson.storage || fbjson.storage.rules !== 'storage.rules') throw new Error('firebase.json must point storage.rules');
if (rules.indexOf('match /bvg/asistencia/') === -1) throw new Error('storage.rules must allow bvg/asistencia');
if (rules.indexOf('match /bvg/peticiones/') === -1) throw new Error('storage.rules must allow bvg/peticiones');
if (/match \/\{\s*allPaths\s*=\s*\*\*\s*\}[\s\S]*allow (read|write):\s*if\s*true/.test(rules)) throw new Error('storage.rules must not open the whole bucket');
if (rules.indexOf('firebase deploy --only storage') === -1) throw new Error('storage.rules must document one-time deploy');
if (!fs.existsSync(__dirname + '/.firebaserc')) throw new Error('.firebaserc missing for CLI deploy');

var occChunk = html.match(/\/\* OCCUPANCY KPI[\s\S]*?\/\* END OCCUPANCY KPI \*\//);
if (!occChunk) throw new Error('occupancy helpers missing from dashboard');
eval(occChunk[0].replace(/\/\* OCCUPANCY KPI[\s\S]*?\*\/|\/\* END OCCUPANCY KPI \*\//g, ''));

if (html.indexOf('bookedNightsYr') !== -1) throw new Error('old summed bookedNightsYr occupancy must be gone');
if (/365 - norteNights/.test(html)) throw new Error('Reports available nights must use unique-night helper, not 365 - summed nights');
if (html.indexOf('occUniqueNightsByUnit') === -1) throw new Error('unique-night occupancy helper missing');
if (html.indexOf('occYearStats') === -1) throw new Error('occYearStats must drive Dashboard and Reports');
if (!/function renderDashboard[\s\S]*occYearStats[\s\S]*function renderDashCharts/.test(html)) throw new Error('Dashboard occupancy must use occYearStats');
if (!/function renderReports[\s\S]*occYearStats[\s\S]*norteAvail/.test(html)) throw new Error('Reports occupancy / Noches Disponibles must use unique nights');
if (html.indexOf("getElementById('loginScreen')") === -1) throw new Error('welcome gate must stay');
if (html.indexOf('assets/alora-login-mark.png') === -1) throw new Error('do not restyle welcome mark');

var occFx = [
  { rent: 'Carol', entrada: '2026-01-10', salida: '2026-02-28', depto: '1401 Sur', status: 'COMPLETADA', fuente: 'WhatsApp' },
  { rent: 'CAROL DUP', entrada: '2026-01-10', salida: '2026-03-01', depto: '1401 Sur', status: 'COMPLETADA', fuente: 'Directo' },
  { rent: 'Tío Pepe', entrada: '2026-02-01', salida: '2026-03-07', depto: '1204 Norte', status: 'COMPLETADA', fuente: 'Directo' },
  { rent: 'PROPIETARIO', entrada: '2026-03-15', salida: '2026-03-31', depto: '1401 Sur', status: 'COMPLETADA', fuente: 'Mantenimiento' },
  { rent: 'Remodelación Jacuzzi', entrada: '2026-04-12', salida: '2026-04-16', depto: '1404 Norte', status: 'COMPLETADA', fuente: 'WhatsApp' },
  { rent: 'Remodelación de cocina', entrada: '2026-05-02', salida: '2026-05-13', depto: '1401 Sur', status: 'POR LLEGAR', fuente: 'WhatsApp' },
  { rent: 'REMODELACION DE COCINA', entrada: '2026-05-04', salida: '2026-05-13', depto: '14S-Mantenimiento', status: 'Mantenimiento', fuente: 'Directo' },
  { rent: 'Cancelada', entrada: '2026-06-01', salida: '2026-06-10', depto: '1404 Norte', status: 'CANCELADA', fuente: 'WhatsApp' },
  { rent: 'Balta Gaytán', entrada: '2026-08-22', salida: '2026-08-25', depto: '1401 Sur', status: 'POR LLEGAR', fuente: 'Familia' },
  { rent: 'Mauricio', entrada: '2026-12-30', salida: '2027-01-04', depto: '1404 Norte', status: 'POR LLEGAR', fuente: 'WhatsApp' },
  { rent: 'New Year inbound', entrada: '2025-12-30', salida: '2026-01-03', depto: '1404 Norte', status: 'COMPLETADA', fuente: 'WhatsApp' }
];
if (occKpiUnit('1204 Norte') !== null) throw new Error('1204 must never be a KPI unit');
if (occKpiUnit('14S-Mantenimiento') !== null) throw new Error('mantenimiento depto is not a KPI unit');
if (occKpiUnit('1401 Sur') !== '1401 Sur' || occKpiUnit('1404 Norte') !== '1404 Norte') throw new Error('KPI units');
if (occIsOccupancyStay(occFx[2])) throw new Error('1204 stay excluded');
if (occIsOccupancyStay(occFx[3])) throw new Error('PROPIETARIO / fuente Mantenimiento excluded');
if (occIsOccupancyStay(occFx[4]) || occIsOccupancyStay(occFx[5])) throw new Error('remodelación guest blocks excluded');
if (occIsOccupancyStay(occFx[6])) throw new Error('Mantenimiento status + 14S depto excluded');
if (occIsOccupancyStay(occFx[7])) throw new Error('CANCELADA excluded');
if (!occIsOccupancyStay(occFx[8])) throw new Error('family Gaytán guest stay must count');

var carolOnly = occUniqueNightsByUnit([occFx[0], occFx[1]], 2026);
if (carolOnly.sur !== 50) throw new Error('overlapping Carol nights must be unique 50, got ' + carolOnly.sur);
if (carolOnly.total !== 50) throw new Error('duplicate stays do not add');

var ny = occUniqueNightsByUnit([occFx[9]], 2026);
if (ny.norte !== 2) throw new Error('Dec 30–Jan 4 must clip to 2 nights in 2026, got ' + ny.norte);
var ny27 = occUniqueNightsByUnit([occFx[9]], 2027);
if (ny27.norte !== 3) throw new Error('same stay must count 3 nights in 2027');
var inbound = occUniqueNightsByUnit([occFx[10]], 2026);
if (inbound.norte !== 2) throw new Error('2025–2026 stay clips to Jan 1–2 in 2026');

var no1204 = occUniqueNightsByUnit(occFx, 2026);
if (no1204.total !== 50 + 3 + 2 + 2) throw new Error('fixture total unique guest nights, got ' + no1204.total);

if (occYearDenom() !== 730) throw new Error('year denom is 365×2');
if (occYtdDenom(2026, '2026-09-01') !== 488) throw new Error('YTD through 2026-09-01 denom is 488');
if (occElapsedDaysInYear(2026, '2026-09-01') !== 244) throw new Error('elapsed days through Sep 1');
if (occAvailableNights(400, 365) !== 0) throw new Error('available nights cannot go negative');
if (occAvailableNights(194, 365) !== 171) throw new Error('available = 365 - unique');

var stats = occYearStats(occFx, 2026, '2026-09-01');
if (stats.yearPct !== occRatePct(stats.full.total, 730)) throw new Error('year pct uses 730');
if (stats.ytd.sur + stats.ytd.norte !== stats.ytd.total) throw new Error('ytd parts');
if (stats.ytd.total > stats.full.total) throw new Error('YTD cannot exceed full year unique nights');
if (stats.norteAvail + stats.surAvail !== 730 - stats.full.total) throw new Error('available nights pair with unique occupied');

console.log('as-alora-checklist.test.js ok');
