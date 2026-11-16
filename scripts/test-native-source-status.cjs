const assert = require('node:assert/strict');
const { clone, loadRelease, sheet, valuesRow, workbook } = require('./fixtures/native-arrival/identity-priority-fixture.cjs');

const tests = [], failures = [];
function test(name, run) { try { run(); tests.push(name); } catch (error) { failures.push({ name, error: error.stack }); } }
const arrivalHeaders = ['品牌','電話','客人／預約','CS同事名','預約日期','時間','結果','到店日期','備註','檢查提示','Account','客人識別','電話末4','療程','分店','原預約日期（自動）','可追溯Book日期（自動）','Book日期來源（自動）','補充Book登記日期','穩定客戶識別（內部）','到店紀錄ID（內部）','客戶＋預約日期時間（內部）','Appointment ID','Schedule Revision','Queue State','Outcome Recorded At','Omni Lead ID','Booking Registered At','Record Origin','sortKey','來源','試做價','開單金額','總金額'];
function appointment(values = {}) {
  return { id:'appt_original', leadId:'lead_original', account:'GOS Beauty', customerKey:'GOS Beauty|p:10000001', phone:'10000001', name:'Synthetic', brand:'GOS Beauty', treatment:'Synthetic offer', branch:'Synthetic branch', createdAt:'2026-10-01', date:'2026-10-18', time:'15:00', bookedAt:'', provenance:'legacy_registration_unknown', state:'active', outcome:'', arrivalDate:'', outcomeAt:'', revision:1, previousId:'', queueId:'queue_original', lastStatus:'booked', lastSchedule:'2026-10-18|15:00', firstSeenAt:'2026-10-01T00:00:00Z', updatedAt:'2026-10-01T00:00:00Z', generatedArrivalDate:'', pendingQueueBefore:'', pendingArrivalOverride:'scheduled', ...values };
}
function fixture(options = {}) {
  const f = loadRelease(), a = appointment(options.appointment), headers = f.sourceHeaders(), sources = new Map();
  const fields = { '最後更新日期':'2026-10-18', 'Created At':'2026-10-01', '跟進狀態':'已預約', 'CS同事名':'Synthetic CS', '品牌':a.brand, '預約日期':a.date, '預約時間':a.time, '客人姓名':a.name, '電話':a.phone, '療程 / 優惠':a.treatment, '療程項目':a.treatment, '分店':a.branch, 'CS Remark':'Preserve source remark', 'Account':a.account, 'Omni Lead ID':a.leadId, 'Appointment ID':a.id, 'Booking Registered At':a.bookedAt, '到店結果':a.outcome, '到店結果更新時間':a.outcomeAt, ...options.fields };
  for (const name of f.accountNames()) sources.set(name, sheet(name, headers, name === a.account ? [valuesRow(headers, fields)] : []));
  const queue = sheet('到店紀錄', arrivalHeaders, [], 7), registry = sheet('_appointment_registry', f.registryHeaders(), [f.box.oa2LedgerRow_(a)]), history = sheet('_appointment_history', f.historyHeaders());
  queue.appendRow(valuesRow(arrivalHeaders, { '品牌':a.brand, '電話':a.phone, '客人／預約':'Synthetic visit', 'CS同事名':'Keep CS', '預約日期':a.date, '時間':a.time, '結果':f.box.oa2QueueStatus_(a), '到店日期':f.box.oa2QueueArrivalDate_(a), '備註':'Keep queue remark', 'Account':a.account, '穩定客戶識別（內部）':a.customerKey, '到店紀錄ID（內部）':a.queueId, 'Appointment ID':a.id, 'Schedule Revision':a.revision, 'Queue State':f.box.oa2QueueState_(a,'2026-11-16'), 'Omni Lead ID':a.leadId, 'Record Origin':'managed', '來源':'Keep source', '試做價':0, '開單金額':1280, '總金額':'=SUM(AF8:AG8)' }));
  const sheets = new Map([...sources, ['到店紀錄',queue], ['_appointment_registry',registry], ['_appointment_history',history]]), ss = workbook(sheets), retired = new Set();
  f.box.oa4RetiredAppointmentIds_ = () => retired;
  // Display/sort is independently covered by the manual orchestration suite.
  // State transitions, journal, source anchors, queue allocation and CAS stay real.
  f.box.oa3AfterSync_ = () => {};
  const source = sources.get(a.account);
  const set = (name,value) => { source.state.matrix[1][headers.indexOf(name)]=value; };
  const get = name => source.state.matrix[1][headers.indexOf(name)];
  const setQueue = (name,value) => { queue.state.matrix[7][arrivalHeaders.indexOf(name)]=value; };
  const run = policy => f.box.oa2ProcessAccount_(ss,source,'scan',null,false,undefined,policy === false ? undefined : {manualComplete:true,...(policy&&typeof policy==='object'?policy:{})});
  const appointments = () => clone(f.box.oa2ReadRegistry_(ss).appointments);
  const queueRows = () => f.box.oa2ReadQueue_(ss,false);
  const appendEvent = row => history.appendRow(row);
  const historyReads = () => history.state.reads;
  return {...f,a,headers,source,queue,registry,history,ss,retired,set,get,setQueue,run,appointments,queueRows,appendEvent,historyReads};
}
function withdrawal(f, mode = 'scan') {
  const ctx = {appointments:{[f.a.id]:clone(f.a)},now:'2026-10-19T00:00:00Z',today:'2026-10-19',events:[],errors:[],id:()=>{throw Error('A withdrawal must retain identity');}};
  const record = {meaningful:true,leadId:f.a.leadId,appointmentId:f.a.id,account:f.a.account,customerKey:f.a.customerKey,phone:f.a.phone,date:f.a.date,time:f.a.time,status:'待跟進'};
  f.box.oa2ReconcileRecord_(ctx,record,mode);return {a:ctx.appointments[f.a.id],event:ctx.events[0]};
}
function canceledFixture(options = {}) {
  const initial=fixture(), change=withdrawal(initial,options.mode), f=fixture({appointment:{...change.a,...options.appointment},fields:options.fields});
  f.appendEvent(change.event);return f;
}
function stableQueueFields(f,row=7) { const v=f.queue.state.matrix[row];return ['CS同事名','備註','來源','試做價','開單金額','總金額'].map(name=>v[arrivalHeaders.indexOf(name)]); }
function spacedWithdrawalFixture(){
  const f=fixture(),template=f.source.state.matrix[1].slice(),visit=f.queue.state.matrix[7].slice();
  for(let i=1;i<3;i++){
    const a=appointment({id:'appt_spaced_'+i,leadId:'lead_spaced_'+i,phone:String(10000001+i),customerKey:'GOS Beauty|p:'+String(10000001+i),queueId:'queue_spaced_'+i});
    const source=template.slice();for(const [key,value]of Object.entries({'電話':a.phone,'Omni Lead ID':a.leadId,'Appointment ID':a.id}))source[f.headers.indexOf(key)]=value;
    f.source.appendRow(source);f.registry.appendRow(f.box.oa2LedgerRow_(a));
    f.queue.appendRow(valuesRow(arrivalHeaders,{'備註':'Preserve intervening staff record '+i,'來源':'Manual source','試做價':0,'總金額':'=0'}));
    const row=visit.slice();for(const [key,value]of Object.entries({'電話':a.phone,'穩定客戶識別（內部）':a.customerKey,'到店紀錄ID（內部）':a.queueId,'Appointment ID':a.id,'Omni Lead ID':a.leadId}))row[arrivalHeaders.indexOf(key)]=value;f.queue.appendRow(row);
  }
  f.source.state.matrix.slice(1).forEach(row=>row[f.headers.indexOf('跟進狀態')]='待跟進');return f;
}

