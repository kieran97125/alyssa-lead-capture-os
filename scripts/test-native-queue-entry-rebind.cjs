const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { clone, loadRelease, sheet, valuesRow, workbook } = require('./fixtures/native-arrival/identity-priority-fixture.cjs');
const tests=[],failures=[];
function test(name,run){try{run();tests.push(name);}catch(error){failures.push({name,error:error.stack});}}
const headers=['品牌','電話','客人／預約','CS同事名','預約日期','時間','結果','到店日期','備註','檢查提示','Account','客人識別','電話末4','療程','分店','原預約日期（自動）','可追溯Book日期（自動）','Book日期來源（自動）','補充Book登記日期','穩定客戶識別（內部）','到店紀錄ID（內部）','客戶＋預約日期時間（內部）','Appointment ID','Schedule Revision','Queue State','Outcome Recorded At','Omni Lead ID','Booking Registered At','Record Origin','sortKey','來源','試做價','開單金額','總金額'];
function appointment(id,phone){return{id,leadId:'lead_'+id,account:'Alyssa Aesthetics',customerKey:'Alyssa Aesthetics|p:'+phone,phone,name:'Synthetic',brand:'Alyssa Aesthetics',treatment:'Synthetic offer',branch:'Synthetic branch',createdAt:'2026-10-01',date:'2026-11-14',time:'11:00',bookedAt:'',provenance:'legacy_registration_unknown',state:'active',outcome:'',arrivalDate:'',outcomeAt:'',revision:1,previousId:'',queueId:'shared_queue',lastStatus:'booked',lastSchedule:'2026-11-14|11:00',firstSeenAt:'2026-10-01T00:00:00Z',updatedAt:'2026-10-01T00:00:00Z',generatedArrivalDate:'',pendingQueueBefore:JSON.stringify(['','','','']),pendingArrivalOverride:''};}
function fixture(){
 const f=loadRelease();vm.runInContext(fs.readFileSync(__dirname+'/apps-script/arrival-queue-entry-rebind.gs','utf8'),f.box);
 const a=appointment('appt_orphan','10000001'),b=appointment('appt_physical','10000002'),sourceHeaders=f.sourceHeaders(),sources=new Map();
 const sourceRow=x=>valuesRow(sourceHeaders,{'最後更新日期':'2026-11-14','Created At':'2026-10-01','跟進狀態':'已預約','CS同事名':'Synthetic CS','品牌':x.brand,'預約日期':x.date,'預約時間':x.time,'客人姓名':x.name,'電話':x.phone,'療程 / 優惠':x.treatment,'療程項目':x.treatment,'分店':x.branch,'CS Remark':'Keep source remark','Account':x.account,'Omni Lead ID':x.leadId,'Appointment ID':x.id,'Booking Registered At':'','到店結果':'','到店結果更新時間':''});
 for(const name of f.accountNames())sources.set(name,sheet(name,sourceHeaders,name===a.account?[sourceRow(a),sourceRow(b)]:[]));
 const queue=sheet('到店紀錄',headers,[],7),registry=sheet('_appointment_registry',f.registryHeaders(),[f.box.oa2LedgerRow_(a),f.box.oa2LedgerRow_(b)]),history=sheet('_appointment_history',f.historyHeaders());
 queue.appendRow(valuesRow(headers,{'品牌':b.brand,'電話':b.phone,'客人／預約':'Physical owner','CS同事名':'Keep CS','預約日期':b.date,'時間':b.time,'結果':'待到店','到店日期':'','備註':'Keep physical remark','Account':b.account,'穩定客戶識別（內部）':b.customerKey,'到店紀錄ID（內部）':b.queueId,'Appointment ID':b.id,'Schedule Revision':b.revision,'Omni Lead ID':b.leadId,'Record Origin':'allocating','來源':'Keep physical source','試做價':0,'開單金額':1280,'總金額':'=SUM(AF8:AG8)'}));
 const all=new Map([...sources,['到店紀錄',queue],['_appointment_registry',registry],['_appointment_history',history]]),ss=workbook(all),retired=new Set();f.box.oa4RetiredAppointmentIds_=()=>retired;
 let flushes=0;f.box.SpreadsheetApp.flush=()=>{flushes++;};
 const plan={appointmentId:a.id,leadId:a.leadId,oldQueueId:a.queueId,expectedRevision:1,registryRow:2,accountIndex:f.accountNames().indexOf(a.account),sourceRow:2,physicalOwnerAppointmentId:b.id,physicalOwnerRegistryRow:3,physicalQueueRow:8};
 const lock={hasLock:()=>true},source=sources.get(a.account),run=(dryRun=false,plans=[plan])=>f.box.oa2RebindOrphanQueueEntries_(ss,plans,{dryRun,documentLock:lock});
 const setSource=(name,value,row=1)=>{source.state.matrix[row][sourceHeaders.indexOf(name)]=value;};
 const setRegistry=(field,value,row=1)=>{registry.state.matrix[row][f.registryHeaders().indexOf(field)]=value;};
 const counts=()=>[...all.values()].map(s=>s.state.writes.length+s.state.noteWrites.length);
 const data=()=>[...all.values()].map(s=>clone(s.state.matrix));
 return{...f,a,b,sourceHeaders,sources,source,queue,registry,history,ss,all,retired,plan,lock,run,setSource,setRegistry,counts,data,flushes:()=>flushes,appointments:()=>clone(f.box.oa2ReadRegistry_(ss).appointments),queueRows:()=>f.box.oa2ReadQueue_(ss,false)};
}
function targetPreserved(a,b){for(const key of ['date','time','state','outcome','arrivalDate','outcomeAt','bookedAt','provenance','pendingArrivalOverride','generatedArrivalDate'])assert.equal(a[key],b[key],key);}

