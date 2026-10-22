const assert = require('node:assert/strict');
const vm = require('node:vm');
const { clone, loadRelease, sheet, valuesRow, workbook } = require('./fixtures/native-arrival/identity-priority-fixture.cjs');

const tests = [], failures = [];
function test(name, run) {
  try { run(); tests.push(name); }
  catch (error) { failures.push({ name, error: error.stack }); }
}
function record(values = {}) {
  return { row: 2, meaningful: true, account: 'GOS Beauty', phone: '10000001',
    customerKey: 'GOS Beauty|p:10000001', name: 'Synthetic', brand: 'GOS Beauty',
    status: '待跟進', date: '', time: '', confirmedAt: '', leadId: '', appointmentId: '',
    bookedAt: '', outcome: '', outcomeAt: '', pendingSnapshot: '', ...values };
}
function appointment(values = {}) {
  return { id: 'appt_existing', leadId: 'lead_existing', account: 'GOS Beauty',
    customerKey: 'GOS Beauty|p:10000001', phone: '10000001', queueId: 'queue_existing',
    state: 'active', outcome: '', date: '2026-10-24', time: '14:00',
    provenance: 'legacy_registration_unknown', revision: 1, ...values };
}
function resolve(r = record(), evidence = {}) {
  const fixture = loadRelease(); let allocations = 0;
  const result = fixture.box.oa2ResolveMissingLeadIdentity_(r,
    { appointments: {}, owners: {}, knownLeadIds: new Set(), ...evidence },
    () => { allocations++; return 'lead_synthetic-new'; });
  return { result, allocations };
}

test('new enquiry receives one durable ID without inventing appointment ownership', () => {
  const { result, allocations } = resolve();
  assert.equal(result.action, 'create'); assert.equal(result.leadId, 'lead_synthetic-new');
  assert.equal(allocations, 1); assert.equal(result.appointmentId || '', '');
});
test('existing ID is retained and no replacement UUID is allocated', () => {
  const { result, allocations } = resolve(record({ leadId: 'lead_existing' }));
  assert.equal(result.action, 'existing'); assert.equal(result.leadId, 'lead_existing'); assert.equal(allocations, 0);
});
test('valid booked source can allocate an ID for governed registry/queue commit', () => {
  const { result, allocations } = resolve(record({ status: '已預約', date: '2026-10-24', time: '14:00' }));
  assert.equal(result.action, 'create'); assert.equal(allocations, 1);
});
test('UUID collisions are bounded and cannot reuse an existing stable source identity', () => {
  const f = loadRelease(); let allocations = 0;
  const result = f.box.oa2ResolveMissingLeadIdentity_(record(),
    { appointments: {}, owners: {}, knownLeadIds: new Set(['lead_collision']) }, () => { allocations++; return 'lead_collision'; });
  assert.equal(result.action, 'review'); assert.equal(allocations, 3);
});
test('exact Appointment ID recovers its original Lead ID without a new UUID', () => {
  const a = appointment(), { result, allocations } = resolve(record({ appointmentId: a.id }), { appointments: { [a.id]: a } });
  assert.equal(result.action, 'recover'); assert.equal(result.leadId, a.leadId);
  assert.equal(result.appointmentId, a.id); assert.equal(allocations, 0);
});
for (const suffix of ['e:synthetic@example.test', 'i:@synthetic-account']) test(`an exact no-phone ${suffix.startsWith('e:') ? 'email' : 'IG'} appointment pointer can restore stable identity`, () => {
  const key = `GOS Beauty|${suffix}`, a = appointment({ phone: '', customerKey: key });
  const { result, allocations } = resolve(record({ phone: '', customerKey: key, appointmentId: a.id }), { appointments: { [a.id]: a } });
  assert.equal(result.action, 'recover'); assert.equal(result.leadId, a.leadId); assert.equal(allocations, 0);
  const invalid = resolve(record({ phone: '', customerKey: key + '-wrong', appointmentId: a.id }), { appointments: { [a.id]: a } });
  assert.equal(invalid.result.action, 'review'); assert.equal(invalid.allocations, 0);
});
for (const [label, change] of [
  ['unknown pointer', r => r.appointmentId = 'appt_unknown'],
  ['wrong Account', (_r, a) => a.account = 'Alyssa Main'],
  ['wrong customer key', (_r, a) => a.customerKey = 'GOS Beauty|p:10000002'],
  ['wrong phone', (_r, a) => a.phone = '10000002'],
]) test(`unsafe appointment identity is preserved for review: ${label}`, () => {
  const r = record({ appointmentId: 'appt_existing' }), a = appointment(); change(r, a);
  const { result, allocations } = resolve(r, { appointments: { [a.id]: a } });
  assert.equal(result.action, 'review'); assert.equal(allocations, 0);
});
test('an exact appointment cannot recover an ID already owned on another Account', () => {
  const a = appointment(), { result, allocations } = resolve(record({ appointmentId: a.id }),
    { appointments: { [a.id]: a }, owners: { [a.leadId]: [{ account: 'Alyssa Main', row: 19 }] } });
  assert.equal(result.action, 'review'); assert.equal(allocations, 0);
});
test('multiple source owners never authorize recovery of an exact pointer', () => {
  const a = appointment(), { result, allocations } = resolve(record({ appointmentId: a.id }),
    { appointments: { [a.id]: a }, owners: { [a.leadId]: [{ account: 'GOS Beauty', row: 19 }, { account: 'Alyssa Main', row: 21 }] } });
  assert.equal(result.action, 'review'); assert.equal(allocations, 0);
});
for (const [field, value] of [['bookedAt', '2026-10-01T00:00:00Z'], ['outcome', 'Show'], ['outcomeAt', '2026-10-01T00:00:00Z']]) {
  test(`orphan appointment metadata never mints a replacement identity: ${field}`, () => {
    const { result, allocations } = resolve(record({ [field]: value }));
    assert.equal(result.action, 'review'); assert.equal(allocations, 0);
  });
}
for (const status of ['已到店', 'No Show']) test(`an unbound ${status} row is not converted into a fresh booking`, () => {
  const { result, allocations } = resolve(record({ status, date: '2026-10-01', confirmedAt: '2026-10-01' }));
  assert.equal(result.action, 'review'); assert.equal(allocations, 0);
});
test('same phone alone never recovers an older appointment identity', () => {
  const a = appointment(), { result, allocations } = resolve(record(), { appointments: { [a.id]: a } });
  assert.equal(result.action, 'create'); assert.notEqual(result.leadId, a.leadId); assert.equal(allocations, 1);
});
function anchor(a = appointment()) {
  return { leadId: a.leadId, account: a.account, currentAppointmentId: a.id, appointments: [a], events: [] };
}
test('a complete durable source intent restores its exact Lead ID before registry persistence', () => {
  const a = appointment(), { result, allocations } = resolve(record({ pendingSnapshot: JSON.stringify(anchor(a)) }));
  assert.equal(result.action, 'recover'); assert.equal(result.leadId, a.leadId);
  assert.equal(result.appointmentId, a.id); assert.equal(allocations, 0);
});
for (const [label, change] of [
  ['invalid JSON', r => r.pendingSnapshot = '{invalid'],
  ['conflicting current pointer', r => r.appointmentId = 'appt_conflict'],
  ['wrong anchor Account', (_r, intent) => intent.account = 'Alyssa Main'],
  ['wrong appointment Lead', (_r, intent) => intent.appointments[0].leadId = 'lead_conflict'],
]) test(`unsafe durable intent cannot mint or overwrite identity: ${label}`, () => {
  const r = record(), intent = anchor(); r.pendingSnapshot = JSON.stringify(intent);
  change(r, intent);
  if (label !== 'invalid JSON') r.pendingSnapshot = JSON.stringify(intent);
  const { result, allocations } = resolve(r);
  assert.equal(result.action, 'review'); assert.equal(allocations, 0);
});