test('bounded native queue groups retain unapplied before-images and converge without rewriting intervening staff records',()=>{
  const f=spacedWithdrawalFixture(),separator=[clone(f.queue.state.matrix[8]),clone(f.queue.state.matrix[10])],staff=[7,9,11].map(row=>stableQueueFields(f,row));
  f.run({prepareOnly:true,singleQueueGroup:true});
  for(const remaining of [2,1,0]){const result=f.run({singleQueueGroup:true});assert.equal(result.remainingQueueOps,remaining);assert.equal(result.appliedQueueOps,1);assert.equal(result.newQueue,0);assert.equal(Object.values(f.appointments()).filter(a=>a.pendingQueueBefore).length,remaining);}
  assert.ok(f.queueRows().filter(q=>q.appointmentId).every(q=>q.outcome==='取消'));assert.deepEqual([clone(f.queue.state.matrix[8]),clone(f.queue.state.matrix[10])],separator);assert.deepEqual([7,9,11].map(row=>stableQueueFields(f,row)),staff);
  assert.equal(f.history.state.matrix.filter(row=>row[4]==='canceled').length,3);const writes=f.queue.state.writes.length;assert.equal(f.run({singleQueueGroup:true}).remainingQueueOps,0);assert.equal(f.queue.state.writes.length,writes);
});