test('dry-run proves reviewed orphan graph with zero writes',()=>{const f=fixture(),before=f.data(),writes=f.counts(),result=f.run(true);assert.equal(result.readOnly,true);assert.equal(result.changed,1);assert.deepEqual(f.data(),before);assert.deepEqual(f.counts(),writes);assert.equal(f.flushes(),0);});
test('actual target-only repair preserves physical owner, money, blank override and source business cells',()=>{
 const f=fixture(),beforeA=f.appointments()[f.a.id],beforeB=f.appointments()[f.b.id],physical=clone(f.queue.state.matrix[7]),source=f.source.state.matrix[1].slice(0,25),sourceB=clone(f.source.state.matrix[2]),result=f.run();
 assert.equal(result.completed,true);assert.equal(result.changed,1);assert.equal(result.resumed,0);const all=f.appointments(),a=all[f.a.id],id=f.box.oa2QueueEntryRebindId_(f.plan);
 assert.equal(a.queueId,id);assert.equal(a.revision,2);targetPreserved(a,beforeA);assert.equal(a.pendingQueueBefore,'');assert.deepEqual(all[f.b.id],beforeB);assert.deepEqual(clone(f.queue.state.matrix[7]),physical);assert.deepEqual(f.source.state.matrix[1].slice(0,25),source);assert.deepEqual(clone(f.source.state.matrix[2]),sourceB);
 assert.equal(f.queueRows().filter(q=>q.appointmentId===f.a.id).length,1);assert.equal(f.queueRows().find(q=>q.appointmentId===f.a.id).origin,'managed');assert.equal(f.queueRows().find(q=>q.appointmentId===f.a.id).entryId,id);assert.ok(f.flushes()>0);
 const event=f.history.state.matrix.find(row=>row[4]==='queue_entry_rebound');assert.ok(event);assert.equal(JSON.parse(event[5]).queueId,f.plan.oldQueueId);assert.equal(JSON.parse(event[5]).pendingQueueBefore,JSON.stringify(['','','','']));assert.equal(JSON.parse(event[6]).queueId,id);assert.equal(JSON.parse(event[6]).pendingQueueBefore,'new');
 assert.ok(f.history.state.matrix.some(row=>row[4]==='state_checkpoint'&&JSON.parse(row[6]).queueId===id));
});
test('repeat is idempotent without another revision, row, UUID or history event',()=>{const f=fixture();f.run();const before=f.data(),count=f.uuidCount(),result=f.run();assert.equal(result.changed,0);assert.equal(result.alreadyRepaired,1);assert.equal(result.resumed,0);assert.deepEqual(f.data(),before);assert.equal(f.uuidCount(),count);});
test('mutating repair requires the actual admitted lock',()=>{const f=fixture(),before=f.data();assert.throws(()=>f.box.oa2RebindOrphanQueueEntries_(f.ss,[f.plan],{dryRun:false,documentLock:{hasLock:()=>false}}),/document lock/);assert.deepEqual(f.data(),before);});