function timerFixture(options = {}) {
  const f = loadRelease(), counts = { spreadsheets: 0, lock: 0, release: 0, priority: 0, process: 0, display: 0 };
  f.script.set('OMNI_ARRIVAL_V2_CURSOR', String(options.cursor || 0));
  f.box.oa2Enabled_ = () => true;
  f.box.omniStaffPriorityActive_ = () => !!options.staff;
  f.box.LockService = { getDocumentLock: () => ({ hasLock: () => !options.busy, tryLock: () => { counts.lock++; return !options.busy; }, releaseLock: () => { counts.release++; } }) };
  f.box.oa2Spreadsheet_ = () => { counts.spreadsheets++; return { getSheetByName: name => ({ getName: () => name }) }; };
  f.box.oa2PrioritizeSourceIdentities_ = () => { counts.priority++; return { registered: 0, recovered: 0, bookedAdded: 0, review: 0, accountFailures: [], processedAccounts: [] }; };
  f.box.oa3AdmitMaintenance_ = () => null;
  f.box.oa2RegisterImportedLeadIds_ = () => 0;
  f.box.oa2ProcessAccount_ = () => { counts.process++; if (options.processError) throw Error('Synthetic account failure'); return { newQueue: 0, changes: 0 }; };
  f.box.oa2TryRefreshQueueCs_ = () => { counts.display++; if (options.displayError) throw Error('Synthetic post-commit display failure'); return {}; };
  return { ...f, counts };
}
for (const mode of ['staff', 'busy']) test(`timer ${mode} admission performs no source work or cursor movement`, () => {
  const f = timerFixture({ [mode]: true }), before = clone(Object.fromEntries(f.script));
  const result = f.box.omniArrivalV2Timer();
  assert.ok(result); assert.deepEqual(Object.fromEntries(f.script), before);
  assert.equal(f.counts.spreadsheets, 0); assert.equal(f.counts.priority, 0);
  assert.equal(f.counts.process, 0); assert.equal(f.counts.display, 0);
  assert.equal(f.counts.release, 0);
});
test('staff activity discovered after lock admission releases lock without source reads or cursor movement', () => {
  const f = timerFixture(); let checks = 0;
  f.box.omniStaffPriorityActive_ = () => ++checks > 1;
  const before = clone(Object.fromEntries(f.script)); f.box.omniArrivalV2Timer();
  assert.deepEqual(Object.fromEntries(f.script), before); assert.equal(f.counts.spreadsheets, 0);
  assert.equal(f.counts.priority, 0); assert.equal(f.counts.release, 1);
});