test('a lost bounded queue payload reply retries accepted identities and preserves each cancellation exactly once',()=>{
  const f=spacedWithdrawalFixture();f.run({prepareOnly:true,singleQueueGroup:true});let lost=true;f.queue.state.afterWrite=()=>{if(lost){lost=false;throw Error('Synthetic lost queue reply');}};
  assert.throws(()=>f.run({singleQueueGroup:true}),/lost queue reply/);assert.equal(Object.values(f.appointments()).filter(a=>a.pendingQueueBefore).length,3);
  for(const remaining of [2,1,0])assert.equal(f.run({singleQueueGroup:true}).remainingQueueOps,remaining);
  assert.equal(f.history.state.matrix.filter(row=>row[4]==='canceled').length,3);assert.equal(f.queueRows().filter(q=>q.appointmentId).length,3);assert.equal(new Set(f.queueRows().filter(q=>q.appointmentId).map(q=>q.entryId)).size,3);
});

test('manual preparation saves only canonical source recovery intent; the next RPC applies the same withdrawal once',()=>{
  const f=fixture();f.set('跟進狀態','待跟進');const registry=clone(f.registry.state.matrix),queue=clone(f.queue.state.matrix),history=clone(f.history.state.matrix),staff=stableQueueFields(f);
  const staged=f.run({prepareOnly:true});assert.equal(staged.staged,true);assert.ok(f.get('Pending Appointment Snapshot'));
  assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.queue.state.matrix),queue);assert.deepEqual(clone(f.history.state.matrix),history);
  const applied=f.run();assert.notEqual(applied.staged,true);assert.equal(f.appointments()[f.a.id].state,'canceled');assert.equal(f.get('Pending Appointment Snapshot'),'');assert.equal(f.queueRows()[0].outcome,'取消');assert.deepEqual(stableQueueFields(f),staff);
  assert.equal(f.history.state.matrix.filter(row=>row[4]==='canceled').length,1);const accepted=clone(f.registry.state.matrix);f.run();assert.deepEqual(clone(f.registry.state.matrix),accepted);assert.equal(f.history.state.matrix.filter(row=>row[4]==='canceled').length,1);
});

test('lost prepare acknowledgement replays a canonical successor without replacing its reserved queue identity',()=>{
  const f=canceledFixture();f.set('預約日期','2026-10-25');let lost=true;f.source.state.afterWrite=()=>{if(lost){lost=false;throw Error('Synthetic lost prepare reply');}};
  assert.throws(()=>f.run({prepareOnly:true}),/lost prepare reply/);const intent=JSON.parse(f.get('Pending Appointment Snapshot')),nextId=intent.currentAppointmentId,next=intent.appointments.find(a=>a.id===nextId);
  assert.ok(next.queueId);assert.equal(Object.keys(f.appointments()).length,1);assert.equal(f.queueRows().length,1);
  f.run({prepareOnly:true});f.run();assert.equal(f.get('Appointment ID'),nextId);assert.equal(f.appointments()[nextId].queueId,next.queueId);assert.equal(f.queueRows().filter(q=>q.appointmentId===nextId).length,1);
  const count=f.uuidCount();f.run();assert.equal(f.uuidCount(),count);assert.equal(Object.keys(f.appointments()).length,2);
});

test('a colleague outcome between preparation and application stays visible and deferred rather than overwritten',()=>{
  const f=fixture();f.set('跟進狀態','待跟進');f.run({prepareOnly:true});f.setQueue('結果','已到店');f.setQueue('到店日期',f.a.date);const staff=stableQueueFields(f),result=f.run();
  assert.ok(result.deferredQueueConflicts>0);assert.equal(f.queueRows()[0].outcome,'已到店');assert.deepEqual(stableQueueFields(f),staff);assert.equal(f.get('Pending Appointment Snapshot')!=='',true);
});

