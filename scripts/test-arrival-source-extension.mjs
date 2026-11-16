import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Verify the saved native producer, not a second implementation of its writer.
// The native source must remain private and is supplied as a local readback file.
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/test-arrival-source-extension.mjs <saved-native-source.gs>');
const source = fs.readFileSync(sourcePath, 'utf8');
const cells = Array.from({length: 24}, () => Array(29).fill(''));
const writes = [];
const sheet = {
  getLastColumn: () => 29, getMaxColumns: () => 29,
  getLastRow: () => 20, getMaxRows: () => cells.length,
  getRange(row, column, height = 1, width = 1) {
    return {
      getValues: () => cells.slice(row - 1, row - 1 + height).map(r => r.slice(column - 1, column - 1 + width)),
      getDisplayValues: () => cells.slice(row - 1, row - 1 + height).map(r => r.slice(column - 1, column - 1 + width).map(String)),
      setValues(values) {
        assert.equal(values.length, height);
        values.forEach((values, i) => {assert.equal(values.length, width); values.forEach((v, j) => {cells[row - 1 + i][column - 1 + j] = v;});});
        writes.push({row, column, height, width}); return this;
      },
      clearDataValidations() {return this;}, setNumberFormat() {return this;}, setDataValidation() {return this;},
    };
  },
};
const validation = {requireValueInList() {return this;}, setAllowInvalid() {return this;}, build() {return this;}};
const context = vm.createContext({console, Date, Set, Map, JSON,
  Utilities: {formatDate: (date, zone, pattern) => {
    assert.equal(zone, 'Asia/Hong_Kong');
    const local = new Date(date.getTime() + 8 * 3600000).toISOString();
    return pattern === 'HH:mm' ? local.slice(11, 16) : local.slice(0, 10);
  }},
  SpreadsheetApp: {newDataValidation: () => validation},
});
vm.runInContext(source, context);
const headers = [...vm.runInContext('OA2_QUEUE_BASE_HEADERS.concat(OA2.QUEUE_HEADERS)', context)];
headers.splice(1, 0, 'CS同事名');
headers.push('到店優先排序（內部）', '來源');
assert.equal(headers.length, 29);
cells[6] = headers;
const ss = {getSheetByName: () => sheet};
const ctx = {today: '2026-10-07', dryRun: false, appointments: {}};
const appt = (id, leadId = 'synthetic-lead-' + id) => ({
  id, leadId, account: 'Synthetic Account', customerKey: 'Synthetic Account|' + leadId,
  queueId: 'queue-' + id, date: '2026-10-10', time: '13:00', state: 'active',
  outcome: '', arrivalDate: '', outcomeAt: '', bookedAt: '', revision: 1,
  pendingArrivalOverride: 'scheduled', phone: '', name: '', treatment: 'Synthetic item', branch: '',
});
const a = appt('a'), b = appt('b'), c = appt('c');
const layout = context.oa2QueueLayout_(sheet, false);
assert.equal(layout.width, 27, 'trailing source must not extend the managed write contract');
function seed(row, a, source) {
  ctx.appointments[a.id] = a;
  const logical = Array(26).fill('');
  Object.assign(logical, {0: 'Synthetic booking', 1: context.oa2NativeDate_(a.date), 2: context.oa2NativeTime_(a.time), 3: '待到店', 4: context.oa2NativeDate_(a.date), 7: a.account, 16: a.customerKey, 17: a.queueId});
  logical.splice(19, 7, ...context.oa2QueueMetadata_(a, 'managed', ctx));
  logical.forEach((v, i) => {cells[row - 1][layout.columns[i] - 1] = v;});
  cells[row - 1][1] = 'Synthetic CS';
  cells[row - 1][27] = 'sort sentinel';
  cells[row - 1][28] = source;
}
seed(8, a, 'AD'); seed(9, b, 'KOL');
let queue = context.oa2ReadQueue_(ss, false);
a.date = '2026-10-12'; a.revision++;
ctx.appointments[c.id] = c;
context.oa2WriteQueue_(ss, ctx, queue, [{kind: 'refresh', row: 8, appt: a}, {kind: 'append', row: 10, appt: c}], []);
assert.equal(cells[7][28], 'AD'); assert.equal(cells[8][28], 'KOL'); assert.equal(cells[9][28], '');
assert.equal(cells[7][20], a.id); assert.equal(cells[8][20], b.id); assert.equal(cells[9][20], c.id);
assert.equal(cells[7][1], 'Synthetic CS'); assert.equal(cells[7][27], 'sort sentinel');
// A later manual choice survives an outcome refresh on the same appointment.
cells[9][28] = 'OG'; queue = context.oa2ReadQueue_(ss, false);
c.outcome = 'Show'; c.state = 'completed'; c.arrivalDate = c.date; c.revision++;
context.oa2WriteQueue_(ss, ctx, queue, [{kind: 'refresh', row: 10, appt: c}], []);
assert.equal(cells[9][28], 'OG'); assert.equal(cells[9][20], c.id);
cells[9][28] = ''; queue = context.oa2ReadQueue_(ss, false);
context.oa2WriteQueue_(ss, ctx, queue, [{kind: 'refresh', row: 10, appt: c}], []);
assert.equal(cells[9][28], '');
// Source edits must not execute outcome processing or alter metric dates.
context.oa2Enabled_ = () => true;
assert.equal(context.omniArrivalV2QueueEdit_({range: {getLastRow: () => 8, getColumn: () => 29, getLastColumn: () => 29}}, {lockHeld: true, name: '到店紀錄', sheet}), true);
assert.ok(writes.every(w => w.column + w.width - 1 <= 27));
// A changed owner still rejects the refresh, preserving the source tag.
queue = context.oa2ReadQueue_(ss, false); cells[7][20] = 'wrong-owner';
assert.throws(() => context.oa2WriteQueue_(ss, ctx, queue, [{kind: 'refresh', row: 8, appt: a}], []), /stable-ID bindings/);
assert.equal(cells[7][28], 'AD');
console.log('PASS: manual AD/KOL/OG retention across schedule/outcome refresh, blank new booking, deliberate clear, unchanged CS/helper/owner, source-only edit fast path and ownership-race rejection');