const arrivalHeaders = ['品牌','電話','客人／預約','CS同事名','預約日期','時間','結果','到店日期','備註','檢查提示','Account','客人識別','電話末4','療程','分店','原預約日期（自動）','可追溯Book日期（自動）','Book日期來源（自動）','補充Book登記日期','穩定客戶識別（內部）','到店紀錄ID（內部）','客戶＋預約日期時間（內部）','Appointment ID','Schedule Revision','Queue State','Outcome Recorded At','Omni Lead ID','Booking Registered At','Record Origin','sortKey','來源','試做價','開單金額','總金額'];
function nativeFixture(options = {}) {
  const f = loadRelease(), headers = f.sourceHeaders(), accounts = f.accountNames(), sources = new Map();
  const fields = { '最後更新日期': '2026-10-22', 'Created At': '2026-10-22', '跟進狀態': '已預約',
    'CS同事名': 'Synthetic CS', '品牌': 'GOS Beauty', '預約日期': '2026-10-24', '預約時間': 14 / 24,
    '客人姓名': 'Synthetic customer', '電話': '10000001', '療程 / 優惠': 'Synthetic offer',
    '療程項目': 'Synthetic treatment', '分店': 'Synthetic branch', 'CS Remark': 'Keep exact synthetic note\n第二行',
    'Account': 'GOS Beauty', ...options.fields };
  for (const name of accounts) {
    const hs = headers.slice(); if (options.badMain && name === 'Alyssa Main') hs[10] = ' '.repeat(140);
    sources.set(name, sheet(name, hs, name === 'GOS Beauty' ? [valuesRow(headers, fields)] : []));
  }
  const queue = sheet('到店紀錄', arrivalHeaders, [], 7);
  const registry = sheet('_appointment_registry', f.registryHeaders());
  const history = sheet('_appointment_history', f.historyHeaders());
  const sheets = new Map([...sources, ['到店紀錄', queue], ['_appointment_registry', registry], ['_appointment_history', history]]);
  const ss = workbook(sheets), lock = { hasLock: () => true };
  f.box.oa2Spreadsheet_ = () => ss; f.box.SpreadsheetApp.getActiveSpreadsheet = () => ss;
  f.box.oa2Enabled_ = () => true; f.box.omniStaffPriorityActive_ = () => false;
  // Optional retirement policy lives in an additional native project file. The
  // synthetic workbook has no retired appointments; all changed helpers remain real.
  f.box.oa4RetiredAppointmentIds_ = () => new Set();
  const originals = { absorb: f.box.oa2AbsorbWorkerQueueInputs_ };
  f.box.oa3RefreshDisplay_ = () => ({ displayRows: 0 });
  f.box.oa3SortArrival_ = () => { throw Error('Identity priority must not sort unrelated arrival records'); };
  f.box.oa2AbsorbWorkerQueueInputs_ = () => { throw Error('Identity priority must not accept unrelated queue inputs'); };
  const source = sources.get('GOS Beauty');
  return { ...f, headers, sources, sheets, source, queue, registry, history, ss, lock, originals,
    run: options => f.box.oa2PrioritizeSourceIdentities_(ss, lock, options),
    cell: header => source.state.matrix[1][headers.indexOf(header)],
    writes: () => [...sheets.values()].flatMap(sh => sh.state.writes.map(w => ({ sheet: sh.state.name, ...w }))) };
}
test('identity priority bypasses one bad Main header and commits a GOS booking with registry/queue ownership', () => {
  const f = nativeFixture({ badMain: true }), before = f.source.state.matrix[1].slice(0, 25), receipt = f.run();
  assert.equal(receipt.accountFailures.length, 1); assert.equal(receipt.bookedAdded, 1);
  const lead = f.cell('Omni Lead ID'), pointer = f.cell('Appointment ID');
  assert.ok(lead); assert.ok(pointer); assert.deepEqual(f.source.state.matrix[1].slice(0, 25), before);
  const registry = f.box.oa2ReadRegistry_(f.ss).appointments[pointer];
  assert.equal(registry.leadId, lead); assert.equal(registry.state, 'active'); assert.equal(registry.outcome, '');
  assert.equal(registry.date, '2026-10-24'); assert.equal(registry.time, '14:00');
  assert.equal(registry.bookedAt, '', 'A deferred imported booking cannot invent its registration timestamp');
  const queue = f.box.oa2ReadQueue_(f.ss, false);
  assert.equal(queue.length, 1); assert.equal(queue[0].appointmentId, pointer); assert.equal(queue[0].raw[23], lead);
  assert.equal(queue[0].entryId, registry.queueId); assert.equal(queue[0].outcome, '待到店');
  assert.equal(f.sources.get('Alyssa Main').state.writes.length, 0);
});
test('a repeated identity-priority pass skips a complete booking without new UUID, writes or duplicate queue', () => {
  const f = nativeFixture(); f.run(); const count = f.uuidCount(), writes = f.writes().length;
  const lead = f.cell('Omni Lead ID'), pointer = f.cell('Appointment ID'), registryBefore = clone(f.registry.state.matrix);
  const receipt = f.run();
  assert.equal(receipt.registered, 0); assert.equal(receipt.bookedAdded, 0);
  assert.equal(f.uuidCount(), count); assert.equal(f.writes().length, writes);
  assert.equal(f.cell('Omni Lead ID'), lead); assert.equal(f.cell('Appointment ID'), pointer);
  assert.deepEqual(clone(f.registry.state.matrix), registryBefore); assert.equal(f.box.oa2ReadQueue_(f.ss, false).length, 1);
});
test('new identity booking preserves every existing completed arrival field including CS, notes and zero amounts', () => {
  const f = nativeFixture(), a = appointment({ id: 'appt_history', leadId: 'lead_history', queueId: 'queue_history',
    account: 'Skin Light', customerKey: 'Skin Light|p:10000009', phone: '10000009', state: 'completed', outcome: 'Show' });
  f.registry.appendRow(valuesRow(f.registryHeaders(), { 'Appointment ID': a.id, 'Lead ID': a.leadId, 'Account': a.account,
    'Customer Key': a.customerKey, 'Phone Last8': a.phone, 'Appointment Date': '2026-10-01', 'Appointment Time': 12 / 24,
    'Registration Provenance': a.provenance, 'State': a.state, 'Outcome': a.outcome, 'Arrival Date': '2026-10-01',
    'Revision': 1, 'Queue Entry ID': a.queueId }));
  f.queue.appendRow(valuesRow(arrivalHeaders, { '品牌': 'Historical exact brand', '電話': a.phone, '客人／預約': 'Historical synthetic visit',
    'CS同事名': 'Historical CS', '預約日期': '2026-10-01', '時間': 12 / 24, '結果': '已到店', '到店日期': '2026-10-01',
    '備註': 'Keep historical note\n歷史原文', 'Account': a.account, '穩定客戶識別（內部）': a.customerKey,
    '到店紀錄ID（內部）': a.queueId, 'Appointment ID': a.id, 'Omni Lead ID': a.leadId, 'Record Origin': 'managed',
    '來源': 'Historical AD', '試做價': 0, '開單金額': 1280, '總金額': '=SUM(AF8:AG8)' }));
  const before = clone(f.queue.state.matrix[7]), registryBefore = clone(f.registry.state.matrix[1]);
  const receipt = f.run();
  assert.equal(receipt.bookedAdded, 1); assert.deepEqual(clone(f.queue.state.matrix[7]), before);
  assert.deepEqual(clone(f.registry.state.matrix[1]), registryBefore);
  assert.equal(f.box.oa2ReadQueue_(f.ss, false).length, 2);
  assert.equal(f.queue.state.writes.filter(write => write.row === 8).length, 1, 'Only fixture setup may write completed row 8');
});
test('Advanced Sheets discovery batches all six Accounts once and keeps native writes/CAS authoritative', () => {
  const f = nativeFixture({ badMain: true }), requests = [];
  f.box.Sheets = { Spreadsheets: { Values: { batchGet: (id, options) => {
    requests.push({ id, options });
    return { valueRanges: f.accountNames().map(name => ({ values: f.sources.get(name).state.matrix.map(row => {
      const values = row.map(value => String(value ?? '')); while (values.length && values.at(-1) === '') values.pop(); return values;
    }) })) };
  } } } };
  const before = f.source.state.matrix[1].slice(0, 25), receipt = f.run();
  assert.equal(receipt.bookedAdded, 1); assert.equal(receipt.accountFailures.length, 1);
  assert.equal(requests.length, 1); assert.deepEqual(clone(requests[0].options.ranges), f.accountNames().map(name => `'${name}'`));
  assert.equal(requests[0].options.valueRenderOption, 'FORMATTED_VALUE');
  assert.deepEqual(f.source.state.matrix[1].slice(0, 25), before); assert.ok(f.source.state.reads > 0);
  assert.ok(f.source.state.writes.length > 0);
  const log = f.logs.join('\n');
  for (const value of ['10000001', 'Synthetic customer', 'Synthetic CS', 'Keep exact synthetic note']) assert.equal(log.includes(value), false);
});
for (const [name, response] of [['null', null], ['missing ranges', {}], ['truncated ranges', { valueRanges: [] }],
  ['malformed matrix', { valueRanges: Array.from({ length: 6 }, () => ({ values: [{ invalid: true }] })) }]]) {
  test(`invalid Advanced Sheets discovery aborts without native fallback or writes: ${name}`, () => {
    const f = nativeFixture(); f.box.Sheets = { Spreadsheets: { Values: { batchGet: () => response } } };
    assert.throws(() => f.run(), /Incomplete|Invalid/);
    assert.equal(f.source.state.reads, 0); assert.equal(f.writes().length, 0);
  });
}
test('a changed colleague remark between targeted source read and commit is preserved by CAS', () => {
  const f = nativeFixture(); let targeted = 0;
  f.source.state.beforeRead = (_count, range) => {
    if (range.row === 2 && range.column === 1 && range.height === 1 && range.width === 31 && ++targeted === 2) {
      f.source.state.matrix[1][f.headers.indexOf('CS Remark')] = 'Concurrent colleague remark';
    }
  };
  const receipt = f.run();
  assert.ok(targeted >= 2, 'Fixture must exercise a real post-discovery compare-and-swap read');
  assert.equal(f.cell('CS Remark'), 'Concurrent colleague remark');
  assert.equal(receipt.bookedAdded, 0); assert.equal(f.cell('Omni Lead ID'), '');
  assert.equal(f.registry.state.writes.length, 0); assert.equal(f.queue.state.writes.length, 0);
});
test('staff activity appearing after discovery prevents a pending booked identity commit', () => {
  const f = nativeFixture(); let staff = false;
  f.box.omniStaffPriorityActive_ = () => staff;
  f.source.state.beforeRead = (_count, range) => { if (range.row === 2 && range.height === 1) staff = true; };
  const receipt = f.run();
  assert.equal(staff, true); assert.equal(receipt.bookedAdded, 0);
  assert.equal(f.writes().length, 0); assert.equal(f.cell('Omni Lead ID'), '');
});
test('an identity-priority pass without an admitted document lock is rejected before any Sheet work', () => {
  const f = nativeFixture();
  assert.throws(() => f.box.oa2PrioritizeSourceIdentities_(f.ss, null), /lock/);
  assert.throws(() => f.box.oa2PrioritizeSourceIdentities_(f.ss, { hasLock: () => false }), /lock/);
  assert.equal(f.writes().length, 0); assert.equal(f.source.state.reads, 0);
});
for (const staffHint of [false, true]) test(`an ordinary CS remark edit commits an imported booked row before exposing its new ID (staff hint ${staffHint})`, () => {
  const f = nativeFixture(), before = f.source.state.matrix[1].slice(0, 25);
  f.box.omniStaffPriorityActive_ = () => staffHint;
  f.box.oa2ProcessAccount_ = () => { throw Error('A remark edit must not reconcile every unrelated Account booking'); };
  f.box.oa2TryRefreshQueueCs_ = () => ({});
  const column = f.headers.indexOf('CS Remark') + 1;
  f.box.omniArrivalV2AccountEdit_({ source: f.ss, range: f.source.getRange(2, column, 1, 1) }, 2, 2, column, column, f.source, undefined, f.lock);
  const lead = f.cell('Omni Lead ID'), pointer = f.cell('Appointment ID');
  assert.ok(lead); assert.ok(pointer); assert.deepEqual(f.source.state.matrix[1].slice(0, 25), before);
  assert.equal(f.box.oa2ReadRegistry_(f.ss).appointments[pointer].leadId, lead);
  assert.equal(f.box.oa2ReadQueue_(f.ss, false).length, 1);
});
for (const header of ['跟進狀態', '預約日期', '預約時間']) test(`a genuine ${header} booking edit records observed registration time separately from the appointment day`, () => {
  const f = nativeFixture(), before = f.source.state.matrix[1].slice(0, 25);
  f.box.omniStaffPriorityActive_ = () => true;
  f.box.oa2ProcessAccount_ = () => ({ newQueue: 0, changes: 0 });
  f.box.oa2TryRefreshQueueCs_ = () => ({});
  const column = f.headers.indexOf(header) + 1;
  f.box.omniArrivalV2AccountEdit_({ source: f.ss, range: f.source.getRange(2, column, 1, 1) }, 2, 2, column, column, f.source, undefined, f.lock);
  const a = f.box.oa2ReadRegistry_(f.ss).appointments[f.cell('Appointment ID')];
  assert.equal(a.provenance, 'observed_booking_edit'); assert.ok(Number.isFinite(Date.parse(a.bookedAt)));
  assert.equal(f.cell('Booking Registered At').toISOString(), a.bookedAt);
  assert.equal(a.date, '2026-10-24'); assert.deepEqual(f.source.state.matrix[1].slice(0, 25), before);
  assert.equal(a.outcome, ''); assert.equal(a.state, 'active');
});
for (const state of ['canceled', 'completed']) test(`a genuine new Booked edit creates a successor while retaining the ${state} appointment history`, () => {
  const a = appointment({ state, outcome: state === 'completed' ? 'Show' : '' });
  const f = nativeFixture({ fields: { 'Appointment ID': a.id } });
  f.registry.appendRow(valuesRow(f.registryHeaders(), { 'Appointment ID': a.id, 'Lead ID': a.leadId, 'Account': a.account,
    'Customer Key': a.customerKey, 'Phone Last8': a.phone, 'Appointment Date': '2026-10-01', 'Appointment Time': 12 / 24,
    'Booking Registered At': new Date('2026-09-29T04:00:00Z'), 'Registration Provenance': 'observed_booking_edit',
    'State': a.state, 'Outcome': a.outcome, 'Arrival Date': state === 'completed' ? '2026-10-01' : '', 'Revision': 3,
    'Queue Entry ID': a.queueId, 'Last Seen Status': state === 'completed' ? 'show' : 'booked' }));
  f.queue.appendRow(valuesRow(arrivalHeaders, { '品牌': 'Historical exact brand', '電話': a.phone, '客人／預約': 'Retained visit',
    'CS同事名': 'Historical CS', '預約日期': '2026-10-01', '時間': 12 / 24, '結果': state === 'completed' ? '已到店' : '取消',
    '到店日期': state === 'completed' ? '2026-10-01' : '', '備註': 'Retain exact old outcome note', 'Account': a.account,
    '穩定客戶識別（內部）': a.customerKey, '到店紀錄ID（內部）': a.queueId, 'Appointment ID': a.id,
    'Omni Lead ID': a.leadId, 'Record Origin': 'managed', '試做價': 0, '開單金額': 1280 }));
  const oldRegistry = clone(f.registry.state.matrix[1]), oldQueue = clone(f.queue.state.matrix[7]);
  f.box.omniStaffPriorityActive_ = () => true;
  f.box.oa2ProcessAccount_ = () => ({ newQueue: 0, changes: 0 }); f.box.oa2TryRefreshQueueCs_ = () => ({});
  const column = f.headers.indexOf('跟進狀態') + 1;
  f.box.omniArrivalV2AccountEdit_({ source: f.ss, range: f.source.getRange(2, column, 1, 1) }, 2, 2, column, column, f.source, undefined, f.lock);
  const pointer = f.cell('Appointment ID'), all = f.box.oa2ReadRegistry_(f.ss).appointments, next = all[pointer];
  assert.notEqual(pointer, a.id); assert.equal(next.leadId, a.leadId); assert.equal(next.previousId, a.id);
  assert.equal(next.state, 'active'); assert.equal(next.outcome, ''); assert.equal(next.provenance, 'observed_booking_edit');
  assert.ok(Number.isFinite(Date.parse(next.bookedAt))); assert.equal(Object.keys(all).length, 2);
  assert.deepEqual(clone(f.registry.state.matrix[1]), oldRegistry); assert.deepEqual(clone(f.queue.state.matrix[7]), oldQueue);
  assert.equal(f.box.oa2ReadQueue_(f.ss, false).length, 2);
});
for (const field of ['Booking Registered At', '到店結果', '到店結果更新時間']) test(`native priority preserves orphan ${field} and never writes an ID`, () => {
  const f = nativeFixture({ fields: { [field]: field === '到店結果' ? 'Show' : '2026-10-01T00:00:00Z' } });
  const before = clone(f.source.state.matrix), receipt = f.run();
  assert.ok(receipt.review > 0); assert.deepEqual(f.source.state.matrix, before);
  assert.equal(f.cell('Omni Lead ID'), ''); assert.equal(f.writes().length, 0);
});
test('native priority restores an exact registry owner and reuses the same Appointment ID', () => {
  const a = appointment(), f = nativeFixture({ fields: { 'Appointment ID': a.id } });
  f.registry.appendRow(valuesRow(f.registryHeaders(), {
    'Appointment ID': a.id, 'Lead ID': a.leadId, 'Account': a.account, 'Customer Key': a.customerKey,
    'Phone Last8': a.phone, 'Appointment Date': a.date, 'Appointment Time': 14 / 24,
    'Registration Provenance': a.provenance, 'State': a.state, 'Revision': 1,
  }));
  const receipt = f.run();
  assert.equal(receipt.recovered, 1); assert.equal(f.cell('Omni Lead ID'), a.leadId);
  assert.equal(f.cell('Appointment ID'), a.id); assert.equal(f.box.oa2ReadQueue_(f.ss, false)[0].appointmentId, a.id);
  assert.equal(Object.keys(f.box.oa2ReadRegistry_(f.ss).appointments).length, 1);
});
for (const state of ['completed', 'canceled', 'superseded', 'reschedule_requested']) {
  test(`exact identity restoration never reopens or recreates a ${state} historical appointment`, () => {
    const a = appointment({ state, outcome: state === 'completed' ? 'Show' : '' });
    const f = nativeFixture({ fields: { 'Appointment ID': a.id } });
    f.registry.appendRow(valuesRow(f.registryHeaders(), {
      'Appointment ID': a.id, 'Lead ID': a.leadId, 'Account': a.account, 'Customer Key': a.customerKey,
      'Phone Last8': a.phone, 'Appointment Date': '2026-10-01', 'Appointment Time': 14 / 24,
      'Registration Provenance': a.provenance, 'State': a.state, 'Outcome': a.outcome,
      'Arrival Date': state === 'completed' ? '2026-10-01' : '', 'Revision': 3,
    }));
    const before = clone(f.registry.state.matrix), receipt = f.run();
    assert.equal(receipt.bookedAdded, 0); assert.equal(receipt.recovered, 1); assert.ok(receipt.review > 0);
    assert.equal(f.cell('Omni Lead ID'), a.leadId); assert.equal(f.cell('Appointment ID'), a.id);
    assert.deepEqual(clone(f.registry.state.matrix), before); assert.equal(f.queue.state.writes.length, 0);
  });
}
test('native priority rejects exact registry recovery when that Lead already has another Account owner', () => {
  const a = appointment(), f = nativeFixture({ fields: { 'Appointment ID': a.id } });
  f.registry.appendRow(valuesRow(f.registryHeaders(), {
    'Appointment ID': a.id, 'Lead ID': a.leadId, 'Account': a.account, 'Customer Key': a.customerKey,
    'Phone Last8': a.phone, 'Appointment Date': a.date, 'Registration Provenance': a.provenance,
    'State': a.state, 'Revision': 1,
  }));
  const main = f.sources.get('Alyssa Main');
  main.appendRow(valuesRow(f.headers, { 'Account': 'Alyssa Main', '客人姓名': 'Other synthetic source', '電話': '10000002', 'Omni Lead ID': a.leadId }));
  const before = clone(f.source.state.matrix), baseline = f.writes().length, receipt = f.run();
  assert.ok(receipt.review > 0); assert.equal(receipt.bookedAdded, 0);
  assert.deepEqual(f.source.state.matrix, before); assert.equal(f.writes().length, baseline);
});
test('a second Account claiming the recovered Lead after display discovery is detected before identity write', () => {
  const a = appointment(), f = nativeFixture({ fields: { 'Appointment ID': a.id } });
  f.registry.appendRow(valuesRow(f.registryHeaders(), {
    'Appointment ID': a.id, 'Lead ID': a.leadId, 'Account': a.account, 'Customer Key': a.customerKey,
    'Phone Last8': a.phone, 'Appointment Date': a.date, 'Appointment Time': 14 / 24,
    'Registration Provenance': a.provenance, 'State': a.state, 'Revision': 1,
  }));
  let moved = false;
  f.source.state.beforeRead = (_count, range) => {
    if (!moved && range.row === 1 && range.height > 1) {
      moved = true;
      f.sources.get('Alyssa Main').state.matrix.push(valuesRow(f.headers, {
        'Account': 'Alyssa Main', '客人姓名': 'Concurrent other synthetic source', '電話': '10000002', 'Omni Lead ID': a.leadId,
      }));
    }
  };
  const before = clone(f.source.state.matrix), receipt = f.run();
  assert.equal(moved, true); assert.equal(receipt.bookedAdded, 0);
  assert.deepEqual(f.source.state.matrix, before); assert.equal(f.cell('Omni Lead ID'), '');
});
function duplicatePointerFixture() {
  const a = appointment(), f = nativeFixture({ fields: { '跟進狀態': '待跟進', '預約日期': '', '預約時間': '', 'Appointment ID': a.id } });
  f.source.appendRow(f.source.state.matrix[1].slice());
  f.registry.appendRow(valuesRow(f.registryHeaders(), {
    'Appointment ID': a.id, 'Lead ID': a.leadId, 'Account': a.account, 'Customer Key': a.customerKey,
    'Phone Last8': a.phone, 'Appointment Date': a.date, 'Registration Provenance': a.provenance,
    'State': a.state, 'Revision': 1,
  }));
  return f;
}
test('two missing-ID rows claiming the same exact appointment do not receive a duplicated recovered Lead ID', () => {
  const f = duplicatePointerFixture(), before = clone(f.source.state.matrix), baseline = f.writes().length;
  const receipt = f.run();
  assert.ok(receipt.review > 0 || receipt.accountFailures.length > 0);
  assert.deepEqual(f.source.state.matrix, before); assert.equal(f.writes().length, baseline);
});
test('interactive multi-row identity recovery rejects duplicated exact appointment claims before writes', () => {
  const f = duplicatePointerFixture(), before = clone(f.source.state.matrix), baseline = f.writes().length;
  assert.throws(() => f.box.oa2EnsureEditedLeadIds_(f.source, f.box.getOmniColumns_(f.source), 2, 3), /identity|review|duplicate|未接納/i);
  assert.deepEqual(f.source.state.matrix, before); assert.equal(f.writes().length, baseline);
});
test('an interrupted booked commit retains source intent and safely retries with the same identities', () => {
  const f = nativeFixture(); let fail = true;
  f.registry.state.beforeWrite = () => { if (fail) throw Error('Synthetic registry transport failure after durable source intent'); };
  const first = f.run(), lead = f.cell('Omni Lead ID'), intentText = f.cell('Pending Appointment Snapshot');
  assert.ok(first.accountFailures.length > 0); assert.ok(lead); assert.ok(intentText);
  const intent = JSON.parse(intentText), pointer = intent.currentAppointmentId, allocations = f.uuidCount();
  assert.equal(intent.leadId, lead); assert.ok(pointer); assert.equal(f.queue.state.writes.length, 0);
  fail = false;
  const second = f.run();
  assert.equal(second.bookedAdded, 1); assert.equal(f.cell('Omni Lead ID'), lead);
  assert.equal(f.cell('Appointment ID'), pointer); assert.equal(f.cell('Pending Appointment Snapshot'), '');
  assert.equal(f.uuidCount(), allocations, 'A durable retry must not allocate a new source or queue identity');
  assert.equal(f.box.oa2ReadQueue_(f.ss, false).length, 1);
  assert.equal(Object.keys(f.box.oa2ReadRegistry_(f.ss).appointments).length, 1);
  const before = f.writes().length; f.run(); assert.equal(f.writes().length, before);
});
test('two Accounts with valid pending source intents and blank IDs recover across bounded passes without mutual replay deadlock', () => {
  const gos = appointment(), main = appointment({ id: 'appt_main', leadId: 'lead_main', account: 'Alyssa Main',
    phone: '10000002', customerKey: 'Alyssa Main|p:10000002', queueId: '' });
  gos.queueId = '';
  const f = nativeFixture({ fields: { 'Pending Appointment Snapshot': JSON.stringify(anchor(gos)) } });
  f.sources.get('Alyssa Main').appendRow(valuesRow(f.headers, {
    '最後更新日期': '2026-10-22', 'Created At': '2026-10-22', '跟進狀態': '已預約', '品牌': 'Alyssa',
    'Account': 'Alyssa Main', '客人姓名': 'Other synthetic customer', '電話': main.phone,
    '預約日期': main.date, '預約時間': 14 / 24, 'Pending Appointment Snapshot': JSON.stringify(anchor(main)),
  }));
  const first = f.run({ accountNames: ['Alyssa Main'], maxAccounts: 1 });
  assert.equal(first.recovered, 1); assert.equal(first.bookedAdded, 1); assert.equal(first.accountFailures.length, 0);
  assert.equal(first.processedAccounts.length, 1, 'One priority call must not process every candidate Account');
  const second = f.run({ accountNames: ['GOS Beauty'], maxAccounts: 1 });
  assert.equal(second.recovered, 1); assert.equal(second.bookedAdded, 1); assert.equal(second.accountFailures.length, 0);
  assert.equal(second.processedAccounts.length, 1);
  assert.equal(f.cell('Omni Lead ID'), gos.leadId);
  assert.equal(f.sources.get('Alyssa Main').state.matrix[1][f.headers.indexOf('Omni Lead ID')], main.leadId);
  const queue = f.box.oa2ReadQueue_(f.ss, false);
  assert.equal(queue.length, 2); assert.equal(new Set(queue.map(q => q.appointmentId)).size, 2);
  assert.equal(Object.keys(f.box.oa2ReadRegistry_(f.ss).appointments).length, 2);
});
test('an invalid unrelated Account anchor remains for review without blocking a separately owned GOS booking', () => {
  const f = nativeFixture();
  f.sources.get('Alyssa Main').appendRow(valuesRow(f.headers, {
    'Account': 'Alyssa Main', '客人姓名': 'Unrelated synthetic customer', '電話': '10000002',
    'Pending Appointment Snapshot': '{invalid synthetic intent',
  }));
  const mainBefore = clone(f.sources.get('Alyssa Main').state.matrix);
  const first = f.run({ accountNames: ['Alyssa Main'], maxAccounts: 1 });
  assert.ok(first.review > 0); assert.equal(first.bookedAdded, 0);
  const receipt = f.run({ accountNames: ['GOS Beauty'], maxAccounts: 1 });
  assert.equal(receipt.bookedAdded, 1);
  assert.ok(f.cell('Omni Lead ID')); assert.ok(f.cell('Appointment ID'));
  assert.deepEqual(f.sources.get('Alyssa Main').state.matrix, mainBefore);
  assert.equal(f.sources.get('Alyssa Main').state.writes.length, 1, 'Only fixture setup wrote the unrelated Account');
});
test('an unrelated malformed anchor on the same Account does not enter a scoped row commit', () => {
  const f = nativeFixture();
  f.source.appendRow(valuesRow(f.headers, { 'Account': 'GOS Beauty', '客人姓名': 'Unrelated same-Account synthetic source',
    '電話': '10000002', 'Pending Appointment Snapshot': '{invalid same-Account intent' }));
  const outside = clone(f.source.state.matrix[2]);
  const receipt = f.run({ accountNames: ['GOS Beauty'], firstRow: 2, lastRow: 2, maxAccounts: 1 });
  assert.equal(receipt.bookedAdded, 1); assert.deepEqual(f.source.state.matrix[2], outside);
  assert.equal(f.source.state.writes.filter(write => write.row === 3).length, 1, 'Only fixture setup may write outside row 3');
});
test('a valid outside recovery intent claiming the candidate appointment prevents identity reuse', () => {
  const a = appointment(), f = nativeFixture({ fields: { 'Appointment ID': a.id } });
  f.registry.appendRow(valuesRow(f.registryHeaders(), { 'Appointment ID': a.id, 'Lead ID': a.leadId, 'Account': a.account,
    'Customer Key': a.customerKey, 'Phone Last8': a.phone, 'Appointment Date': a.date,
    'Registration Provenance': a.provenance, 'State': a.state, 'Revision': 1 }));
  const outside = appointment({ id: a.id, leadId: 'lead_other_intent', account: 'Alyssa Main',
    customerKey: 'Alyssa Main|p:10000002', phone: '10000002' });
  f.sources.get('Alyssa Main').appendRow(valuesRow(f.headers, { 'Account': 'Alyssa Main', '客人姓名': 'Other exact intent',
    '電話': outside.phone, 'Pending Appointment Snapshot': JSON.stringify(anchor(outside)) }));
  const before = clone(f.source.state.matrix), receipt = f.run({ accountNames: ['GOS Beauty'], maxAccounts: 1 });
  assert.ok(receipt.review > 0 || receipt.accountFailures.length > 0); assert.equal(receipt.bookedAdded, 0);
  assert.deepEqual(f.source.state.matrix, before); assert.equal(f.queue.state.writes.length, 0);
});
test('an unrelated valid intent is retained and deferred rather than applied by a scoped new booking', () => {
  const f = nativeFixture(), outside = appointment({ id: 'appt_outside', leadId: 'lead_outside', account: 'Alyssa Main',
    customerKey: 'Alyssa Main|p:10000002', phone: '10000002' });
  f.sources.get('Alyssa Main').appendRow(valuesRow(f.headers, { 'Account': 'Alyssa Main', '客人姓名': 'Other durable intent',
    '電話': outside.phone, 'Pending Appointment Snapshot': JSON.stringify(anchor(outside)) }));
  const before = clone(f.sources.get('Alyssa Main').state.matrix);
  const receipt = f.run({ accountNames: ['GOS Beauty'], maxAccounts: 1 });
  assert.equal(receipt.bookedAdded, 1); assert.deepEqual(f.sources.get('Alyssa Main').state.matrix, before);
  assert.equal(f.box.oa2ReadRegistry_(f.ss).appointments[outside.id], undefined);
});
test('fifty persistent review rows cannot starve a later valid booking within bounded passes', () => {
  const f = nativeFixture(), valid = f.source.state.matrix[1].slice();
  const orphans = Array.from({ length: 50 }, (_, i) => valuesRow(f.headers, { 'Account': 'GOS Beauty',
    '客人姓名': `Synthetic review ${i}`, '電話': String(10000100 + i), '跟進狀態': '待跟進', 'Booking Registered At': '2026-10-01T00:00:00Z' }));
  f.source.state.matrix = [f.headers.slice(), ...orphans, valid];
  const first = f.run({ accountNames: ['GOS Beauty'], maxAccounts: 1 });
  const firstNotes = f.source.state.noteWrites.slice();
  assert.ok(firstNotes.length > 0 && firstNotes.length <= 10, 'A background pass must bound newly written review notes');
  const second = f.run({ accountNames: ['GOS Beauty'], maxAccounts: 1 });
  const secondNotes = f.source.state.noteWrites.slice(firstNotes.length), firstRows = new Set(firstNotes.map(note => note.row));
  assert.ok(secondNotes.length > 0 && secondNotes.length <= 10);
  assert.ok(secondNotes.every(note => !firstRows.has(note.row)), 'A later pass must progress to remaining warnings instead of rewriting the same notes');
  assert.equal(first.bookedAdded + second.bookedAdded, 1);
  assert.ok(f.source.state.matrix[51][f.headers.indexOf('Omni Lead ID')]);
  assert.deepEqual(f.source.state.matrix.slice(1, 51), orphans, 'Review-only evidence must remain byte-for-byte intact');
  assert.equal(f.box.oa2ReadQueue_(f.ss, false).length, 1);
});
test('one priority pass writes at most fifty accepted identities and a later pass completes the remainder', () => {
  const f = nativeFixture({ fields: { '跟進狀態': '待跟進', '預約日期': '', '預約時間': '' } });
  const base = f.source.state.matrix[1].slice();
  f.source.state.matrix = [f.headers.slice(), ...Array.from({ length: 51 }, (_, i) => {
    const row = base.slice(); row[f.headers.indexOf('電話')] = String(10000100 + i); return row;
  })];
  const first = f.run({ accountNames: ['GOS Beauty'], maxAccounts: 1 });
  assert.equal(first.registered, 50); assert.equal(f.source.state.matrix[51][f.headers.indexOf('Omni Lead ID')], '');
  assert.equal(f.source.state.matrix.slice(1).filter(row => row[f.headers.indexOf('Omni Lead ID')]).length, 50);
  const second = f.run({ accountNames: ['GOS Beauty'], maxAccounts: 1 });
  assert.equal(second.registered, 1); assert.equal(f.uuidCount(), 51);
  assert.ok(f.source.state.writes.every(write => write.column === 26 && write.width === 1));
  assert.equal(f.registry.state.writes.length, 0); assert.equal(f.queue.state.writes.length, 0);
});
test('a start Account cursor never wraps back to an earlier review candidate within the same invocation', () => {
  const f = nativeFixture();
  const later = f.run({ startAccountIndex: 4, maxAccounts: 1 });
  assert.equal(later.processedAccounts.length, 0); assert.equal(f.writes().length, 0);
  const next = f.run({ startAccountIndex: 0, maxAccounts: 1 });
  assert.equal(next.processedAccounts.length, 1); assert.equal(next.attemptedAccountIndex, 3);
  assert.equal(next.nextAccountIndex, 4); assert.equal(next.bookedAdded, 1);
});
test('a selected Account failure advances only its maintenance cursor after priority registration', () => {
  const f = timerFixture({ processError: true }); let error;
  try { f.box.omniArrivalV2Timer(); } catch (caught) { error = caught; }
  assert.equal(f.counts.priority, 1); assert.equal(f.counts.process, 1);
  assert.equal(f.script.get('OMNI_ARRIVAL_V2_CURSOR'), '1'); assert.equal(f.counts.release, 1);
  if (error) assert.match(error.message, /Synthetic account failure/);
});
test('a post-commit CS display failure cannot pin the timer cursor to one Account', () => {
  const f = timerFixture({ cursor: 3, displayError: true }); let error;
  try { f.box.omniArrivalV2Timer(); } catch (caught) { error = caught; }
  assert.equal(f.counts.priority, 1); assert.equal(f.counts.process, 1); assert.equal(f.counts.display, 1);
  assert.equal(f.script.get('OMNI_ARRIVAL_V2_CURSOR'), '4'); assert.equal(f.counts.release, 1);
  if (error) assert.match(error.message, /post-commit display failure/);
});
test('the real timer commits one GOS identity batch without also running malformed Main maintenance', () => {
  const f = nativeFixture({ badMain: true }); let released = 0;
  let maintenance = 0;
  f.script.set('OMNI_ARRIVAL_V2_CURSOR', '0');
  f.box.LockService = { getDocumentLock: () => ({ hasLock: () => true, tryLock: () => true, releaseLock: () => { released++; } }) };
  f.box.oa3AdmitMaintenance_ = () => null;
  f.box.oa2TryRefreshQueueCs_ = () => ({});
  f.box.oa2ProcessAccount_ = () => { maintenance++; throw Error('Identity-only timer must not run another heavy Account context'); };
  const receipt = f.box.omniArrivalV2Timer();
  assert.ok(f.cell('Omni Lead ID')); assert.ok(f.cell('Appointment ID'));
  assert.equal(f.box.oa2ReadQueue_(f.ss, false).length, 1);
  assert.equal(receipt.identityOnly, true); assert.equal(maintenance, 0);
  assert.equal(f.script.get('OMNI_ARRIVAL_V2_CURSOR'), '4'); assert.equal(released, 1);
  assert.equal(f.sources.get('Alyssa Main').state.writes.length, 0);
});
test('a review-only orphan cannot fall through timer maintenance and receive a fresh ID', () => {
  const f = nativeFixture({ fields: { '跟進狀態': '待跟進', 'Omni Lead ID': 'lead_complete_gos' } });
  const main = f.sources.get('Alyssa Main');
  main.appendRow(valuesRow(f.headers, { 'Account': 'Alyssa Main', '客人姓名': 'Orphan identity evidence', '電話': '10000002',
    '跟進狀態': '待跟進', 'Booking Registered At': '2026-10-01T00:00:00Z' }));
  const before = clone(main.state.matrix);
  f.script.set('OMNI_ARRIVAL_V2_CURSOR', '0');
  f.box.LockService = { getDocumentLock: () => ({ hasLock: () => true, tryLock: () => true, releaseLock() {} }) };
  f.box.oa3AdmitMaintenance_ = () => null; f.box.oa2TryRefreshQueueCs_ = () => ({});
  f.box.oa2AbsorbWorkerQueueInputs_ = f.originals.absorb;
  f.box.oa2RehomeMovedAccountAppointments_ = () => {};
  const receipt = f.box.omniArrivalV2Timer();
  assert.equal(receipt.review, true); assert.equal(receipt.identityOnly, true);
  assert.equal(f.script.get('OMNI_ARRIVAL_V2_CURSOR'), '1');
  assert.deepEqual(main.state.matrix, before);
  assert.equal(main.state.writes.length, 1, 'Only fixture setup may write orphan metadata');
});
test('a persistent Main review yields its cursor so the next timer can commit a healthy GOS identity batch', () => {
  const f = nativeFixture(), main = f.sources.get('Alyssa Main'); let heavy = 0;
  main.appendRow(valuesRow(f.headers, { 'Account': 'Alyssa Main', '客人姓名': 'Persistent review source', '電話': '10000002',
    '跟進狀態': '待跟進', 'Booking Registered At': '2026-10-01T00:00:00Z' }));
  const before = clone(main.state.matrix);
  f.script.set('OMNI_ARRIVAL_V2_CURSOR', '0');
  f.box.LockService = { getDocumentLock: () => ({ hasLock: () => true, tryLock: () => true, releaseLock() {} }) };
  f.box.oa3AdmitMaintenance_ = () => null; f.box.oa2ProcessAccount_ = () => { heavy++; throw Error('A bounded identity cycle must not add full maintenance'); };
  const first = f.box.omniArrivalV2Timer();
  assert.equal(first.review, true); assert.equal(f.script.get('OMNI_ARRIVAL_V2_CURSOR'), '1'); assert.equal(f.cell('Omni Lead ID'), '');
  const second = f.box.omniArrivalV2Timer();
  assert.equal(second.identityOnly, true); assert.equal(second.identity.bookedAdded, 1);
  assert.equal(f.script.get('OMNI_ARRIVAL_V2_CURSOR'), '4'); assert.equal(heavy, 0);
  assert.deepEqual(main.state.matrix, before); assert.ok(f.cell('Omni Lead ID'));
});