for(const [name,mutate] of [
 ['closed outcome',f=>{f.setRegistry('Outcome','No Show');f.setRegistry('State','completed');}],
 ['retired appointment',f=>f.retired.add(f.a.id)],
 ['source no longer booked',f=>f.setSource('跟進狀態','待跟進')],
 ['source schedule changed',f=>f.setSource('預約日期','2026-11-15')],
 ['wrong source owner',f=>f.setSource('Omni Lead ID','foreign_lead')],
 ['source changed phone',f=>f.setSource('電話','10000003')],
 ['wrong retained physical owner',f=>{f.queue.state.matrix[7][headers.indexOf('Omni Lead ID')]='foreign_lead';}],
 ['unsafe pending Show evidence',f=>f.setRegistry('Pending Queue Before',JSON.stringify(['2026-11-14','11:00','Show','2026-11-14']))],
 ['stale revision',f=>{f.plan.expectedRevision=2;}],
 ['unreviewed duplicate registry queue ID',f=>{const other=appointment('appt_other','10000003');other.queueId='second_duplicate';f.registry.appendRow(f.box.oa2LedgerRow_(other));other.id='appt_other_again';other.leadId='lead_other_again';f.registry.appendRow(f.box.oa2LedgerRow_(other));}],
 ['copied stable source ID in another Account',f=>f.sources.get('GOS Beauty').appendRow(f.source.state.matrix[1].slice())],
 ['retained successor',f=>{const child=appointment('appt_child','10000001');child.previousId=f.a.id;child.queueId='child_queue';f.registry.appendRow(f.box.oa2LedgerRow_(child));}],
])test(name+' rejects before any write',()=>{const f=fixture();mutate(f);const before=f.data(),writes=f.counts();assert.throws(()=>f.run());assert.deepEqual(f.data(),before);assert.deepEqual(f.counts(),writes);});

test('unrelated journal recovery is not persisted by targeted repair',()=>{const f=fixture(),next={...f.b,revision:2,time:'12:00'};f.history.appendRow(['checkpoint','2026-11-16T00:00:00Z',f.b.id,f.b.leadId,'state_checkpoint','{}',JSON.stringify(next),'recovery']);const before=f.data(),writes=f.counts();assert.throws(()=>f.run(),/Unrelated/);assert.deepEqual(f.data(),before);assert.deepEqual(f.counts(),writes);});
test('source full-row CAS preserves a colleague edit arriving during planning',()=>{const f=fixture();let full=0,changed=false;f.source.state.beforeRead=(_n,r)=>{if(r.row===2&&r.column===1&&r.width===31&&++full===2){changed=true;f.setSource('CS Remark','Concurrent colleague remark');}};const registry=clone(f.registry.state.matrix),physical=clone(f.queue.state.matrix[7]);assert.throws(()=>f.run(),/changed|Source/);assert.equal(changed,true);assert.equal(f.source.state.matrix[1][f.sourceHeaders.indexOf('CS Remark')],'Concurrent colleague remark');assert.deepEqual(clone(f.registry.state.matrix),registry);assert.deepEqual(clone(f.queue.state.matrix[7]),physical);});

