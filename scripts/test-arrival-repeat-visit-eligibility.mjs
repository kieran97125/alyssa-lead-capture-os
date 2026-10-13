import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const candidate = readFileSync(new URL('./apps-script/arrival-repeat-visit-reviewed-functions.gs',import.meta.url),'utf8');
const bridge = readFileSync(new URL('./apps-script/arrival-source-reconciliation.gs', import.meta.url),'utf8');
const account='Synthetic Account', phone='20000001';
let sequence=0, planned=[], queue=[];
const ctx={appointments:{},events:[],errors:[],now:'2026-10-13T08:00:00Z',today:'2026-10-13',dryRun:true,id:type=>type+'-'+(++sequence)};
const make=(leadId,status,date,time='10:00')=>({row:sequence+2,meaningful:true,account,phone,fullPhone:'852'+phone,customerKey:account+'|p:'+phone,leadId,status,date,time,confirmedAt:status==='已到店'?date:'',updatedAt:'2026-10-13',name:'Synthetic',brand:'Synthetic Brand',isCurrent:false});
const records=[make('visit-a','已預約','2026-10-20'),make('visit-b','已預約','2026-10-20'),make('visit-undated','已預約',''),make('visit-show','已到店','2026-10-12'),make('enquiry','待跟進','')];
ctx.appointments.finished={id:'finished',leadId:'visit-finished',account,phone,customerKey:account+'|p:'+phone,state:'completed',outcome:'No Show',date:'2026-10-10',time:'10:00',lastSchedule:'2026-10-10|10:00',lastStatus:'no_show',provenance:'observed_booking_edit',firstSeenAt:'2026-10-10',revision:1,queueId:''};
records.push({...make('visit-finished','已到店','2026-10-10'),appointmentId:'finished'});
ctx.appointments.canceled={...ctx.appointments.finished,id:'canceled',leadId:'visit-canceled',state:'canceled',outcome:'',lastStatus:'booked'};
records.push({...make('visit-canceled','已預約','2026-10-10'),appointmentId:'canceled'});
const initialSelection=records.map(r=>r.isCurrent);
const text=v=>v===undefined||v===null?'':String(v).trim();
const sandbox={console:{log(){}},OMNI_ACCOUNT_TABS:[account],OA2:{HEADER_ROW:7,FIRST_ROW:8},
 oa2Text_:text,oa2Date_:text,oa2Time_:text,oa2Outcome_:v=>v==='已到店'?'Show':v,
 oa2Status_:v=>({'已預約':'booked','已到店':'show','待跟進':'follow_up'}[v]||v),oa2Hash_:v=>v,
 oa2StateView_:a=>({state:a.state,outcome:a.outcome,date:a.date,revision:a.revision}),
 oa2Event_:(c,a,type)=>c.events.push({appointmentId:a.id,type}),oa2QueueState_:a=>a.outcome||'待到店',
 oa2SetPendingArrivalDate_:()=>{},omniEditStage_:(trace,name,fn)=>fn(),oa2Context_:()=>ctx,
 oa2AccountSnapshot_:()=>({records,c:{},deferredRows:new Set()}),oa2ReadQueue_:()=>queue,
 oa2ReplaySourceAnchors_:()=>{},oa2RehomeMovedAccountAppointments_:()=>{},oa2AbsorbWorkerQueueInputs_:()=>new Set(),
 oa2FilterQueueOps_:(c,q,ops)=>{planned=ops;return ops;},oa2Commit_:()=>{throw new Error('Dry-run attempted a write');}
};
vm.createContext(sandbox);vm.runInContext(bridge+'\n'+candidate,sandbox);
let result=sandbox.oa2ProcessAccount_({}, {getName:()=>account},'scan',null,true);
assert.equal(result.newQueue,4,'Both same-phone/same-day bookings, an undated booking and a non-current Show must reach the register');
const appointmentIds=records.slice(0,4).map(r=>r.appointmentId);
assert.equal(new Set(appointmentIds).size,4,'Distinct source visits keep distinct owners');
assert.equal(ctx.appointments[appointmentIds[2]].date,'','Missing appointment dates stay blank');
assert.equal(ctx.appointments[appointmentIds[3]].outcome,'Show');
assert.equal(records[4].appointmentId,undefined,'An enquiry is not turned into an appointment');
assert.equal(ctx.appointments.finished.outcome,'No Show','Registered outcomes remain authoritative');
assert.equal(ctx.appointments.canceled.state,'canceled','Historical cancellations are preserved');
assert.deepEqual(records.map(r=>r.isCurrent),initialSelection,'Arrival eligibility must not rewrite person-level reporting selection');
queue=planned.filter(op=>op.kind==='append').map((op,i)=>({row:i+8,appointmentId:op.appt.id,entryId:op.appt.queueId,origin:'managed'}));
result=sandbox.oa2ProcessAccount_({}, {getName:()=>account},'scan',null,true);
assert.equal(result.newQueue,0,'Repeated synchronization does not duplicate the same appointments');
assert.deepEqual(records.slice(0,4).map(r=>r.appointmentId),appointmentIds);

const a={account,leadId:'label-owner',customerKey:account+'|p:'+phone,phone,name:'Synthetic Name'};
assert.equal(sandbox.oa2QueueLabel_(a,{account,leadId:a.leadId,fullPhone:'852'+phone,name:'New Name'}),account+' · 電話 852'+phone);
assert.equal(sandbox.oa2QueueLabel_(a),account+' · 電話尾8 '+phone,'Verified registry phone remains usable without the source snapshot');
assert.equal(sandbox.oa2QueueLabel_(a,{account,leadId:'other-owner',fullPhone:'85299999999'}),account+' · 電話尾8 '+phone,'Another source owner cannot supply the phone');
assert.equal(sandbox.oa2QueueLabel_({...a,phone:'99999999'}),account+' · 客人 Synthetic Name','A mismatched registry phone is not presented as verified');
assert.equal(sandbox.oa2QueueLabel_({...a,phone:'',name:'',customerKey:account+'|e:synthetic@example.test'}),account+' · Email synthetic@example.test');
assert.equal(sandbox.oa2QueueLabel_({...a,phone:'',name:'',customerKey:account+'|i:synthetic_profile'}),account+' · IG/FB synthetic_profile');
assert.equal(sandbox.oa2QueueLabel_({...a,phone:'',name:'',customerKey:account+'|row:8'}),account+' · 未填聯絡資料');
console.log('PASS: every distinct repeated visit; same-day and undated bookings; non-current Show; idempotency; preserved outcomes/cancellations/reporting selection; owner-bound phone display');