test('source booked→待跟進 retains identity and moves the existing pending queue entry to canceled history',()=>{
  const f=fixture(), input=f.source.state.matrix[1].slice(0,25), retained=stableQueueFields(f);
  f.set('跟進狀態','待跟進');const result=f.run(), a=f.appointments()[f.a.id];
  assert.equal(result.manualReviewCount,0);assert.equal(result.newQueue,0);assert.equal(a.state,'canceled');assert.equal(a.outcome,'');assert.equal(a.revision,2);
  assert.equal(f.get('Appointment ID'),f.a.id);assert.equal(f.queueRows().length,1);assert.equal(f.queueRows()[0].outcome,'取消');
  assert.deepEqual(stableQueueFields(f),retained);input[f.headers.indexOf('跟進狀態')]='待跟進';assert.deepEqual(f.source.state.matrix[1].slice(0,25),input);
  const cancel=f.history.state.matrix.find(row=>row[4]==='canceled');assert.equal(cancel[7],'scan');assert.equal(JSON.parse(cancel[6]).state,'canceled');
});

test('missed source withdrawal→booked creates exactly one canonical successor and leaves unknown Book time unknown',()=>{
  const f=fixture();f.set('跟進狀態','待跟進');f.run();const old=f.appointments()[f.a.id], historyRow=clone(f.queue.state.matrix[7]);
  f.set('跟進狀態','已預約');f.set('預約日期','2026-10-25');f.set('預約時間','16:00');const result=f.run(), all=f.appointments(), successor=all[f.get('Appointment ID')];
  assert.equal(result.manualRebookedCount,1);assert.equal(result.manualReviewCount,0);assert.equal(result.newQueue,1);assert.equal(Object.keys(all).length,2);
  assert.equal(successor.id,'appt_'+f.box.oa2Hash_(f.a.leadId+'|after:'+f.a.id));assert.equal(successor.previousId,f.a.id);assert.equal(successor.state,'active');assert.equal(successor.date,'2026-10-25');
  assert.equal(successor.bookedAt,'');assert.equal(successor.provenance,'legacy_registration_unknown');assert.equal(f.get('Booking Registered At'),'');
  assert.deepEqual(all[f.a.id],old);assert.deepEqual(clone(f.queue.state.matrix[7]),historyRow);assert.equal(f.queueRows().length,2);
  const before=clone(f.registry.state.matrix), count=f.uuidCount(), again=f.run();assert.equal(again.manualRebookedCount,0);assert.equal(again.newQueue,0);assert.equal(f.uuidCount(),count);assert.deepEqual(clone(f.registry.state.matrix),before);
});

test('a prior scan overwriting lastStatus does not erase durable source-withdrawal evidence',()=>{
  const f=canceledFixture({appointment:{lastStatus:'booked',lastSchedule:'2026-10-25|16:00'}});f.set('預約日期','2026-10-25');f.set('預約時間','16:00');
  const result=f.run();assert.equal(result.manualRebookedCount,1);assert.equal(Object.keys(f.appointments()).length,2);assert.equal(f.appointments()[f.a.id].state,'canceled');
});

for(const mode of ['edit','initialize'])test('durable source-withdrawal event '+mode+' permits a scan successor without an observed-booking timestamp',()=>{
  const f=canceledFixture({mode}), result=f.run();assert.equal(result.manualRebookedCount,1);assert.equal(f.appointments()[f.get('Appointment ID')].bookedAt,'');
});

