/** Synthetic in-memory fixtures only. No spreadsheet writes or trigger changes. */
function verifyArrivalCancellationCorrection20261008() {
  const checks=[];
  function check(ok,name){if(!ok)throw new Error('Cancellation QA: '+name);checks.push(name);}
  function fixture(outcome,extra) {
    const a=Object.assign({id:'synthetic_appt',leadId:'synthetic_lead',account:'Synthetic Account',customerKey:'synthetic_person',phone:'',name:'Synthetic Customer',date:'2026-10-07',time:'09:00',bookedAt:'2026-10-01T00:00:00.000Z',provenance:'observed_booking_edit',state:outcome?'completed':'active',outcome:outcome||'',arrivalDate:outcome==='Show'?'2026-10-07':'',outcomeAt:outcome?'2026-10-07T01:00:00.000Z':'',revision:2,queueId:'synthetic_queue',pendingArrivalOverride:'scheduled',generatedArrivalDate:outcome==='Show'?'2026-10-07':'',pendingQueueBefore:''},extra||{});
    return{appointments:{synthetic_appt:a},events:[],errors:[],now:'2026-10-08T02:00:00.000Z',today:'2026-10-08',original:{synthetic_appt:JSON.stringify(a)}};
  }
  function queue(ctx,outcome,extra) {const a=ctx.appointments.synthetic_appt;return Object.assign({row:8,appointmentId:a.id,entryId:a.queueId,origin:'managed',date:a.date,time:a.time,outcome,arrivalDate:'2026-10-07',raw:Array(26).fill('')},extra||{});}
  function rejects(action,name){let threw=false;try{action();}catch(e){threw=true;}check(threw,name);}
  ['Show','No Show',''].forEach(outcome=>{
    const ctx=fixture(outcome),a=ctx.appointments.synthetic_appt,identity=JSON.stringify([a.id,a.leadId,a.queueId,a.bookedAt,a.date,a.time]),before=JSON.stringify(a);
    oa2AbsorbQueueInputs_(ctx,[queue(ctx,'取消')]);
    check(!ctx.errors.length&&a.state==='canceled'&&a.outcome===''&&a.arrivalDate===''&&a.generatedArrivalDate==='',(outcome||'pending')+' cancellation clears current evidence');
    check(a.revision===3&&ctx.events.length===1&&(JSON.parse(ctx.events[0][5]).outcome===(outcome||'')),(outcome||'pending')+' correction has one auditable revision');
    check(identity===JSON.stringify([a.id,a.leadId,a.queueId,a.bookedAt,a.date,a.time]),(outcome||'pending')+' correction preserves booking identity');
    check(oa2QueueState_(a,ctx.today)==='已取消'&&oa2QueueStatus_(a)==='取消'&&oa2QueueArrivalDate_(a)==='',(outcome||'pending')+' canceled queue projection');
    check(oa2MetricPeople_(ctx.appointments,'show','2026-10-01','2026-10-31')===0&&oa2MetricPeople_(ctx.appointments,'no_show','2026-10-01','2026-10-31')===0&&oa2MetricPeople_(ctx.appointments,'book','2026-10-01','2026-10-31')===1,(outcome||'pending')+' metric reversal preserves Book');
    const settled=JSON.stringify(a);oa2QueueAction_(ctx,a.id,'取消');
    check(JSON.stringify(a)===settled&&ctx.events.length===1,(outcome||'pending')+' cancellation retry is idempotent');
    rejects(()=>oa2SetOutcome_(ctx,a.id,'已到店','2026-10-07','qa'),(outcome||'pending')+' canceled appointment rejects accidental completion');
    oa2QueueAction_(ctx,a.id,'待到店');oa2SetOutcome_(ctx,a.id,'已到店','2026-10-07','qa');
    check(a.state==='completed'&&a.outcome==='Show'&&oa2MetricPeople_(ctx.appointments,'show','2026-10-01','2026-10-31')===1,(outcome||'pending')+' explicit pending restoration can complete again');
    oa2AbsorbQueueInputs_(ctx,[queue(ctx,'取消')]);check(a.state==='canceled'&&a.outcome==='',(outcome||'pending')+' repeated Show to cancellation');
  });
  const worker=fixture('Show');check(oa2AbsorbWorkerQueueInputs_(worker,[queue(worker,'取消')]).size===0&&!worker.errors.length&&worker.appointments.synthetic_appt.state==='canceled','worker accepts cancellation in staged copy');
  const conflict=fixture('Show'),original=JSON.stringify(conflict.appointments.synthetic_appt);check(oa2AbsorbWorkerQueueInputs_(conflict,[queue(conflict,'取消',{date:'2026-10-06'})]).size===1&&JSON.stringify(conflict.appointments.synthetic_appt)===original,'worker preserves managed schedule conflict');
  const mismatch=fixture('Show'),mismatchBefore=JSON.stringify(mismatch.appointments.synthetic_appt);oa2AbsorbWorkerQueueInputs_(mismatch,[queue(mismatch,'取消',{entryId:'wrong_entry'})]);check(mismatch.errors.length===1&&JSON.stringify(mismatch.appointments.synthetic_appt)===mismatchBefore,'worker preserves queue identity mismatch');
  const legacy=fixture('Show',{provenance:'legacy_show'}),legacyBefore=JSON.stringify(legacy.appointments.synthetic_appt);rejects(()=>oa2QueueAction_(legacy,'synthetic_appt','取消'),'imported history retains completion guard');check(JSON.stringify(legacy.appointments.synthetic_appt)===legacyBefore,'imported history remains unchanged');
  const reschedule=fixture('Show'),rescheduleBefore=JSON.stringify(reschedule.appointments.synthetic_appt);rejects(()=>oa2QueueAction_(reschedule,'synthetic_appt','改期'),'reschedule retains completion guard');check(JSON.stringify(reschedule.appointments.synthetic_appt)===rescheduleBefore,'rejected reschedule remains unchanged');
  const invalid=fixture('Show'),invalidBefore=JSON.stringify(invalid.appointments.synthetic_appt);rejects(()=>oa2QueueAction_(invalid,'synthetic_appt','unsupported'),'unsupported action is rejected');check(JSON.stringify(invalid.appointments.synthetic_appt)===invalidBefore,'unsupported action has no mutation');
  rejects(()=>oa2QueueAction_(fixture('Show'),'unknown','取消'),'unknown appointment is rejected');
  const result={passed:checks.length,failed:0,syntheticOnly:true,spreadsheetWrites:0};console.log(JSON.stringify(result));return result;
}

