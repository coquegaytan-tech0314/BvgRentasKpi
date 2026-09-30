'use strict';
var fs = require('fs');
var path = require('path');

var html = fs.readFileSync(path.join(__dirname, 'BVG-Dashboard.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

var start = html.indexOf('/* FIREBASE_GUARD_START */');
var end = html.indexOf('function _migrateLocalToFirebase');
assert(start > 0 && end > start, 'firebase guard block missing');
var guardSrc = html.slice(start, end);

function loadGuard() {
  var factory = new Function(guardSrc + '\n' + [
    'var _firebaseHydrated = false;',
    'var _firebaseReady = true;',
    'var _firebaseKnownRaw = {};',
    'var _firebaseWriteQueue = [];',
    'var _firebaseSyncPaused = false;',
    'var _writes = [];',
    'var _toasts = [];',
    'var _store = {};',
    'var localStorage = {',
    '  getItem: function(k) { return _store[k] == null ? null : _store[k]; },',
    '  setItem: function(k, v) { _store[k] = String(v); }',
    '};',
    'var showToast = function(m) { _toasts.push(m); };',
    'var _firebaseDB = { ref: function(p) { return { set: function(raw) {',
    '  _writes.push({ path: p, raw: raw });',
    '  return Promise.resolve();',
    '} }; } };',
    'return {',
    '  queue: function(key, raw) { _queueOrWriteFirebase(key, raw, null, function(){}); },',
    '  flush: _flushFirebaseWriteQueue,',
    '  decision: _firebaseWriteDecision,',
    '  startup: _startupRemoteWins,',
    '  remember: _rememberFirebaseValue,',
    '  shrink: _firebaseShrinkViolation,',
    '  ignore: _shouldIgnoreShorterSnapshot,',
    '  single: _isSingleItemRemoval,',
    '  writes: _writes,',
    '  toasts: _toasts,',
    '  store: _store,',
    '  known: function() { return _firebaseKnownRaw; },',
    '  setHydrated: function(v) { _firebaseHydrated = v; },',
    '  queueLen: function() { return _firebaseWriteQueue.length; }',
    '};'
  ].join('\n'));
  return factory();
}

function bookings(n, prefix) {
  var list = [];
  for (var i = 0; i < n; i++) list.push({ id: i + 1, rent: prefix + ' ' + i, total: 1000 + i });
  return list;
}

var real = bookings(120, 'Real');
var samples = bookings(64, 'Sample');
var realRaw = JSON.stringify(real);
var sampleRaw = JSON.stringify(samples);

var api = loadGuard();
api.queue('bvg_bookings', sampleRaw);
assert(api.writes.length === 0, 'sample list must not be written before the first Firebase read');
assert(api.queueLen() === 1, 'pre-read write must wait in the queue');

var remote = {
  bvg_bookings: realRaw,
  bvg_expenses: JSON.stringify(bookings(40, 'Gasto')),
  bvg_receipts: JSON.stringify(bookings(15, 'Recibo')),
  bvg_shifts: JSON.stringify(bookings(8, 'Turno')),
  bvg_asistencia_clients: JSON.stringify(bookings(6, 'Cliente')),
  bvg_receipt_counter: '180'
};
var SYNC = ['bvg_bookings', 'bvg_expenses', 'bvg_receipts', 'bvg_shifts', 'bvg_asistencia_clients', 'bvg_receipt_counter'];
var apply = api.startup(remote, SYNC);
assert(apply.length === SYNC.length, 'startup applies every present remote key locally');
assert(!apply.some(function(item) { return item.raw === sampleRaw; }), 'startup must not upload the sample list');
apply.forEach(function(item) { api.remember(item.key, item.raw); });
api.setHydrated(true);
api.flush();
assert(api.writes.length === 0, 'queued sample write must be refused after the real snapshot is known');
assert(api.toasts.length === 1, 'refused shrink must toast');
assert(api.store.bvg_bookings === realRaw, 'local bookings must be restored to the last cloud snapshot');
assert(api.known().bvg_bookings === realRaw, 'known snapshot stays at the cloud list');

var oneLess = real.slice(1);
assert(api.single(real, oneLess) === true, 'dropping the first item is one deletion');
assert(api.shrink('bvg_bookings', JSON.stringify(oneLess), api.known()) == null, 'explicit single delete is allowed');
api.queue('bvg_bookings', JSON.stringify(oneLess));
assert(api.writes.length === 1, 'single delete may write');
assert(api.writes[0].path === 'bvg/bvg_bookings', 'write path stays under bvg/');

var sequential = loadGuard();
sequential.setHydrated(true);
sequential.remember('bvg_bookings', realRaw);
sequential.queue('bvg_bookings', JSON.stringify(real.slice(1)));
sequential.queue('bvg_bookings', JSON.stringify(real.slice(2)));
assert(sequential.writes.length === 2, 'two single deletes in a row must both reach Firebase');

var swapped = real.slice(2).concat([{ id: 9999, rent: 'Intruso', total: 1 }]);
assert(swapped.length === real.length - 1, 'fixture drops exactly one slot');
assert(api.shrink('bvg_bookings', JSON.stringify(swapped), { bvg_bookings: realRaw }) != null, 'a shorter list that is not a pure single delete is refused');

['bvg_expenses', 'bvg_shifts', 'bvg_asistencia_clients'].forEach(function(key) {
  var known = {};
  known[key] = remote[key];
  var short = JSON.stringify(bookings(1, 'x'));
  var why = api.shrink(key, short, known);
  assert(why, key + ' must refuse a large drop');
  var before = api.writes.length;
  api.remember(key, remote[key]);
  api.queue(key, short);
  assert(api.writes.length === before, key + ' large drop must not call set');
});
(function() {
  var short = JSON.stringify([{ id: 'solo', numero: 1, cliente: 'Nuevo' }]);
  var why = api.shrink('bvg_receipts', short, { bvg_receipts: remote.bvg_receipts });
  assert(why, 'receipt shrink helper still flags a raw short list');
  var before = api.writes.length;
  api.remember('bvg_receipts', remote.bvg_receipts);
  api.queue('bvg_receipts', short);
  var recWrites = api.writes.slice(before).filter(function(w) { return w.path === 'bvg/bvg_receipts'; });
  assert(recWrites.length === 1, 'a short receipt write is merged and then saved');
  var merged = JSON.parse(recWrites[0].raw);
  var cloud = JSON.parse(remote.bvg_receipts);
  assert(merged.length === cloud.length + 1, 'cloud receipts are kept when the local list is short');
  cloud.forEach(function(r) {
    assert(merged.some(function(m) { return m.id === r.id; }), 'receipt ' + r.id + ' missing after merge');
  });
})();

assert(api.shrink('bvg_receipt_counter', '33', { bvg_receipt_counter: '180' }) != null, 'counter must not go backwards');
assert(api.shrink('bvg_receipt_counter', '181', { bvg_receipt_counter: '180' }) == null, 'counter may increase');
var counterWrites = api.writes.length;
api.queue('bvg_receipt_counter', '33');
assert(api.writes.length === counterWrites, 'lower receipt counter must not be written');
api.queue('bvg_receipt_counter', '182');
assert(api.writes.length === counterWrites + 1, 'higher receipt counter may be written');

function cloudReceipts() {
  var list = [];
  for (var i = 1; i <= 10; i++) list.push({ id: 'r' + i, numero: 170 + i, cliente: 'Cliente ' + i });
  return list;
}
function receiptGuard() {
  var g = loadGuard();
  g.setHydrated(true);
  g.remember('bvg_receipts', JSON.stringify(cloudReceipts()));
  g.remember('bvg_receipt_counter', '180');
  return g;
}
function writtenLists(g, key) {
  return g.writes.filter(function(w) { return w.path === 'bvg/' + key; }).map(function(w) {
    try { return JSON.parse(w.raw); } catch (e) { return w.raw; }
  });
}
var emptyDevice = receiptGuard();
emptyDevice.queue('bvg_receipts', JSON.stringify([{ id: 'new', numero: 34, cliente: 'Nuevo' }]));
var emptyWrites = writtenLists(emptyDevice, 'bvg_receipts');
assert(emptyWrites.length === 1, 'empty local receipt cache still writes one merged list');
assert(emptyWrites[0].length === 11, 'merge keeps the 10 cloud receipts and appends the new one, got ' + emptyWrites[0].length);
assert(emptyWrites[0].some(function(r) { return r.id === 'new' && r.numero === 181; }), 'stale folio 34 is raised to 181');
for (var ri = 1; ri <= 10; ri++) {
  assert(emptyWrites[0].some(function(r) { return r.id === 'r' + ri; }), 'cloud receipt r' + ri + ' must survive an empty cache');
}
var counterWritesAfter = emptyDevice.writes.filter(function(w) { return w.path === 'bvg/bvg_receipt_counter'; });
assert(counterWritesAfter.length === 1 && counterWritesAfter[0].raw === '181', 'counter advances to 181 and does not stay at 34');

var stale = receiptGuard();
var staleIncoming = cloudReceipts().slice(0, 3).concat([{ id: 'new2', numero: 34, cliente: 'Otro' }]);
stale.queue('bvg_receipts', JSON.stringify(staleIncoming));
var staleWrites = writtenLists(stale, 'bvg_receipts');
assert(staleWrites.length === 1 && staleWrites[0].length === 11, 'stale cache is merged, not written over the cloud list');
assert(staleWrites[0].some(function(r) { return r.id === 'new2' && r.numero === 181; }), 'stale cache folio is raised');

var again = receiptGuard();
again.queue('bvg_receipts', JSON.stringify([{ id: 'new', numero: 34, cliente: 'Nuevo' }]));
var mergedOnce = writtenLists(again, 'bvg_receipts')[0];
var beforeSecond = again.writes.length;
again.queue('bvg_receipts', JSON.stringify(mergedOnce));
var mergedTwice = writtenLists(again, 'bvg_receipts').pop();
assert(mergedTwice.length === 11, 'second save does not duplicate cloud receipts');
assert(mergedTwice.filter(function(r) { return r.id === 'new'; })[0].numero === 181, 'folio is not bumped twice');
assert(again.writes.filter(function(w) { return w.path === 'bvg/bvg_receipt_counter' && w.raw !== '181'; }).length === 0, 'counter is not raised past 181 on the idempotent save');
assert(again.writes.length >= beforeSecond, 'idempotent save still completes');

var del = receiptGuard();
del.queue('bvg_receipts', JSON.stringify(cloudReceipts().slice(1)));
var deleted = writtenLists(del, 'bvg_receipts');
assert(deleted.length === 1 && deleted[0].length === 9, 'explicit single receipt delete still writes');
assert(!deleted[0].some(function(r) { return r.id === 'r1'; }), 'the deleted receipt is the one removed');
assert(del.writes.filter(function(w) { return w.path === 'bvg/bvg_receipt_counter'; }).length === 0, 'a delete must not move the counter');

var rewind = receiptGuard();
rewind.queue('bvg_receipt_counter', '34');
assert(rewind.writes.filter(function(w) { return w.path === 'bvg/bvg_receipt_counter'; }).length === 0, 'setReceiptCounter(34) must not rewind Firebase');
assert(rewind.store.bvg_receipt_counter === '180', 'local counter stays on the cloud value');

var saveFn = html.match(/function saveReceiptToHistory\(\) \{[\s\S]*?\nfunction renderReceiptHistory/);
assert(saveFn && saveFn[0].indexOf('getReceipts()') !== -1, 'PR 16 still reads receipts via getReceipts');
assert(saveFn[0].indexOf('saveReceipts(receipts)') !== -1, 'PR 16 still saves through saveReceipts');
assert(saveFn[0].indexOf('setReceiptCounter(numero)') !== -1, 'PR 16 still updates the counter through setReceiptCounter');

assert(api.ignore('bvg_bookings', sampleRaw, { bvg_bookings: realRaw }) === true, 'a much shorter snapshot must be ignored');
assert(api.ignore('bvg_bookings', JSON.stringify(oneLess), { bvg_bookings: realRaw }) === false, 'a one-item remote delete must still apply');
assert(api.decision('bvg_bookings', sampleRaw, { hydrated: false, knownRaw: {} }).action === 'queue', 'unhydrated write is queued');
assert(api.decision('bvg_bookings', sampleRaw, { hydrated: true, knownRaw: { bvg_bookings: realRaw } }).action === 'refuse', 'hydrated sample replace is refused');

var emptyLocalRemote = api.startup({ bvg_bookings: realRaw }, ['bvg_bookings', 'bvg_expenses']);
assert(emptyLocalRemote.length === 1 && emptyLocalRemote[0].key === 'bvg_bookings', 'missing remote keys are not invented from local state');

var migStart = html.indexOf('function _migrateLocalToFirebase');
var migEnd = html.indexOf('// Debounced view refresh');
var mig = html.slice(migStart, migEnd);
assert(mig.indexOf('.set(') === -1 && mig.indexOf('.update(') === -1, 'first read must not write to Firebase');
assert(mig.indexOf('_startupRemoteWins') !== -1, 'first read must copy remote onto local');
assert(mig.indexOf('_firebaseHydrated = true') !== -1, 'hydration flips only after the read');
assert(html.indexOf("if (local && !remote)") === -1, 'startup must not upload local data when a remote key is missing');

assert(/function initSampleData\(\) \{[\s\S]*?if \(_firebaseReady\) return;/.test(html), 'sample seed must return immediately when Firebase is configured');
assert(/function initApp\(\) \{[\s\S]*?if \(!_firebaseReady\) initSampleData\(\);/.test(html), 'initApp must not seed on the production path');
assert(html.indexOf('_queueOrWriteFirebase') !== -1, 'cloud writes go through the queue');
assert(html.indexOf("ref('bvg/' + key).set(raw)") !== -1, 'the guarded writer still uses one set()');

function runSeed(firebaseReady) {
  var calls = [];
  var runner = new Function('getBookings', 'getSettings', 'saveSettings', 'saveData', 'saveTasks', 'record', [
    'var _firebaseReady = ' + (firebaseReady ? 'true' : 'false') + ';',
    'var STORAGE_KEYS = { bookings: "bvg_bookings", expenses: "bvg_expenses", tasks: "bvg_tasks", settings: "bvg_settings" };',
    html.slice(html.indexOf('function initSampleData'), html.indexOf('function asWelcomeLoginKind')),
    'initSampleData();'
  ].join('\n'));
  runner(
    function() { return []; },
    function() { return { specialPrices: [] }; },
    function() { calls.push('settings'); },
    function(key, data) { calls.push(key + ':' + (Array.isArray(data) ? data.length : typeof data)); },
    function(tasks) { calls.push('tasks:' + tasks.length); }
  );
  return calls;
}

var blocked = runSeed(true);
assert(blocked.length === 0, 'configured Firebase must not seed sample bookings, got ' + blocked.join(','));
var demo = runSeed(false);
assert(demo.some(function(c) { return c.indexOf('bvg_bookings:') === 0; }), 'offline demo may still seed locally');
assert(demo.some(function(c) { return c.indexOf('bvg_expenses:') === 0; }), 'offline demo seeds expenses only locally');
var bookingCall = demo.filter(function(c) { return c.indexOf('bvg_bookings:') === 0; })[0];
assert(bookingCall === 'bvg_bookings:64', 'hard-coded sample list is 64 bookings, got ' + bookingCall);

if (!/function saveData[\s\S]*asShiftSaveFailToast/.test(html)) {
  throw new Error('saveData must still toast shift write failures');
}

console.log('firebase-sync-guard.test.js ok');