for(const [name,change] of [
  ['user queue cancellation',f=>{f.history.state.matrix[1][7]='queue_edit';}],
  ['missing evidence',f=>{f.history.state.matrix.length=1;}],
  ['wrong revision',f=>{const v=JSON.parse(f.history.state.matrix[1][6]);v.revision=999;f.history.state.matrix[1][6]=JSON.stringify(v);}],
  ['wrong journal owner',f=>{f.history.state.matrix[1][3]='lead_other';}],
  ['later conflicting cancellation',f=>{const row=clone(f.history.state.matrix[1]);row[0]='later';row[7]='queue_edit';f.appendEvent(row);}],
  ['malformed journal payload',f=>{f.history.state.matrix[1][6]='{bad';}],
  ['malformed current date',f=>{f.set('預約日期','再約');}],
  ['new pending queue input',f=>{f.setQueue('結果','待到店');f.setQueue('到店日期',f.a.date);}],
  ['missing canceled queue history',f=>{f.queue.state.matrix.length=7;}],
  ['changed stable customer key',f=>{f.set('電話','10000002');}],
])test(name+' defers the source and preserves its closed appointment rather than guessing a rebooking',()=>{
  const f=canceledFixture();change(f);const registry=clone(f.registry.state.matrix), source=clone(f.source.state.matrix), queue=clone(f.queue.state.matrix), result=f.run();
  assert.equal(result.manualReviewCount,1);assert.equal(result.deferredSourceRecords,1);assert.equal(result.newQueue,0);assert.equal(result.manualRebookedCount,0);
  assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.source.state.matrix),source);assert.deepEqual(clone(f.queue.state.matrix),queue);
});

for(const outcome of ['Show','No Show'])for(const change of ['date','status'])test(outcome+' closed source '+change+' change is review-only and preserves historical outcome/money',()=>{
  const f=fixture({appointment:{state:'completed',outcome,arrivalDate:outcome==='Show'?'2026-10-18':'',outcomeAt:'2026-10-18T08:00:00Z',generatedArrivalDate:outcome==='Show'?'2026-10-18':''}});
  f.set(change==='date'?'預約日期':'跟進狀態',change==='date'?'2026-10-25':'待跟進');const registry=clone(f.registry.state.matrix),queue=clone(f.queue.state.matrix), result=f.run();
  assert.equal(result.manualReviewCount,1);assert.equal(result.newQueue,0);assert.equal(Object.keys(f.appointments()).length,1);assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.queue.state.matrix),queue);
});

for(const outcome of ['Show','No Show'])test('unchanged '+outcome+' history is retained without an artificial review or successor',()=>{
  const f=fixture({appointment:{state:'completed',outcome,arrivalDate:outcome==='Show'?'2026-10-18':'',outcomeAt:'2026-10-18T08:00:00Z',generatedArrivalDate:outcome==='Show'?'2026-10-18':''}}), before=clone(f.registry.state.matrix), result=f.run();
  assert.equal(result.manualReviewCount,0);assert.equal(result.newQueue,0);assert.deepEqual(clone(f.registry.state.matrix),before);
});

test('retired source and new stale schedule cannot revive or append a retired appointment',()=>{
  const f=fixture();f.retired.add(f.a.id);f.set('預約日期','2026-10-25');const registry=clone(f.registry.state.matrix),queue=clone(f.queue.state.matrix), result=f.run();
  assert.equal(result.manualReviewCount,1);assert.equal(result.newQueue,0);assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.queue.state.matrix),queue);
});

test('successor recovery from an old source pointer reuses the existing canonical successor',()=>{
  const f=canceledFixture();f.run();const successor=f.get('Appointment ID'),count=f.uuidCount();f.set('Appointment ID',f.a.id);
  const result=f.run();assert.equal(f.get('Appointment ID'),successor);assert.equal(result.newQueue,0);assert.equal(Object.keys(f.appointments()).length,2);assert.equal(f.uuidCount(),count);
});

test('normal six-argument scan uses the same durable source-withdrawal proof as the manual button',()=>{
  const f=canceledFixture(), result=f.run(false);assert.equal(result.manualRebookedCount,1);assert.equal(result.manualReviewCount,0);assert.equal(Object.keys(f.appointments()).length,2);assert.notEqual(f.get('Appointment ID'),f.a.id);assert.equal(f.appointments()[f.get('Appointment ID')].bookedAt,'');
});