const identityNoteMarker = '【系統檢查・身份】未接納：';
const colleagueNote = '  同事原文第一行\r\n第二行  \n\n';
const statusCell = f => f.source.getRange(2, f.headers.indexOf('跟進狀態') + 1);
for (const [label, fields, phrase] of [
  ['unknown appointment', { 'Appointment ID': 'appt_unregistered_synthetic' }, '預約 ID 搵唔到對應紀錄'],
  ['orphan metadata', { 'Booking Registered At': '2026-10-01T00:00:00Z' }, '有預約歷史但缺少可核實身份'],
]) test(`a visible status note explains ${label}, preserves manual note bytes and leaves all cell values intact`, () => {
  const f = nativeFixture({ fields }), cell = statusCell(f); cell.setNote(colleagueNote);
  const before = clone(f.source.state.matrix), receipt = f.run();
  assert.ok(receipt.review > 0); assert.deepEqual(f.source.state.matrix, before);
  assert.ok(cell.getNote().startsWith(colleagueNote)); assert.ok(cell.getNote().includes(identityNoteMarker + phrase));
  for (const value of ['10000001', 'appt_unregistered_synthetic', 'Synthetic customer']) assert.equal(cell.getNote().includes(value), false);
  const first = cell.getNote(), writes = f.source.state.noteWrites.length; f.run();
  assert.equal(cell.getNote(), first); assert.equal(f.source.state.noteWrites.length, writes, 'Repeated review must not append duplicate system notes');
});
test('duplicated exact identity claims receive a specific visible rejection on both normal status cells', () => {
  const f = duplicatePointerFixture(), column = f.headers.indexOf('跟進狀態') + 1;
  f.source.getRange(2, column).setNote(colleagueNote); f.source.getRange(3, column).setNote('Other colleague original note');
  const before = clone(f.source.state.matrix); f.run();
  for (const row of [2, 3]) assert.ok(f.source.getRange(row, column).getNote().includes(identityNoteMarker + '多行同時聲稱同一預約身份'));
  assert.ok(f.source.getRange(2, column).getNote().startsWith(colleagueNote));
  assert.ok(f.source.getRange(3, column).getNote().startsWith('Other colleague original note'));
  assert.deepEqual(f.source.state.matrix, before);
});
test('a review note clears only after the same target has a successful registry/queue readback', () => {
  const f = nativeFixture({ fields: { 'Appointment ID': 'appt_unregistered_synthetic' } }), cell = statusCell(f);
  cell.setNote(colleagueNote); f.run(); const warning = cell.getNote(); assert.ok(warning.includes(identityNoteMarker));
  f.source.state.matrix[1][f.headers.indexOf('Appointment ID')] = '';
  let fail = true; f.registry.state.beforeWrite = () => { if (fail) throw Error('Synthetic incomplete booked commit'); };
  const interrupted = f.run(); assert.ok(interrupted.accountFailures.length > 0);
  assert.ok(cell.getNote().startsWith(colleagueNote));
  assert.ok(cell.getNote().includes(identityNoteMarker), 'Allocated ID or durable intent alone must not clear the rejection note');
  fail = false; const success = f.run();
  assert.equal(success.bookedAdded, 1); assert.equal(cell.getNote(), colleagueNote, 'Clear only the owned suffix; preserve every original manual byte');
  assert.equal(f.box.oa2ReadQueue_(f.ss, false).length, 1);
});
test('status-note CAS preserves a concurrent business edit and does not annotate a stale row', () => {
  const f = nativeFixture(), snap = f.box.oa2AccountSnapshot_(f.source, false), cell = statusCell(f);
  cell.setNote(colleagueNote); const writes = f.source.state.noteWrites.length;
  f.source.state.matrix[1][f.headers.indexOf('CS Remark')] = 'Concurrent colleague changed this row';
  f.box.oa2IdentityNotes_(f.source, snap.c, snap.records, snap.values, 2, snap.meta, 'unknown_appointment', false);
  assert.equal(cell.getNote(), colleagueNote); assert.equal(f.source.state.noteWrites.length, writes);
  assert.equal(f.cell('CS Remark'), 'Concurrent colleague changed this row');
});
test('status-note ownership guard does not label a different appointment after metadata-only ownership changes', () => {
  const f = nativeFixture({ fields: { 'Appointment ID': 'appt_unregistered_synthetic' } });
  const snap = f.box.oa2AccountSnapshot_(f.source, false), cell = statusCell(f); cell.setNote(colleagueNote);
  const writes = f.source.state.noteWrites.length;
  f.source.state.matrix[1][f.headers.indexOf('Omni Lead ID')] = 'lead_concurrent_owner';
  f.source.state.matrix[1][f.headers.indexOf('Appointment ID')] = 'appt_concurrent_owner';
  f.box.oa2IdentityNotes_(f.source, snap.c, snap.records, snap.values, 2, snap.meta, 'unknown_appointment', false);
  assert.equal(cell.getNote(), colleagueNote); assert.equal(f.source.state.noteWrites.length, writes);
});

