import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const native=createRequire(import.meta.url),cache=new Map();
function load(path){if(cache.has(path))return cache.get(path).exports;const m={exports:{}};cache.set(path,m);new Function('require','module','exports',ts.transpileModule(readFileSync(new URL('../'+path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(n=>n.startsWith('@/')?load('src/'+n.slice(2)+'.ts'):native(n),m,m.exports);return m.exports;}
const p=load('src/lib/marketing/leadPendingAppointmentAuthority.ts'),a=load('src/lib/marketing/leadArrivalOutcomeAuthority.ts'),parser=load('src/lib/marketing/googleSheetsMetricParser.ts'),math=load('src/lib/marketing/leadDashboardMath.ts');
const headers=['最後更新日期','Created At','跟進狀態','品牌','Account','電話','預約日期','確認到店日期','療程項目'];
const brands=[{id:'a',name:'Alyssa',slug:'alyssa'},{id:'m',name:'Aesthetics Medical',slug:'aesthetics-medical'}];
const rows=Array.from({length:6},(_,i)=>['2026-10-02','2026-10-01','已預約','Alyssa','Alyssa Main',String(10000001+i),'2026-10-09','','Historical treatment']);
// Later current treatment and brand must own pending filters while funnel dimensions remain historical.
rows.push(['2026-10-03','2026-10-02','已預約','Aesthetics Medical','Alyssa Main','10000006','2026-10-11','','Current treatment']);
const bridge=[p.PENDING_BRIDGE_HEADERS,...rows.map((r,i)=>['source_'+i,'Alyssa Main|p:'+r[5],i+2,true,i===5?'':i===6?'':'appt_'+i,true,true,true])];
const registry=[p.PENDING_REGISTRY_HEADERS,...Array.from({length:5},(_,i)=>{const r=Array(27).fill('');Object.assign(r,{0:'appt_'+i,1:'source_'+i,2:'Alyssa Main',10:i===3?'2026-11-01':'2026-10-10',14:i===2?'canceled':i<2?'completed':'active',15:i===0?'Show':i===1?'No Show':''});return r;})];
const facts=[a.ARRIVAL_METRIC_HEADERS,...Array.from({length:6},(_,i)=>['Alyssa Main|p:'+rows[i][5],'Alyssa Main','Alyssa','Historical treatment','2026-10-01','2026-10-02',i===0||i===4?'2026-10-05':'',i===1?'2026-10-06':'',0,0,0,i+2])];
const input={headers,rows,brands,sourceBrandId:null,arrivalOutcomeAuthority:a.parseLeadArrivalOutcomeAuthority(facts)};
const build=(b=bridge,r=registry)=>parser.buildLeadSheetGroups({...input,pendingAppointmentAuthority:p.parseLeadPendingAppointmentAuthority(b,r)});
const parsed=build();
const statuses=load('src/lib/marketing/appointmentStatusSummary.ts');
const statusFilters={startDate:'2026-10-01',endDate:'2026-10-31',accountId:'',brandId:'',treatment:''};
const canceledSummary=statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:parsed.groups,brands,filters:statusFilters});
assert.equal(canceledSummary.available,true);
assert.equal(canceledSummary.cancellations,1);
assert.equal(canceledSummary.reschedules,0);
const changedRegistry=structuredClone(registry);changedRegistry[3][14]='reschedule_requested';
const changed=build(bridge,changedRegistry);
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:changed.groups,brands,filters:statusFilters}).reschedules,1);
assert.equal(changed.groups[2].pendingAppointment,null,'Requested reschedule must not count pending');
changedRegistry[3][14]='active';
const restored=build(bridge,changedRegistry);
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:restored.groups,brands,filters:statusFilters}).reschedules,0);
assert.ok(restored.groups[2].pendingAppointment,'Reconfirmed appointment returns to pending');
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:parsed.groups,brands,filters:{...statusFilters,endDate:'2026-10-09'}}).cancellations,0);
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:parsed.groups,brands,filters:statusFilters,allowedBrandIds:['m']}).cancellations,0);
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:parsed.groups,brands,filters:{...statusFilters,accountId:'gos-beauty'}}).cancellations,0);
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:parsed.groups,brands,filters:statusFilters,source:'not-selected'}).cancellations,0);
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:parsed.groups,brands,filters:statusFilters,campaign:'not-selected'}).cancellations,0);
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:[...parsed.groups,parsed.groups[2]],brands,filters:statusFilters}).cancellations,1);
const missingSchedule=structuredClone(parsed.groups);missingSchedule[2].appointmentStatus.appointmentDate=null;
const undated=statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:missingSchedule,brands,filters:statusFilters});
assert.equal(undated.undated,1);assert.equal(undated.cancellations,0);
const legacy=structuredClone(parsed.groups);delete legacy[0].appointmentStatus;
assert.equal(statuses.buildAppointmentStatusSummary({projectionVersion:parsed.appointmentStatusProjection,groups:legacy,brands,filters:statusFilters}).available,false,'Legacy snapshot cannot display a false zero');
const emptyProjection=parser.buildLeadSheetGroups({...input,rows:[],arrivalOutcomeAuthority:a.parseLeadArrivalOutcomeAuthority([a.ARRIVAL_METRIC_HEADERS]),pendingAppointmentAuthority:p.parseLeadPendingAppointmentAuthority([p.PENDING_BRIDGE_HEADERS],[p.PENDING_REGISTRY_HEADERS])});
assert.equal(emptyProjection.appointmentStatusProjection,'current-appointment-v1');
assert.equal(statuses.buildAppointmentStatusSummary({groups:[],brands,filters:statusFilters}).available,false,'Empty legacy snapshot remains unavailable');
assert.equal(statuses.buildAppointmentStatusSummary({groups:emptyProjection.groups,projectionVersion:emptyProjection.appointmentStatusProjection,brands,filters:statusFilters}).available,true,'Refreshed empty projection is a verified zero');
assert.equal(parsed.groups.length,6);
assert.deepEqual(parsed.groups.map(g=>g.pendingAppointment?.appointmentDate??null),[null,null,null,'2026-11-01','2026-10-10','2026-10-11']);
assert.equal(parsed.groups[4].showDate,'2026-10-05','Prior Show does not cancel a later active appointment');
const filters={startDate:'2026-10-01',endDate:'2026-10-31',accountId:'',brandId:'',treatment:''};
const model=math.buildLeadDashboardModel({groups:parsed.groups,brands,filters});
assert.deepEqual([model.totals.leads,model.totals.bookings,model.totals.shows,model.totals.noShows,model.totals.outstanding],[6,6,2,1,2]);
assert.equal(model.outstandingRows.length,2);
const current=math.buildLeadDashboardModel({groups:parsed.groups,brands,filters:{...filters,brandId:'m',treatment:'Current treatment'}});
assert.equal(current.totals.outstanding,1);assert.equal(current.totals.leads,0);assert.equal(current.outstandingRows[0].treatmentLabel,'Current treatment');
const restricted=math.buildLeadDashboardModel({groups:parsed.groups,brands,filters,allowedBrandIds:['a']});assert.equal(restricted.totals.outstanding,1);assert.ok(restricted.outstandingRows.every(r=>r.brandId==='a'));
const trend=math.buildLeadDashboardTrend({groups:parsed.groups,brands,filters,brandColors:{},annotations:[]});assert.equal(trend.flatMap(s=>s.points).reduce((n,r)=>n+r.pendingShows,0),2);
const performance=parser.aggregateLeadSheetPerformance({...input,pendingAppointmentAuthority:p.parseLeadPendingAppointmentAuthority(bridge,registry),dailyThroughDate:'2026-10-31',activityThroughDate:'2026-10-31',pendingThroughDate:'2026-12-31'});
assert.equal(performance.metricFacts.filter(f=>f.metricKind==='pending_show').reduce((n,f)=>n+f.count,0),3);assert.ok(performance.metricFacts.some(f=>f.metricKind==='pending_show'&&f.brandId==='m'&&f.treatmentLabel==='Current treatment'));
let rejected=0;
for(const mutate of [
 b=>b.pop(),b=>b.push(b[1]),b=>{b[1][5]=false;},b=>{b[1][7]=false;},b=>{b[1][1]='Alyssa Main|p:99999999';},b=>{b[1][4]='unknown';},b=>{b[1][0]='wrong-owner';},b=>{b[1][3]=false;},b=>{b[0][0]='obsolete';}
]){const b=structuredClone(bridge);mutate(b);assert.throws(()=>build(b),/暫時未能確認/);rejected++;}
for(const mutate of [r=>r.push(r[1]),r=>{r[1][1]='wrong-owner';},r=>{r[1][2]='GOS Beauty';},r=>{r[1][10]='2026-02-30';},r=>{r[1][14]='unknown-state';}]){const r=structuredClone(registry);mutate(r);assert.throws(()=>build(bridge,r));rejected++;}
console.log(`PASS: current appointment state/outcome/schedule, rebooking, whole-day latest identity, legacy fallback, independent current dimensions, permission-filtered KPI/detail/trend/facts, ${rejected} fail-closed corrupt/truncated projections`);