test('accepted source anchor and registry checkpoint retry reuses the same repair ID and revision',()=>{
 const f=fixture(),physical=clone(f.queue.state.matrix[7]),beforeB=f.appointments()[f.b.id],original=f.box.oa2WriteQueue_;let failed=false;
 f.box.oa2WriteQueue_=(...args)=>{if(!failed){failed=true;throw Error('Synthetic interruption after durable registry');}return original(...args);};
 assert.throws(()=>f.run(),/Synthetic interruption/);const retained=f.appointments()[f.a.id],id=f.box.oa2QueueEntryRebindId_(f.plan);assert.equal(retained.queueId,id);assert.equal(retained.revision,2);assert.ok(f.history.state.matrix.some(row=>row[4]==='state_checkpoint'));assert.equal(f.queueRows().filter(q=>q.appointmentId===f.a.id).length,0);
 const count=f.uuidCount(),result=f.run();assert.equal(result.changed,0);assert.equal(result.resumed,1);assert.equal(f.appointments()[f.a.id].revision,2);assert.equal(f.uuidCount(),count);assert.equal(f.queueRows().filter(q=>q.appointmentId===f.a.id).length,1);assert.deepEqual(f.appointments()[f.b.id],beforeB);assert.deepEqual(clone(f.queue.state.matrix[7]),physical);
});
test('an accepted allocating repair resumes its own physical row once',()=>{
 const f=fixture(),original=f.box.oa2WriteQueue_;let failed=false;
 f.box.oa2WriteQueue_=(ss,ctx,queue,ops,...rest)=>{if(!failed){failed=true;const a=ops[0].appt;f.queue.appendRow(valuesRow(headers,{'Appointment ID':a.id,'Omni Lead ID':a.leadId,'到店紀錄ID（內部）':a.queueId,'Record Origin':'allocating'}));throw Error('Synthetic allocating interruption');}return original(ss,ctx,queue,ops,...rest);};
 assert.throws(()=>f.run(),/Synthetic allocating/);const result=f.run();assert.equal(result.resumed,1);assert.equal(f.appointments()[f.a.id].revision,2);assert.equal(f.queueRows().filter(q=>q.appointmentId===f.a.id).length,1);assert.equal(f.queueRows().find(q=>q.appointmentId===f.a.id).origin,'managed');
});


test('source-anchor-only interruption replays the accepted queue ID without a second revision',()=>{
 const f=fixture(),original=f.box.oa2WriteHistory_;let failed=false;
 f.box.oa2WriteHistory_=(...args)=>{if(!failed){failed=true;throw Error('Synthetic source-anchor interruption');}return original(...args);};
 assert.throws(()=>f.run(),/Synthetic source-anchor/);
 assert.equal(f.appointments()[f.a.id].queueId,f.plan.oldQueueId);
 assert.ok(f.source.state.matrix[1][30]);
 const result=f.run(),a=f.appointments()[f.a.id];assert.equal(result.changed,0);assert.equal(result.resumed,1);assert.equal(a.queueId,f.box.oa2QueueEntryRebindId_(f.plan));assert.equal(a.revision,2);assert.equal(f.queueRows().filter(q=>q.appointmentId===f.a.id).length,1);assert.equal(f.source.state.matrix[1][30],'');
});
test('display projection is scoped only to repaired A and never calls global sorting',()=>{
 const f=fixture(),original=f.box.oa3RefreshDisplay_;let called=0;
 f.box.oa3RefreshDisplay_=(ss,repair,scope)=>{called++;assert.equal(repair,false);assert.deepEqual([...scope.ids],[f.a.id]);assert.equal(scope.ids.has(f.b.id),false);return original(ss,repair,scope);};
 f.box.oa3SortArrival_=()=>{throw Error('Global sort is not part of a binding repair');};
 f.run();assert.equal(called,1);const row=f.queue.state.matrix[8];assert.equal(row[headers.indexOf('品牌')],f.a.brand);assert.equal(row[headers.indexOf('電話')],f.a.phone);assert.equal(row[headers.indexOf('CS同事名')],'Synthetic CS');
});
test('fresh global claim check rejects a copied ID appearing after initial planning',()=>{
 const f=fixture(),original=f.box.oa2AssertQueueRebindClaimsFresh_,before=clone(f.registry.state.matrix),physical=clone(f.queue.state.matrix[7]);
 f.box.oa2AssertQueueRebindClaimsFresh_=(...args)=>{f.sources.get('GOS Beauty').appendRow(f.source.state.matrix[1].slice());return original(...args);};
 assert.throws(()=>f.run(),/claim|unique|source|Duplicate/i);assert.deepEqual(clone(f.registry.state.matrix),before);assert.deepEqual(clone(f.queue.state.matrix[7]),physical);
});
test('unrelated source recovery anchor is rejected without persisting B recovery',()=>{
 const f=fixture(),next={...f.b,revision:2,time:'12:00'};
 f.source.state.matrix[2][30]=JSON.stringify({leadId:f.b.leadId,account:f.b.account,currentAppointmentId:f.b.id,appointments:[next],events:[]});
 const before=f.data(),writes=f.counts();assert.throws(()=>f.run(),/Unrelated/);assert.deepEqual(f.data(),before);assert.deepEqual(f.counts(),writes);
});
test('an occupied replacement identity rejects before any repair writes',()=>{
 const f=fixture(),other=appointment('appt_foreign','10000003');other.queueId=f.box.oa2QueueEntryRebindId_(f.plan);f.registry.appendRow(f.box.oa2LedgerRow_(other));
 const before=f.data(),writes=f.counts();assert.throws(()=>f.run(),/different owner/);assert.deepEqual(f.data(),before);assert.deepEqual(f.counts(),writes);
});
test('staff-entered source/money on the newly allocated slot is never overwritten',()=>{
 const f=fixture(),original=f.box.oa2AllocateQueue_,physical=clone(f.queue.state.matrix[7]);let inserted=false;
 f.box.oa2AllocateQueue_=(...args)=>{original(...args);if(!inserted){inserted=true;f.queue.appendRow(valuesRow(headers,{'來源':'Concurrent staff input','試做價':0}));}};
 assert.throws(()=>f.run(),/staff|money|manual|source/i);assert.equal(f.queue.state.matrix[8][headers.indexOf('來源')],'Concurrent staff input');assert.equal(f.queue.state.matrix[8][headers.indexOf('試做價')],0);assert.deepEqual(clone(f.queue.state.matrix[7]),physical);
});

