import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';

// Run the saved native producer and current App projection using synthetic data.
const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/test-pending-schedule-date-recovery.mjs <saved-native-source.gs>');
const ctx = vm.createContext({console, Date, Map, Set, JSON,
  Utilities: {formatDate: (date, zone) => {
    assert.equal(zone, 'Asia/Hong_Kong');
    return new Date(date.getTime() + 8 * 3600000).toISOString().slice(0,10);
  }},
});
vm.runInContext(readFileSync(sourcePath, 'utf8'), ctx);
assert.equal(ctx.oa2Date_(46307), '2026-10-12');
assert.equal(ctx.oa2Date_('12/10/2026'), '2026-10-12');
assert.equal(ctx.oa2Date_('2026-10-12'), '2026-10-12');
assert.equal(ctx.oa2Date_(new Date('2026-10-12T00:00:00+08:00')), '2026-10-12');

const a = {id:'synthetic-a', leadId:'synthetic-lead', account:'Alyssa Main', date:'2026-12-10',
  time:'14:30', state:'active', outcome:'', arrivalDate:'', revision:2, queueId:'synthetic-queue',
  lastSchedule:'2026-12-10|14:30', pendingQueueBefore:'', pendingArrivalOverride:'scheduled'};
const q = {appointmentId:a.id, entryId:a.queueId, origin:'managed', date:46307, time:'14:30', outcome:'待到店', arrivalDate:46307};
const state = {appointments:{[a.id]:a}, errors:[], events:[]};
assert.equal(ctx.oa2AbsorbWorkerQueueInputs_(state,[q]).size,1,
  'Worker must preserve a conflicting queue rather than guess a new schedule');
const corrected = {...a, date:'2026-10-12', lastSchedule:'2026-10-12|14:30', revision:3};
assert.equal(ctx.oa2QueueInputMatches_(q,corrected),true);
assert.equal(ctx.oa2AbsorbWorkerQueueInputs_({appointments:{[a.id]:corrected},errors:[],events:[]},[q]).size,0);
const history = [[],[],[],[], 'state_checkpoint', '{}', JSON.stringify(a), 'synthetic'];
ctx.oa2ExactHeaders_ = () => {};
ctx.oa2HistoryStart_ = () => 2;
const ss = {getSheetByName: () => ({getLastRow: () => 2, getRange: () => ({getValues: () => [history]})})};
const registry = {appointments:{[a.id]:structuredClone(corrected)}};
ctx.oa2ReplayCheckpoints_(ss,registry);
assert.equal(registry.appointments[a.id].date,'2026-10-12', 'Old journal cannot rewind a higher corrected revision');
history[6] = JSON.stringify(corrected); registry.appointments[a.id] = structuredClone(a);
ctx.oa2ReplayCheckpoints_(ss,registry);
assert.equal(registry.appointments[a.id].date,'2026-10-12', 'Corrected checkpoint recovers the repaired schedule');

const native = createRequire(import.meta.url), cache = new Map();
function load(path) {
  if (cache.has(path)) return cache.get(path).exports;
  const m = {exports:{}}; cache.set(path,m);
  new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),
    {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(
    n=>n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):native(n),m,m.exports);
  return m.exports;
}
const pending = load('src/lib/marketing/leadPendingAppointmentAuthority.ts');
const groups = Array.from({length:18},(_,i)=>({key:'alyssa-main:phone:'+String(10000001+i),accountId:'alyssa-main',accountLabel:'Alyssa Main',
  rows:[{rowNumber:i+2,status:'booked',lastUpdatedDate:'2026-10-07',createdDate:'2026-10-01',appointmentDate:'2026-10-12'}]}));
const bridge = [pending.PENDING_BRIDGE_HEADERS,...groups.map((g,i)=>['synthetic-source-'+i,'Alyssa Main|p:'+String(10000001+i),i+2,true,'synthetic-appt-'+i,true,true,true])];
const ledger = [pending.PENDING_REGISTRY_HEADERS,...groups.map((g,i)=>{
  const row=Array(27).fill(''); Object.assign(row,{0:'synthetic-appt-'+i,1:'synthetic-source-'+i,2:'Alyssa Main',10:i<2?'2026-12-10':'2026-10-12',14:'active'}); return row;
})];
const dims = new Map(groups.map(g=>[g.rows[0].rowNumber,{brandId:'a',brandLabel:'Alyssa',treatmentLabel:'Synthetic'}]));
const count = () => pending.applyLeadPendingAppointmentAuthority(groups,pending.parseLeadPendingAppointmentAuthority(bridge,ledger),dims)
  .filter(g=>g.pendingAppointment?.appointmentDate.startsWith('2026-10')).length;
assert.equal(count(),16, 'App correctly excludes the two December registry dates');
ledger[1][10]='2026-10-12'; ledger[2][10]='2026-10-12';
assert.equal(count(),18, 'Correcting authoritative schedules restores October parity without changing App counting');
console.log('PASS: native date formats, safe conflict deferral, corrected queue agreement, journal recovery and current App 16-to-18 monthly projection');
