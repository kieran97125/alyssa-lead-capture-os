/** Reviewed replacement-function snapshot; replace matching bound definitions.
 * Do not add this file alongside existing definitions in a live Apps Script project.
 * No installer, trigger creation, permission change or production data appears here.
 */
function oa2ReconcileRecord_(ctx, record, mode) {
  if (!record.meaningful) return null;
  if (!record.leadId) record.leadId=ctx.id('lead');
  const status=oa2Status_(record.status), date=oa2Date_(record.date), time=oa2Time_(record.time);
  const schedule=date+'|'+time;
  let appt=record.appointmentId ? ctx.appointments[record.appointmentId] : null;
  if(record.appointmentId && !appt) {ctx.errors.push('Unknown appointment ID on '+record.account+' row '+record.row);return null;}
  // Recover a partially committed registry write by durable Lead ID, never by source row.
  const recover=Object.keys(ctx.appointments).map(id=>ctx.appointments[id]).filter(a=>a.leadId===record.leadId && a.provenance!=='legacy_show').sort((a,b)=>String(a.firstSeenAt).localeCompare(String(b.firstSeenAt)));
  const newest=recover[recover.length-1];
  if(newest && (!appt || newest.previousId===appt.id)) { appt=newest; record.appointmentId=appt.id; }
  if (record.appointmentId && !appt) { ctx.errors.push('Unknown appointment ID on '+record.account+' row '+record.row); return null; }
  if (appt && appt.leadId!==record.leadId) { ctx.errors.push('Lead/appointment identity mismatch on '+record.account+' row '+record.row); return null; }
  if (appt && appt.account!==record.account) { ctx.errors.push('Appointment/account identity mismatch on '+record.account+' row '+record.row); return null; }
  // Timer discovers API-imported rows, but never invents registration time for pre-existing bookings.
  const genuineBooking = mode==='edit' && record.bookingMutation;
  const needsNew = status==='booked' && (record.forceNew || !appt || (appt.state==='canceled' && genuineBooking) || (appt.state==='completed' && (schedule!==appt.lastSchedule || (genuineBooking && appt.lastStatus!=='booked') || record.forceNew)));
  if (needsNew) {
    const previous=appt?appt.id:'';
    if(appt && !appt.outcome && !['canceled','superseded'].includes(appt.state)) { const before=oa2StateView_(appt); appt.state='superseded'; appt.revision++; appt.updatedAt=ctx.now; oa2Event_(ctx,appt,'superseded',before,mode); }
    appt={id:'appt_'+oa2Hash_(record.leadId+'|after:'+previous),leadId:record.leadId,account:record.account,customerKey:record.customerKey,phone:record.phone,name:record.name,brand:record.brand,treatment:record.treatment,branch:record.branch,createdAt:oa2Date_(record.createdAt),date,time,bookedAt:genuineBooking?ctx.now:'',provenance:genuineBooking?'observed_booking_edit':'legacy_registration_unknown',state:date?'active':'unscheduled',outcome:'',arrivalDate:'',outcomeAt:'',revision:1,previousId:previous,queueId:'',lastStatus:status,lastSchedule:schedule,firstSeenAt:ctx.now,updatedAt:ctx.now,generatedArrivalDate:'',pendingArrivalOverride:'scheduled'};
    ctx.appointments[appt.id]=appt; record.appointmentId=appt.id;
    oa2Event_(ctx,appt,'registered',null,mode);
  } else if (appt) {
    const before=oa2StateView_(appt); let type='';
    if (status!=='booked' && status!=='show' && status!=='no_show' && ['active','unscheduled','reschedule_requested'].includes(appt.state)) { appt.state='canceled'; appt.revision++; type='canceled'; }
    else if (status==='booked' && ['active','unscheduled','reschedule_requested'].includes(appt.state) && (schedule!==appt.lastSchedule || appt.state==='unscheduled' && !!date && !appt.date)) { appt.date=date; appt.time=time; appt.state=date?'active':'unscheduled'; appt.revision++; type='rescheduled'; }
    if (type) { appt.updatedAt=ctx.now; oa2Event_(ctx,appt,type,before,mode); }
    appt.lastStatus=status; appt.lastSchedule=schedule;
  }
  if (appt) {
    // Descriptive corrections do not modify immutable booking registration or historical snapshots.
    record.appointmentId=appt.id; record.bookedAt=appt.bookedAt; record.outcome=appt.outcome || (appt.state==='canceled'?'取消':appt.state==='reschedule_requested'?'改期':''); record.outcomeAt=appt.outcomeAt;
  }
  return appt;
}
/** E is only a display default while pending. The registry's actual arrivalDate remains blank until Show. */
function oa2Due_(appt,today) { return ['active','unscheduled'].includes(appt.state) && !appt.outcome; }
/** Queue IDs are fixed strings, not row numbers; existing completed historical rows are never recreated. */
function oa2PlanQueue_(ctx,queueRows) {
  const byId={}; const duplicate=new Set();
  queueRows.forEach(q=> { if(q.appointmentId) { if(byId[q.appointmentId]) duplicate.add(q.appointmentId); else byId[q.appointmentId]=q; } });
  duplicate.forEach(id=>ctx.errors.push('Duplicate queue appointment ID '+id));
  const operations=[];
  Object.keys(ctx.appointments).forEach(id=> {
    const a=ctx.appointments[id], q=byId[id]; if(duplicate.has(id)) return;
    if(!a.outcome && a.provenance!=='legacy_show' && !a.pendingArrivalOverride && (q || oa2Due_(a,ctx.today)))oa2SetPendingArrivalDate_(ctx,a.id,'','queue_default_upgrade',true);
    if(q) { if(q.entryId!==a.queueId && !(q.origin==='allocating'&&!q.entryId)) {ctx.errors.push('Queue entry ID mismatch '+id);return;} if(q.origin==='allocating') { operations.push({kind:'append',appt:a,row:q.row,entryId:a.queueId,recovery:true,state:oa2QueueState_(a,ctx.today)}); } else if(q.origin!=='legacy_show') operations.push({kind:'refresh',appt:a,row:q.row,state:oa2QueueState_(a,ctx.today)}); }
    else if(a.queueId) { operations.push({kind:'append',appt:a,entryId:a.queueId,recovery:true,state:oa2QueueState_(a,ctx.today)}); }
    else if(oa2Due_(a,ctx.today)) { const entryId=ctx.id('arrival'); a.queueId=entryId; a.updatedAt=ctx.now; operations.push({kind:'append',appt:a,entryId,state:'待確認'}); oa2Event_(ctx,a,'queued',oa2StateView_(a),'sweep'); }
  });
  return operations;
}
function oa2WorkerPlanContext_(ctx,deferred) {
  const appointments={};Object.keys(ctx.appointments).forEach(id=>{if(!deferred.has(id))appointments[id]=ctx.appointments[id];});
  return Object.assign({},ctx,{appointments});
}