// External/Omi API inserts do not trigger native onEdit. An unscheduled enquiry
// can be counted before row-ID registration, without accepting appointment data.
const newRows=[['2026-10-07','2026-10-07','待跟進','Alyssa','Alyssa Main','10000901','','','New enquiry']];
const pendingBridge=[p.PENDING_BRIDGE_HEADERS,['','Alyssa Main|p:10000901',2,false,'',true,true,false]];
const newFacts=[a.ARRIVAL_METRIC_HEADERS,['Alyssa Main|p:10000901','Alyssa Main','Alyssa','New enquiry','2026-10-07','','','',0,0,0,2]];
const newInput={headers,rows:newRows,brands,sourceBrandId:null,arrivalOutcomeAuthority:a.parseLeadArrivalOutcomeAuthority(newFacts)};
const preRegistration=parser.buildLeadSheetGroups({...newInput,pendingAppointmentAuthority:p.parseLeadPendingAppointmentAuthority(pendingBridge,[p.PENDING_REGISTRY_HEADERS])});
const registeredBridge=structuredClone(pendingBridge);Object.assign(registeredBridge[1],{0:'source-new',3:true,7:true});
const postRegistration=parser.buildLeadSheetGroups({...newInput,pendingAppointmentAuthority:p.parseLeadPendingAppointmentAuthority(registeredBridge,[p.PENDING_REGISTRY_HEADERS])});
const liveFilters={...filters,startDate:'2026-10-07',endDate:'2026-10-07'};
assert.deepEqual(math.buildLeadDashboardModel({groups:preRegistration.groups,brands,filters:liveFilters}).totals,
  math.buildLeadDashboardModel({groups:postRegistration.groups,brands,filters:liveFilters}).totals,
  'Registering the row ID must not change any metric');