for(const outcome of ['Show','No Show'])test('a subsequent real timer cannot undo manual review of '+outcome+' source schedule drift',()=>{
  const f=fixture({appointment:{state:'completed',outcome,arrivalDate:outcome==='Show'?'2026-10-18':'',outcomeAt:'2026-10-18T08:00:00Z',generatedArrivalDate:outcome==='Show'?'2026-10-18':''}});f.set('預約日期','2026-10-25');assert.equal(f.run().manualReviewCount,1);
  const registry=clone(f.registry.state.matrix),queue=clone(f.queue.state.matrix);let released=0;
  f.box.oa2Spreadsheet_=()=>f.ss;f.box.oa2Enabled_=()=>true;f.box.omniStaffPriorityActive_=()=>false;f.box.oa3AdmitMaintenance_=()=>null;f.box.oa2TryRefreshQueueCs_=()=>({ok:true});
  f.box.LockService={getDocumentLock:()=>({tryLock:()=>true,hasLock:()=>true,releaseLock:()=>{released++;}})};
  f.script.set('OMNI_ARRIVAL_V2_CURSOR',String(f.accountNames().indexOf('GOS Beauty')));
  const result=f.box.omniArrivalV2Timer();assert.equal(result.account,'GOS Beauty');assert.equal(result.manualReviewCount,1);assert.equal(result.deferredSourceRecords,1);assert.equal(result.newQueue,0);assert.equal(released,1);
  assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.queue.state.matrix),queue);assert.equal(f.get('Appointment ID'),f.a.id);
});

for(const outcome of ['Show','No Show'])for(const forceNew of [false,true])test('an explicitly observed '+(forceNew?'forceNew':'schedule edit')+' keeps canonical rebooking after '+outcome,()=>{
  const f=fixture({appointment:{state:'completed',outcome,arrivalDate:outcome==='Show'?'2026-10-18':'',outcomeAt:'2026-10-18T08:00:00Z',generatedArrivalDate:outcome==='Show'?'2026-10-18':''}}), before=f.appointments()[f.a.id];
  if(!forceNew)f.set('預約日期','2026-10-25');const column=f.headers.indexOf('預約日期')+1;
  const result=f.box.oa2ProcessAccount_(f.ss,f.source,'scan',{firstRow:2,lastRow:2,firstCol:column,lastCol:column,forceNew},false), all=f.appointments(), next=all[f.get('Appointment ID')];
  assert.equal(result.manualReviewCount,0);assert.equal(result.newQueue,1);assert.equal(Object.keys(all).length,2);assert.equal(next.previousId,f.a.id);assert.ok(next.bookedAt);assert.equal(next.provenance,'observed_booking_edit');assert.deepEqual(all[f.a.id],before);
});

test('an actual observed status edit can rebook an explicit user cancellation without weakening scans',()=>{
  const f=canceledFixture();f.history.state.matrix[1][7]='queue_edit';const before=f.appointments()[f.a.id],column=f.headers.indexOf('跟進狀態')+1;
  const result=f.box.oa2ProcessAccount_(f.ss,f.source,'scan',{firstRow:2,lastRow:2,firstCol:column,lastCol:column},false), next=f.appointments()[f.get('Appointment ID')];
  assert.equal(result.manualReviewCount,0);assert.equal(result.newQueue,1);assert.equal(next.previousId,f.a.id);assert.ok(next.bookedAt);assert.deepEqual(f.appointments()[f.a.id],before);
});

test('a pure unobserved transition cannot infer a new booking merely from a completed schedule change',()=>{
  const f=fixture({appointment:{state:'completed',outcome:'No Show'}}), a=clone(f.a),ctx={appointments:{[a.id]:a},now:'2026-11-16T00:00:00Z',events:[],errors:[],id:()=>{throw Error('No allocation');}};
  f.box.oa2ReconcileRecord_(ctx,{meaningful:true,leadId:a.leadId,appointmentId:a.id,account:a.account,status:'已預約',date:'2026-10-25',time:a.time},'scan');
  assert.equal(Object.keys(ctx.appointments).length,1);assert.equal(a.state,'completed');assert.equal(a.outcome,'No Show');assert.equal(a.date,'2026-10-18');assert.equal(ctx.events.length,0);
});

test('source drift remains review even if an earlier observation already overwrote lastSchedule',()=>{
  const f=fixture({appointment:{state:'completed',outcome:'No Show',lastSchedule:'2026-10-25|15:00'},fields:{'預約日期':'2026-10-25'}}), result=f.run(false);
  assert.equal(result.manualReviewCount,1);assert.equal(result.newQueue,0);assert.equal(Object.keys(f.appointments()).length,1);
});