function canonicalPartialAnchorFixture(changed) {
  const leadId = 'lead_canonical_owner';
  const current = appointment({ id: 'appt_canonical_current', leadId, queueId: 'queue_canonical_current', revision: 2,
    firstSeenAt: '2026-10-01T00:00:00Z', updatedAt: '2026-10-02T00:00:00Z' });
  const historical = appointment({ id: 'appt_canonical_history', leadId, queueId: 'queue_canonical_history', revision: 3,
    state: 'completed', outcome: 'Show', date: '2026-09-01', arrivalDate: '2026-09-01',
    firstSeenAt: '2026-08-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' });
  const f = nativeFixture({ fields: { 'Omni Lead ID': leadId, 'Appointment ID': current.id } });
  const retained = { [current.id]: clone(current), [historical.id]: clone(historical) };
  const appointments = clone(retained), updated = appointments[changed === 'current' ? current.id : historical.id];
  updated.revision++; updated.updatedAt = '2026-10-22T04:00:00Z';
  const events = changed === 'current'
    ? [['checkpoint_old_same_lead', '2026-10-22T03:00:00Z', historical.id, leadId, 'state_checkpoint', '{}', JSON.stringify(historical), 'commit_recovery'],
      ['changed_current', '2026-10-22T04:00:00Z', current.id, leadId, 'rescheduled', '{}', '{}', 'source_schedule_recovery']]
    : [['changed_history', '2026-10-22T04:00:00Z', historical.id, leadId, 'historical_evidence_recovered', '{}', '{}', 'commit_recovery']];
  const ctx = { appointments, original: Object.fromEntries(Object.entries(retained).map(([id, a]) => [id, JSON.stringify(a)])), events };
  const snap = f.box.oa2AccountSnapshot_(f.source, false);
  // Exercise the canonical durable writer rather than hand-building a snapshot.
  f.box.oa2WriteSourceAnchors_(snap, ctx);
  const saved = JSON.parse(f.cell('Pending Appointment Snapshot'));
  return { ...f, leadId, current, historical, retained, ctx, saved };
}
test('canonical changed-historical-only anchor replays with its unchanged current appointment retained in registry', () => {
  const f = canonicalPartialAnchorFixture('historical');
  assert.deepEqual(f.saved.appointments.map(a => a.id), [f.historical.id]);
  assert.equal(f.saved.currentAppointmentId, f.current.id); assert.equal(f.box.oa2ValidIdentityAnchor_(f.saved, 'GOS Beauty'), true);
  const replay = { appointments: clone(f.retained), events: [] };
  f.box.oa2ReplayAnchor_(replay, f.saved, f.leadId, 'GOS Beauty');
  assert.deepEqual(replay.appointments[f.current.id], f.retained[f.current.id]);
  assert.equal(replay.appointments[f.historical.id].revision, f.historical.revision + 1);
  f.box.oa2ReplayAnchor_(replay, f.saved, f.leadId, 'GOS Beauty'); assert.equal(replay.events.length, 1);
  const r = record({ leadId: '', appointmentId: f.current.id, pendingSnapshot: JSON.stringify(f.saved) });
  const decision = f.box.oa2ResolveMissingLeadIdentity_(r, { appointments: clone(f.retained), owners: {}, knownLeadIds: new Set() }, () => { throw Error('Exact recovery must not allocate'); });
  assert.equal(decision.action, 'recover'); assert.equal(decision.leadId, f.leadId); assert.equal(decision.appointmentId, f.current.id);
});
test('canonical changed-current anchor retains a prior same-Lead event outside its changed appointment subset', () => {
  const f = canonicalPartialAnchorFixture('current');
  assert.deepEqual(f.saved.appointments.map(a => a.id), [f.current.id]);
  assert.equal(f.saved.events[0][2], f.historical.id); assert.equal(f.box.oa2ValidIdentityAnchor_(f.saved, 'GOS Beauty'), true);
  const replay = { appointments: clone(f.retained), events: [] };
  f.box.oa2ReplayAnchor_(replay, f.saved, f.leadId, 'GOS Beauty');
  assert.deepEqual(replay.appointments[f.historical.id], f.retained[f.historical.id]);
  assert.equal(replay.appointments[f.current.id].revision, f.current.revision + 1);
  assert.equal(replay.events.length, 2); f.box.oa2ReplayAnchor_(replay, f.saved, f.leadId, 'GOS Beauty'); assert.equal(replay.events.length, 2);
});
for (const [field, value] of [['id', 'appt_foreign_checkpoint'], ['leadId', 'lead_foreign_checkpoint'], ['account', 'Alyssa Main']]) {
  test(`a foreign checkpoint snapshot ${field} is rejected before any registry, source identity or queue write`, () => {
    const a = appointment(), snapshot = { ...a, [field]: value }, intent = anchor(a);
    intent.events = [['foreign_checkpoint', '2026-10-22T04:00:00Z', a.id, a.leadId, 'state_checkpoint', '{}', JSON.stringify(snapshot), 'commit_recovery']];
    const f = nativeFixture({ fields: { 'Appointment ID': a.id, 'Pending Appointment Snapshot': JSON.stringify(intent) } });
    const before = clone(f.source.state.matrix), receipt = f.run();
    assert.equal(receipt.bookedAdded, 0); assert.ok(receipt.accountFailures.length > 0);
    assert.deepEqual(f.source.state.matrix, before); assert.equal(f.registry.state.writes.length, 0);
    assert.equal(f.queue.state.writes.length, 0); assert.equal(f.cell('Omni Lead ID'), '');
  });
}

// Synthetic cases above never contact Google or mutate production files.

if (failures.length) {
  process.stderr.write(JSON.stringify({ passed: tests.length, failed: failures.length, failures }, null, 2) + '\n');
  process.exitCode = 1;
} else process.stdout.write(JSON.stringify({ passed: tests.length, failed: 0, tests }, null, 2) + '\n');
