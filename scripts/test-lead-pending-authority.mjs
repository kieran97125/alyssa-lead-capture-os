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
