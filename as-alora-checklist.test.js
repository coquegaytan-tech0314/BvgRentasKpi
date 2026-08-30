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

console.log('as-alora-checklist.test.js ok');