test('manual policy makes no history reads when there is no canceled→booked candidate',()=>{
  const f=fixture();let called=0;f.box.oa2SourceWithdrawalEvidence_=()=>{called++;return new Set();};f.run();assert.equal(called,1,'The empty-candidate helper must return without accessing history');
  const g=fixture(), ss={getSheetByName:()=>{throw Error('No evidence lookup is needed');}};assert.equal(g.box.oa2SourceWithdrawalEvidence_(ss,[]).size,0);
});

test('journal evidence search is bounded to 4000 recent rows and never authorizes evidence beyond the bound',()=>{
  const f=canceledFixture();for(let i=0;i<4000;i++)f.appendEvent(['other_'+i,'2026-10-20','appt_other','lead_other','unrelated','{}','{}','scan']);
  const ranges=[];f.history.state.beforeRead=(_count,range)=>{if(range.row>1)ranges.push(range);};const proof=f.box.oa2SourceWithdrawalEvidence_(f.ss,[f.appointments()[f.a.id]]);
  assert.equal(proof.size,0);assert.ok(ranges.every(range=>range.height<=500));assert.equal(ranges.reduce((sum,range)=>sum+range.height,0),4000);
});

for(const [name,change] of [['Lead',f=>f.setQueue('Omni Lead ID','lead_wrong')],['queue entry',f=>f.setQueue('到店紀錄ID（內部）','queue_wrong')],['duplicate appointment',f=>f.queue.appendRow(f.queue.state.matrix[7])]])test('manual policy cannot hide invalid '+name+' ownership behind review filtering',()=>{
  const f=canceledFixture();change(f);const writes=f.registry.state.writes.length;assert.throws(()=>f.run(),/ownership|identity|Duplicate/);assert.equal(f.registry.state.writes.length,writes);
});

test('fresh source CAS still rejects a colleague edit after policy planning without replacing it',()=>{
  const f=canceledFixture();let edited=false;f.source.state.beforeRead=(_count,range)=>{if(!edited&&range.column===1&&range.row===2&&range.width===31){if(f.source.state.writes.length){return;}const full=(f.source.fullReads=(f.source.fullReads||0)+1);if(full===2){edited=true;f.set('CS Remark','Concurrent colleague remark');}}};
  const registry=clone(f.registry.state.matrix);assert.throws(()=>f.run(),/Source changed|Account rows changed/);assert.equal(edited,true);assert.equal(f.get('CS Remark'),'Concurrent colleague remark');assert.deepEqual(clone(f.registry.state.matrix),registry);
});

test('fresh queue CAS still rejects a newly edited outcome during canonical successor allocation',()=>{
  const f=canceledFixture({appointment:{pendingQueueBefore:JSON.stringify(['2026-10-18','15:00','待到店','2026-10-18'])}});f.setQueue('結果','待到店');f.setQueue('到店日期','2026-10-18');
  let edited=false;const original=f.box.oa2AllocateQueue_;f.box.oa2AllocateQueue_=(...args)=>{original(...args);if(!edited){edited=true;f.setQueue('結果','No Show');}};
  assert.throws(()=>f.run(),/outcome changed|input|changed during/);assert.equal(f.queue.state.matrix[7][arrivalHeaders.indexOf('結果')],'No Show');
  assert.equal(f.registry.state.matrix.filter(row=>row[0]===f.a.id).length,1,'The old owner remains unique even if a prior journal commit was accepted');
  const accepted=f.get('Appointment ID');f.setQueue('結果','取消');f.setQueue('到店日期','');const retry=f.run();
  assert.equal(f.get('Appointment ID'),accepted);assert.equal(Object.keys(f.appointments()).length,2);assert.equal(retry.manualRebookedCount,0);assert.equal(f.queueRows().filter(q=>q.appointmentId===accepted).length,1,'Accepted source/journal recovery must not allocate a second successor');
});

test('a journal provider failure propagates without accepting a guessed source reversal',()=>{
  const f=canceledFixture(), original=f.box.oa2SourceWithdrawalEvidence_,registry=clone(f.registry.state.matrix),source=clone(f.source.state.matrix);
  f.box.oa2SourceWithdrawalEvidence_=(ss,appointments)=>original({getSheetByName:()=>{throw Error('Synthetic journal provider failure');}},appointments);
  assert.throws(()=>f.run(),/Synthetic journal provider failure/);assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.source.state.matrix),source);
});