function oa2ProcessAccount_(ss,sheet,mode,edit,dryRun,trace) {
  const ctx=oa2Context_(ss,dryRun,trace),snap=omniEditStage_(trace,'account_snapshot',()=>oa2AccountSnapshot_(sheet,dryRun)),queue=omniEditStage_(trace,'arrival_queue_read',()=>oa2ReadQueue_(ss,dryRun));
  oa2ReplaySourceAnchors_(ctx,snap);oa2RehomeMovedAccountAppointments_(ss,ctx,snap);const deferred=oa2AbsorbWorkerQueueInputs_(ctx,queue),deferredLeadIds=new Set(Array.from(deferred,id=>ctx.appointments[id].leadId));snap.deferredRows=new Set();
  const duplicates={};snap.records.forEach(r=>{if(r.leadId){if(duplicates[r.leadId])ctx.errors.push('Duplicate Lead ID in '+sheet.getName());duplicates[r.leadId]=true;}});
  snap.records.forEach(r=>{
    if(!r.meaningful)return;if(oa2IsHistoricalCrossAccountRecord_(ctx,r)){snap.deferredRows.add(r.row);return;}if(deferred.has(r.appointmentId)||deferredLeadIds.has(r.leadId)){snap.deferredRows.add(r.row);return;} if(!r.leadId)r.leadId=ctx.id('lead');
    const touched=edit && r.row>=edit.firstRow && r.row<=edit.lastRow;
    if(touched) {r.bookingMutation=[snap.c.STATUS,snap.c.APPOINTMENT_DATE,snap.c.APPOINTMENT_TIME].some(c=>c>=edit.firstCol&&c<=edit.lastCol);r.forceNew=!!edit.forceNew;}
    // Arrival operations preserve every distinct source appointment, including repeat customers.
    // The person-level current selection remains unchanged for reporting projections.
    const visitStatus=oa2Status_(r.status);
    if(r.isCurrent || visitStatus==='show')oa2EnsureUnqueuedSourceShow_(ctx,r,queue);
    if(r.isCurrent || visitStatus==='booked' || visitStatus==='show' || r.appointmentId || (touched && r.bookingMutation))oa2ReconcileRecord_(ctx,r,touched?'edit':mode==='initialize'?'initialize':'scan');
  });
  const ops=oa2FilterQueueOps_(ctx,queue,oa2PlanQueue_(oa2WorkerPlanContext_(ctx,deferred),queue));
  const result={dryRun,account:sheet.getName(),records:snap.records.filter(r=>r.meaningful).length,appointments:Object.keys(ctx.appointments).length,newQueue:ops.filter(o=>o.kind==='append').length,changes:ctx.events.length,deferredQueueConflicts:deferred.size,deferredSourceRecords:snap.deferredRows.size,errors:ctx.errors};
  if(!dryRun)omniEditStage_(trace,'arrival_commit',()=>oa2Commit_(ss,ctx,queue,ops,[snap]));try{console.log(JSON.stringify({handler:'omni_arrival_reconciliation',dryRun,deferredReason:deferred.size?'schedule_changed_outside_account':'',deferredQueueConflicts:deferred.size,deferredSourceRecords:snap.deferredRows.size}));}catch(ignored){}return result;
}
function oa2QueueLabel_(a,record) {
  const bound=record&&record.account===a.account&&record.leadId===a.leadId;
  const key=oa2Text_(a.customerKey),email=key.indexOf(a.account+'|e:')===0?key.slice(a.account.length+3):bound&&record.email,social=key.indexOf(a.account+'|i:')===0?key.slice(a.account.length+3):bound&&record.social;
  const fullPhone=bound?oa2Text_(record.fullPhone):'',phone=oa2Text_(a.phone),verifiedPhone=/^\d{8}$/.test(phone)&&key===a.account+'|p:'+phone;
  const name=bound?oa2Text_(record.name):oa2Text_(a.name);
  return a.account+' · '+(fullPhone?'電話 '+fullPhone:verifiedPhone?'電話尾8 '+phone:email?'Email '+email:social?'IG/FB '+social:name?'客人 '+name:'未填聯絡資料');
}
