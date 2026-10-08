import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('./apps-script/account-transfer-recovery.gs',import.meta.url),'utf8');
const sandbox={OMNI_ACCOUNT_TABS:['Alyssa Main','Alyssa Aesthetics'],
  oa2StateView_:a=>({state:a.state,revision:a.revision}),
  oa2Event_:(ctx,a,type,before,origin)=>ctx.events.push({type,before,origin}),
};
vm.createContext(sandbox);vm.runInContext(source,sandbox);
const appointment={id:'appointment',leadId:'lead',account:'Alyssa Aesthetics',phone:'10000001',
  customerKey:'Alyssa Aesthetics|p:10000001',state:'active',outcome:'',date:'2026-10-12',time:'11:00',
  bookedAt:'2026-10-01T02:00:00Z',queueId:'stable-queue',revision:3,previousId:'previous',provenance:'observed_booking_edit'};
const record={appointmentId:'appointment',leadId:'lead',account:'Alyssa Main',phone:'10000001',customerKey:'Alyssa Main|p:10000001'};
const context=changes=>({appointments:{appointment:{...appointment,...changes}},errors:[],events:[],now:'2026-10-08T00:00:00Z'});
for(const state of ['active','unscheduled','canceled','reschedule_requested']) {
 const ctx=context({state});assert.equal(sandbox.oa2TransferOpenAppointmentAccount_(ctx,record,1),true);
 const a=ctx.appointments.appointment;
 assert.equal(a.account,'Alyssa Main');assert.equal(a.customerKey,record.customerKey);assert.equal(a.revision,4);
 for(const k of ['state','date','time','bookedAt','queueId','previousId','outcome','provenance'])assert.equal(a[k],({...appointment,state})[k]);
 assert.equal(ctx.events[0].type,'account_transferred');assert.equal(ctx.events[0].before.account,'Alyssa Aesthetics');
 assert.equal(sandbox.oa2TransferOpenAppointmentAccount_(ctx,record,1),false);assert.equal(a.revision,4);
}
for(const [changes,row,count] of [[{},record,2],[{},record,0],[{leadId:'other'},record,1],
 [{phone:'20000002'},record,1],[{outcome:'Show',state:'completed'},record,1],
 [{provenance:'legacy_show'},record,1],[{}, {...record,account:'Unknown'},1]]) {
 const ctx=context(changes),before=structuredClone(ctx.appointments);
 assert.equal(sandbox.oa2TransferOpenAppointmentAccount_(ctx,row,count),false);
 assert.deepEqual(ctx.appointments,before);assert.equal(ctx.events.length,0);assert.equal(ctx.errors.length,1);
}
console.log('PASS: unique open Account transfer preserves booking/outcomes/queue/history, rejects ambiguous ownership and is idempotent');
let pending,commits=0,fail=false;
sandbox.console={log:()=>{}};
sandbox.PropertiesService={getScriptProperties:()=>({getProperty:()=>pending,
 setProperty:(_,value)=>{pending=value;},deleteProperty:()=>{pending=undefined;}})};
sandbox.oa2ProcessAccount_=()=>{commits++;if(fail)throw Error('synthetic failure');return{changes:3};};
const ss={getSheetByName:name=>name};
assert.equal(sandbox.oa2RunRequestedAccountTransferRepair_(ss),null);assert.equal(commits,0);
sandbox.requestOmniArrivalAccountTransferRepair();assert.equal(pending,'true');
fail=true;assert.equal(sandbox.oa2RunRequestedAccountTransferRepair_(ss),null);assert.equal(pending,'true');
fail=false;assert.equal(sandbox.oa2RunRequestedAccountTransferRepair_(ss).changes,3);assert.equal(pending,undefined);
assert.equal(sandbox.oa2RunRequestedAccountTransferRepair_(ss),null);assert.equal(commits,2);
console.log('PASS: explicit repair request survives failure and clears only after successful normal commit');