for(const claim of ['pointer','anchor'])test('fresh foreign '+claim+' cannot claim retained ancestor lineage under a different Lead',()=>{
 const f=fixture(),ancestor={...appointment('appt_ancestor','10000001'),leadId:f.a.leadId,queueId:'ancestor_queue',state:'completed',outcome:'No Show',date:'2026-10-01'};
 f.registry.appendRow(f.box.oa2LedgerRow_(ancestor));f.setRegistry('Previous Appointment ID',ancestor.id);
 const original=f.box.oa2AssertQueueRebindClaimsFresh_,before=clone(f.registry.state.matrix),physical=clone(f.queue.state.matrix[7]);
 f.box.oa2AssertQueueRebindClaimsFresh_=(...args)=>{
  const row=f.source.state.matrix[1].slice();row[f.sourceHeaders.indexOf('Omni Lead ID')]='lead_foreign';row[f.sourceHeaders.indexOf('Appointment ID')]=claim==='pointer'?ancestor.id:'';
  if(claim==='anchor')row[30]=JSON.stringify({leadId:'lead_foreign',account:'GOS Beauty',currentAppointmentId:ancestor.id,appointments:[{...ancestor,leadId:'lead_foreign',account:'GOS Beauty'}],events:[]});
  f.sources.get('GOS Beauty').appendRow(row);return original(...args);
 };
 assert.throws(()=>f.run(),/identity|intent|ownership|retry/i);assert.deepEqual(clone(f.registry.state.matrix),before);assert.deepEqual(clone(f.queue.state.matrix[7]),physical);
});
test('repair uses its portable fresh-claim proof without relying on newer optional native arguments',()=>{
 const f=fixture();f.box.oa2AssertIdentityClaimsFresh_=()=>{throw Error('Do not call newer native fresh-claim overload');};assert.equal(f.run().completed,true);
});
if(failures.length){console.error(JSON.stringify({passed:tests.length,failures},null,2));process.exitCode=1;}else console.log(JSON.stringify({passed:tests.length,tests},null,2));
