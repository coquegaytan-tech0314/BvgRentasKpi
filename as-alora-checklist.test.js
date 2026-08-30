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
if (asShiftFotos({ fotos: ['a', 'b'] }).length !== 2) throw new Error('fotos');
if (asShiftFotos({ dayReport: { photos: ['x'] } })[0] !== 'x') throw new Error('fotos fallback');
if (asShiftFotos({ fotos: [] , dayReport: { photos: ['x'] } })[0] !== 'x') throw new Error('empty fotos falls back');

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

if (html.indexOf("var AS_ADMIN_TAB = 'turnos'") === -1) throw new Error('default admin tab must be turnos');
if (html.indexOf('class="as-tab active" data-as-tab="turnos"') === -1) throw new Error('Turnos tab must be the default active tab');
if (html.indexOf('class="as-tab active" data-as-tab="resumen"') !== -1) throw new Error('Resumen must not be the default active tab');
if (html.indexOf('asRenderAdminTurnos') === -1) throw new Error('timesheet renderer missing');
if (html.indexOf('class="as-sheet"') === -1) throw new Error('timesheet table class');
if (html.indexOf('<th>Colaboradora</th><th>Fecha</th><th>Entrar</th><th>Salir</th><th>Horas</th><th>Estado</th>') === -1) throw new Error('timesheet columns');
if (html.indexOf('as-cal-hrs') === -1) throw new Error('calendar cells must show hours');
if (html.indexOf('as-punch-row') === -1) throw new Error('resumen last punches');
if (html.indexOf('AS_WEEK_TARGET_H = 40') === -1) throw new Error('Valerie 40h weekly target');
if (html.indexOf('try { renderAsistencia(); } catch (e) {}') === -1) throw new Error('welcome admin session must refresh asistencia panel');
if (html.indexOf('id="asAdmin"') === -1 || html.indexOf('id="asAdmin"') > html.indexOf('id="asWorker"')) throw new Error('admin timesheet must render above the clock');

var css = fs.readFileSync(__dirname + '/styles.css', 'utf8');
if (css.indexOf('.as-sheet') === -1) throw new Error('timesheet css missing');
if (css.indexOf('.as-cal-hrs') === -1) throw new Error('calendar hours css missing');
if (css.indexOf('content: attr(data-label)') === -1) throw new Error('mobile stacked timesheet rows');

function asPauses(s) { return (s && Array.isArray(s.pauses)) ? s.pauses : []; }
function asIsPaused(s) {
  var p = asPauses(s);
  return p.length > 0 && !p[p.length - 1].endedAt;
}
function asPauseMs(s, until) {
  var endCap = until || Date.now();
  return asPauses(s).reduce(function(sum, p) {
    if (!p || !p.startedAt) return sum;
    var pe = p.endedAt || endCap;
    return sum + Math.max(0, pe - p.startedAt);
  }, 0);
}
function asWorkedMs(s, until) {
  if (!s || !s.startedAt) return 0;
  var end = s.endedAt || until || Date.now();
  return Math.max(0, end - s.startedAt - asPauseMs(s, end));
}
function asHoursLabel(ms) {
  return (Math.max(0, ms) / 3600000).toFixed(2) + 'h';
}
function asShiftEstado(s) {
  if (!s || s.endedAt) return { key: 'cerrado', label: 'cerrado', badge: 'badge-green' };
  if (asIsPaused(s)) return { key: 'pausa', label: 'pausa', badge: 'badge-orange' };
  return { key: 'curso', label: 'en curso', badge: 'badge-orange' };
}
function asWeekStart(d) {
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var day = x.getDay();
  var diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
var closed = { startedAt: new Date(2026, 7, 24, 9, 0).getTime(), endedAt: new Date(2026, 7, 24, 17, 30).getTime(), pauses: [{ startedAt: new Date(2026, 7, 24, 13, 0).getTime(), endedAt: new Date(2026, 7, 24, 14, 0).getTime() }] };
if (asHoursLabel(asWorkedMs(closed)) !== '7.50h') throw new Error('hours exclude 1h pause');
if (asShiftEstado(closed).label !== 'cerrado') throw new Error('closed estado');
if (asShiftEstado({ startedAt: 1, endedAt: null }).label !== 'en curso') throw new Error('open estado');
if (asShiftEstado({ startedAt: 1, endedAt: null, pauses: [{ startedAt: 2 }] }).label !== 'pausa') throw new Error('pause estado');
var mon = asWeekStart(new Date(2026, 7, 30));
if (mon.getDay() !== 1 || mon.getDate() !== 24) throw new Error('week is Mon-Sun starting 24 Aug 2026');
if (loginChunk.includes('as-sheet') || loginChunk.includes('asAdmin')) throw new Error('welcome card must stay isolated from admin timesheet');

console.log('as-alora-checklist.test.js ok');
