import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('./apps-script/arrival-source-reconciliation.gs',import.meta.url),'utf8');
const s={oa2Status_:v=>v==='已到店'?'show':v,oa2Outcome_:v=>v==='已到店'?'Show':v,oa2Date_:v=>v||'',oa2Time_:v=>v||'',oa2Text_:v=>v===undefined||v===null?'':String(v).trim(),
  oa2Hash_:v=>v,oa2StateView_:a=>({state:a.state,outcome:a.outcome}),oa2Event_:(ctx,a,type)=>ctx.events.push(type),OA2:{HEADER_ROW:7,FIRST_ROW:8}};
vm.createContext(s);vm.runInContext(source,s);
const record={leadId:'stable-lead',account:'GOS Beauty',customerKey:'GOS Beauty|p:20000001',status:'已到店',confirmedAt:'2026-10-01',date:'2026-10-01',time:'11:00',createdAt:'2026-09-30',phone:'20000001',name:'Synthetic',brand:'GOS Beauty',treatment:'Synthetic',branch:'Synthetic'};
const context=()=>({appointments:{},events:[],now:'2026-10-13T01:00:00Z',id:()=> 'stable-queue'});
let ctx=context(),r={...record};const a=s.oa2EnsureUnqueuedSourceShow_(ctx,r,[]);
assert.equal(a.outcome,'Show');assert.equal(a.arrivalDate,'2026-10-01');assert.equal(a.bookedAt,'');assert.equal(a.outcomeAt,'');assert.equal(a.queueId,'stable-queue');assert.equal(r.appointmentId,a.id);
assert.equal(s.oa2EnsureUnqueuedSourceShow_(ctx,r,[]),null);assert.equal(ctx.events.length,1);
ctx=context();const missing=s.oa2EnsureUnqueuedSourceShow_(ctx,{...record,confirmedAt:''},[]);assert.equal(missing.arrivalDate,'','Never substitute scheduled/updated/current date');
ctx=context();r={...record,appointmentId:'old'};ctx.appointments.old={...a,id:'old',state:'unscheduled',outcome:'',arrivalDate:'',queueId:''};
assert.equal(s.oa2EnsureUnqueuedSourceShow_(ctx,r,[]).id,'old','A previously unscheduled appointment keeps its identity');
for(const state of ['canceled','completed','reschedule_requested','superseded']) {
  ctx=context();ctx.appointments.old={...a,id:'old',state,outcome:state==='completed'?'No Show':''};
  assert.equal(s.oa2EnsureUnqueuedSourceShow_(ctx,{...record,appointmentId:'old'},[]),null);assert.equal(ctx.events.length,0);
}
ctx=context();assert.equal(s.oa2EnsureUnqueuedSourceShow_(ctx,{...record},[{account:record.account,customerKey:record.customerKey,outcome:'已到店',arrivalDate:record.confirmedAt}]),null,'Existing historical visit is not duplicated');
ctx=context();ctx.appointments.old={...a,id:'old',state:'active',outcome:''};assert.equal(s.oa2EnsureUnqueuedSourceShow_(ctx,{...record,appointmentId:'old'},[{appointmentId:'old'}]),null,'Staff-owned queue outcome remains authoritative');
ctx=context();ctx.appointments.old={...a,id:'old',account:'Other Account',state:'completed',outcome:'Show'};
assert.equal(s.oa2IsHistoricalCrossAccountRecord_(ctx,{...record,appointmentId:'old'}),true,'A completed visit stays with its existing owner after its source row moves');
ctx.appointments.old.outcome='';assert.equal(s.oa2IsHistoricalCrossAccountRecord_(ctx,{...record,appointmentId:'old'}),false,'An open appointment still uses normal verified transfer');
const sheet={getLastColumn:()=>5,getRange:(row,col,n,w)=>({getDisplayValues:()=>[['Account','來源','試做價','開單金額','總金額']],getValues:()=>[[...['GOS Beauty','',0,'',''].slice(col-1,col-1+w)]]})};
assert.equal(s.oa2QueueRowHasManualData_(sheet,10),true,'An entered zero prevents blank-slot reuse');
console.log('PASS: direct Show creates a stable queue owner, missing actual dates stay blank, unscheduled identity is retained, existing outcomes/history stay authoritative, repeat repair is idempotent and manual zero blocks allocation');