/** One-off reconciliation through the existing queue handler, scoped to one mismatch.
 * Fail fast if coworkers have priority or another document execution holds the lock.
 * It never writes raw registry fields, sorts Account rows or changes triggers.
 */
function reconcileSingleCanceledArrival20261008() {
  if(!oa2Enabled_())throw new Error('Arrival automation is not enabled.');
  if(omniStaffPriorityActive_()){const result={busy:true,reason:'staff_priority'};console.log(JSON.stringify(result));return result;}
  const lock=LockService.getDocumentLock();if(!lock.tryLock(0)){const result={busy:true,reason:'document_lock'};console.log(JSON.stringify(result));return result;}
  try {
    if(omniStaffPriorityActive_()){const result={busy:true,reason:'staff_priority'};console.log(JSON.stringify(result));return result;}
    const ss=oa2Spreadsheet_(),registry=oa2ReadRegistry_(ss),queue=oa2ReadQueue_(ss,false);
    const matches=queue.filter(q=>q.origin==='managed'&&oa2Text_(q.outcome)==='取消'&&registry.appointments[q.appointmentId]&&registry.appointments[q.appointmentId].state==='completed'&&registry.appointments[q.appointmentId].outcome);
    if(matches.length!==1)throw new Error('Expected exactly one managed canceled/completed mismatch; no recovery applied.');
    const sh=ss.getSheetByName(OA2.ARRIVAL),layout=oa2QueueLayout_(sh,false),range=sh.getRange(matches[0].row,layout.columns[3]);
    const accepted=omniArrivalV2QueueEdit_({source:ss,range},{sheet:sh,name:OA2.ARRIVAL,lockHeld:true,documentLock:lock});
    SpreadsheetApp.flush();
    const after=oa2ReadRegistry_(ss).appointments[matches[0].appointmentId],result={accepted:!!accepted,state:after.state,outcome:after.outcome,arrivalDate:after.arrivalDate,revision:after.revision};
    if(after.state!=='canceled'||after.outcome||after.arrivalDate)throw new Error('Cancellation recovery failed readback.');
    console.log(JSON.stringify(result));return result;
  }finally{lock.releaseLock();}
}