test('an observed edit on one record cannot authorize a stale completed successor on another record',()=>{
  const f=fixture(), other=fixture({appointment:{id:'appt_other',leadId:'lead_other',queueId:'queue_other',phone:'10000002',customerKey:'GOS Beauty|p:10000002',state:'completed',outcome:'No Show'}});
  const row=other.source.state.matrix[1].slice();row[f.headers.indexOf('預約日期')]='2026-10-25';f.source.appendRow(row);f.registry.appendRow(other.registry.state.matrix[1]);f.queue.appendRow(other.queue.state.matrix[7]);
  f.set('跟進狀態','待跟進');const column=f.headers.indexOf('跟進狀態')+1,result=f.box.oa2ProcessAccount_(f.ss,f.source,'scan',{firstRow:2,lastRow:2,firstCol:column,lastCol:column},false), all=f.appointments();
  assert.equal(result.manualReviewCount,1);assert.equal(result.deferredSourceRecords,1);assert.equal(result.newQueue,0);assert.equal(Object.keys(all).length,2);assert.equal(all[f.a.id].state,'canceled');assert.equal(all.appt_other.state,'completed');assert.equal(all.appt_other.outcome,'No Show');assert.equal(all.appt_other.date,'2026-10-18');
});

for(const claim of ['copied Lead ID','copied pointer','pending anchor'])test('a fresh other-Account '+claim+' prevents source-rebook acceptance',()=>{
  const f=canceledFixture(),other=f.ss.getSheetByName('Alyssa Main'),registry=clone(f.registry.state.matrix),source=clone(f.source.state.matrix),row=Array(f.headers.length).fill('');
  if(claim==='copied Lead ID')row[f.headers.indexOf('Omni Lead ID')]=f.a.leadId;
  if(claim==='copied pointer')row[f.headers.indexOf('Appointment ID')]=f.a.id;
  if(claim==='pending anchor')row[f.headers.indexOf('Pending Appointment Snapshot')]=JSON.stringify({leadId:f.a.leadId,currentAppointmentId:f.a.id});
  const original=f.box.oa2SourceWithdrawalEvidence_;f.box.oa2SourceWithdrawalEvidence_=(...args)=>{const evidence=original(...args);other.appendRow(row);return evidence;};
  assert.throws(()=>f.run(),/Source identity ownership changed|Outside recovery/);assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.source.state.matrix),source);assert.equal(Object.keys(f.appointments()).length,1);
});

test('an already copied complete source on another Account cannot authorize a canonical rebooking',()=>{
  const f=canceledFixture();f.ss.getSheetByName('Alyssa Main').appendRow(f.source.state.matrix[1]);const registry=clone(f.registry.state.matrix),queue=clone(f.queue.state.matrix);
  assert.throws(()=>f.run(),/Source identity ownership changed/);assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.queue.state.matrix),queue);
});

for(const kind of ['same Lead but wrong lineage','different owner'])test('occupied canonical successor with '+kind+' cannot overwrite accepted No Show history',()=>{
  const f=canceledFixture(),id='appt_'+f.box.oa2Hash_(f.a.leadId+'|after:'+f.a.id),existing=appointment({id,leadId:kind==='different owner'?'lead_other':f.a.leadId,previousId:'',queueId:'',state:'completed',outcome:'No Show',date:'2026-10-10'});
  f.registry.appendRow(f.box.oa2LedgerRow_(existing));const registry=clone(f.registry.state.matrix),source=clone(f.source.state.matrix),queue=clone(f.queue.state.matrix);
  assert.throws(()=>f.run(),/Canonical appointment successor/);assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.source.state.matrix),source);assert.deepEqual(clone(f.queue.state.matrix),queue);assert.equal(f.appointments()[id].outcome,'No Show');
});

test('source-only review counts records without mislabeling every retained ancestor as a queue conflict',()=>{
  const f=fixture({appointment:{state:'completed',outcome:'No Show'}});f.set('預約日期','2026-10-25');const result=f.run();
  assert.equal(result.manualReviewCount,1);assert.equal(result.deferredSourceRecords,1);assert.equal(result.deferredQueueConflicts,0);
});

if(failures.length){console.error(JSON.stringify({passed:tests.length,failures},null,2));process.exitCode=1;}
else console.log(JSON.stringify({passed:tests.length,tests},null,2));