assert.equal(preRegistration.groups.length,1);assert.equal(preRegistration.groups[0].pendingAppointment,null);
for(const change of [r=>{r[2]='已預約';},r=>{r[6]='2026-10-09';},r=>{r[7]='2026-10-07';}]) {
 const changed=structuredClone(newRows);change(changed[0]);
 assert.throws(()=>parser.buildLeadSheetGroups({...newInput,rows:changed,pendingAppointmentAuthority:p.parseLeadPendingAppointmentAuthority(pendingBridge,[p.PENDING_REGISTRY_HEADERS])}),e=>e.reason==='bridge_registration_pending');
}
for(const change of [b=>{b[1][5]=false;},b=>{b[1][1]='GOS Beauty|p:10000901';},b=>{b[1][4]='appt-unowned';},b=>{b[1][0]='duplicate-present-id';}]) {
 const corrupt=structuredClone(pendingBridge);change(corrupt);
 assert.throws(()=>parser.buildLeadSheetGroups({...newInput,pendingAppointmentAuthority:p.parseLeadPendingAppointmentAuthority(corrupt,[p.PENDING_REGISTRY_HEADERS])}));
}
console.log('PASS: new unscheduled enquiry syncs before ID registration; metrics stable after registration; appointment evidence, Account mismatch, inconsistent flags and master drift still rejected.');
