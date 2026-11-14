const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const release = process.argv[2] || path.join(__dirname, 'apps-script/releases/20261028');
const box = { console: { log() {} } };
vm.createContext(box);
for (const name of ['native-main.gs', 'arrival-integrity.gs', 'arrival-workflow.gs'])
  vm.runInContext(fs.readFileSync(path.join(release, name), 'utf8'), box);
const baseHeaders = vm.runInContext('OA2_QUEUE_BASE_HEADERS.concat(OA2.QUEUE_HEADERS)', box);
const headers = Array.from(baseHeaders);
headers.splice(1, 0, 'CS同事名');
headers.unshift('品牌', '電話');
headers.push('到店優先排序（內部）', '來源', '試做價', '開單金額', '總金額');
const col = name => headers.indexOf(name);
assert.ok(col('CS同事名') >= 0 && col('總金額') >= 0);
function fixture(entries = {}) {
  const row = Array(headers.length).fill('');
  for (const [name, value] of Object.entries(entries)) row[col(name)] = value;
  const sheet = {
    getLastRow: () => 8, getLastColumn: () => headers.length, getMaxColumns: () => headers.length,
    getRange(r, c, n = 1, w = 1) {
      const values = () => Array.from({length:n}, (_, i) => (r+i === 7 ? headers : row).slice(c-1,c-1+w));
      return {getValues: values, getDisplayValues: () => values().map(r => r.map(v => String(v ?? '')))};
    },
  };
  return { row, sheet, ss: {getSheetByName: () => sheet} };
}
let cases = 0;
for (const [name, value] of [
  ['CS同事名', 'Colleague A'], ['來源', 'Organic'], ['試做價', 0],
  ['開單金額', 0], ['總金額', 123.45], ['總金額', -12.34],
  ['總金額', 'HK$1,234.50'], ['總金額', '#REF!'],
]) {
  const f = fixture({[name]:value}), queue = box.oa2ReadQueue_(f.ss, false);
  assert.equal(queue[0].blank, false, name + ' must reserve its existing row');
  assert.equal(queue[0].manualEntered, true);
  assert.equal(box.oa2QueueRowHasManualData_(f.sheet,8), true, 'Writer must recheck ' + name);
  const appointment = {id:'synthetic-new-appointment',queueId:'synthetic-new-queue'};
  const op = {kind:'append',appt:appointment};
  box.oa2AllocateQueue_(f.ss,{appointments:{[appointment.id]:appointment},id:()=> 'synthetic-id'},queue,[op]);
  assert.equal(op.row,9,'A new appointment cannot inherit occupied ' + name);
  assert.throws(() => box.oa3SnapshotValues_(headers,[f.row]), /Unowned colleague input/);
  cases++;
}
for (const total of ['',0,'0.00','HK$0.00']) {
  const f = fixture({'總金額':total}), queue = box.oa2ReadQueue_(f.ss,false);
  assert.equal(queue[0].blank,true,'Unused zero-total templates stay available');
  assert.equal(box.oa2QueueRowHasManualData_(f.sheet,8),false);
  assert.doesNotThrow(() => box.oa3SnapshotValues_(headers,[f.row]));
  cases++;
}
const a = fixture({'Appointment ID':'synthetic-a','到店紀錄ID（內部）':'queue-a','CS同事名':'Colleague A','總金額':123.45}).row;
const b = fixture({'Appointment ID':'synthetic-b','到店紀錄ID（內部）':'queue-b','CS同事名':'Colleague B','試做價':10,'開單金額':20,'總金額':30}).row;
const before = box.oa3SnapshotValues_(headers,[a,b]);
assert.deepEqual(box.oa3SnapshotValues_(headers,[b,a]),before,'Whole-row sorting preserves every owned entry');
const corrupt = a.slice(); corrupt[col('總金額')] = 999;
assert.notDeepEqual(box.oa3SnapshotValues_(headers,[corrupt,b]),before,'Sort verification must include the authoritative total');
const snapshot = box.oa2ArrivalManualSnapshot_(fixture({'Appointment ID':'synthetic-a','CS同事名':'Colleague A','總金額':123.45}).sheet);
assert.equal(snapshot['synthetic-a'].at(-1),123.45,'Manual backup includes the total');
console.log('PASS: '+cases+' owned-input/empty-template cases, safe allocation, CS/total sort checks and keyed backup; synthetic VM only');
