/** Pure transition baseline copied from the saved bound source; synthetic tests only. */
const OA2 = Object.freeze({
  VERSION: '2.0.1', TZ: 'Asia/Hong_Kong', ARRIVAL: '到店紀錄', HEADER_ROW: 7, FIRST_ROW: 8,
  LEDGER: '_appointment_registry', HISTORY: '_appointment_history', BATCH: 200,
  PROP: 'OMNI_ARRIVAL_V2_ENABLED', CURSOR: 'OMNI_ARRIVAL_V2_CURSOR',
  ACCOUNT_HEADERS: ['Omni Lead ID','Appointment ID','Booking Registered At','到店結果','到店結果更新時間','Pending Appointment Snapshot'],
  QUEUE_HEADERS: ['Appointment ID','Schedule Revision','Queue State','Outcome Recorded At','Omni Lead ID','Booking Registered At','Record Origin'],
  LEDGER_HEADERS: ['Appointment ID','Lead ID','Account','Customer Key','Phone Last8','Name','Brand','Treatment','Branch','Created At','Appointment Date','Appointment Time','Booking Registered At','Registration Provenance','State','Outcome','Arrival Date','Outcome Recorded At','Revision','Previous Appointment ID','Queue Entry ID','Last Seen Status','Last Seen Schedule','First Seen At','Updated At','Last Generated Arrival Date','Pending Queue Before','Pending Arrival Date Override'],
  HISTORY_HEADERS: ['Change ID','Changed At','Appointment ID','Lead ID','Change Type','Before','After','Source'],
});
const OA2_FIELDS = ['id','leadId','account','customerKey','phone','name','brand','treatment','branch','createdAt','date','time','bookedAt','provenance','state','outcome','arrivalDate','outcomeAt','revision','previousId','queueId','lastStatus','lastSchedule','firstSeenAt','updatedAt','generatedArrivalDate','pendingQueueBefore','pendingArrivalOverride'];
function oa2Text_(v) { return String(v == null ? '' : v).trim(); }
function oa2Date_(value) {
  if (value instanceof Date) return isNaN(value.getTime()) ? '' : Utilities.formatDate(value, OA2.TZ, 'yyyy-MM-dd');
  if (typeof value === 'number' && isFinite(value) && value >= 1 && value <= 100000) return new Date(Date.UTC(1899,11,30) + Math.floor(value)*86400000).toISOString().slice(0,10);
  const s = oa2Text_(value); let m;
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s)) { const d=new Date(s); return isNaN(d.getTime())?'':Utilities.formatDate(d,OA2.TZ,'yyyy-MM-dd'); }
  if ((m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/))) return oa2ValidDate_(+m[1],+m[2],+m[3]);
  if ((m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) return oa2ValidDate_(+m[3],+m[2],+m[1]);
  return '';
}
function oa2ValidDate_(y,m,d) { const v=new Date(Date.UTC(y,m-1,d)); return y>=1900 && y<=2200 && v.getUTCFullYear()===y && v.getUTCMonth()===m-1 && v.getUTCDate()===d ? v.toISOString().slice(0,10):''; }
function oa2Time_(v) {
  if (v instanceof Date) return isNaN(v.getTime())?'':Utilities.formatDate(v,OA2.TZ,'HH:mm');
  if (typeof v==='number' && v>=0 && v<1) { const n=Math.round(v*1440)%1440; return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0'); }
  const m=oa2Text_(v).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/); return m && +m[1]<24 && +m[2]<60?m[1].padStart(2,'0')+':'+m[2]:'';
}
function oa2Status_(v) { const s=oa2Text_(v).toLowerCase(); return ['已預約','booked','confirmed'].includes(s)?'booked':['已到店','show','show up','已完成','完成療程'].includes(s)?'show':['no show','noshow','no-show','未到店'].includes(s)?'no_show':s; }
function oa2Outcome_(v) { const s=oa2Status_(v); return s==='show'?'Show':s==='no_show'?'No Show':['','待到店'].includes(oa2Text_(v))?'':null; }
function oa2Clone_(v) { return JSON.parse(JSON.stringify(v)); }
function oa2Hash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(b=>((b+256)%256).toString(16).padStart(2,'0')).join('').slice(0,32); }
function oa2Event_(ctx, appt, type, before, source) {
  const after = {date:appt.date,time:appt.time,state:appt.state,outcome:appt.outcome,arrivalDate:appt.arrivalDate,pendingArrivalOverride:appt.pendingArrivalOverride||'',revision:appt.revision};
  const b=JSON.stringify(before || {}), a=JSON.stringify(after);
  ctx.events.push(['ac_'+oa2Hash_(appt.id+'|'+appt.revision+'|'+type+'|'+b+'|'+a),ctx.now,appt.id,appt.leadId,type,b,a,source]);
}
function oa2StateView_(a) { return {date:a.date,time:a.time,state:a.state,outcome:a.outcome,arrivalDate:a.arrivalDate,pendingArrivalOverride:a.pendingArrivalOverride||'',revision:a.revision}; }
/** Pure deterministic transition. Its context is an in-memory snapshot, never the live spreadsheet. */
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
    else if (status==='booked' && ['active','unscheduled','reschedule_requested'].includes(appt.state) && schedule!==appt.lastSchedule) { appt.date=date; appt.time=time; appt.state=date?'active':'unscheduled'; appt.revision++; type='rescheduled'; }
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
function oa2QueueArrivalDate_(a) {
  if(a.outcome==='Show')return a.arrivalDate;
  if(a.outcome || a.provenance==='legacy_show' || !['active','unscheduled','reschedule_requested'].includes(a.state))return '';
  const input=oa2Text_(a.pendingArrivalOverride);
  return input==='cleared'?'':oa2Date_(input)||a.date;
}
function oa2SetPendingArrivalDate_(ctx,id,value,source,automatic) {
  const a=ctx.appointments[id];if(!a)throw new Error('Unknown appointment ID');
  if(a.outcome || a.provenance==='legacy_show')throw new Error('Completed arrival evidence cannot receive a pending date default.');
  const date=oa2Date_(value);if(oa2Text_(value)&&!date)throw new Error('Invalid arrival date.');
  const input=automatic?'scheduled':date||'cleared';if(a.pendingArrivalOverride===input)return false;
  const before=oa2StateView_(a);a.pendingArrivalOverride=input;a.revision++;a.updatedAt=ctx.now;
  oa2Event_(ctx,a,automatic?'arrival_date_default_initialized':'pending_arrival_date_edited',before,source||'queue_edit');return true;
}
function oa2QueueState_(appt,today) {
  if (appt.state==='canceled') return '已取消';
  if (appt.state==='superseded') return '已另建預約（保留歷史）';
  if (appt.state==='reschedule_requested') return '改期：請更新Account預約日期時間';
  if (appt.outcome) return appt.outcome;
  if (!appt.date) return '待補預約日期';
  if (appt.date>today) return '已改期／未到期';
  return '待確認';
}
function oa2Due_(appt,today) { return appt.state==='active' && !appt.outcome && !!appt.date; }
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
function oa2SetOutcome_(ctx,apptId,value,arrivalDate,source) {
  const appt=ctx.appointments[apptId], outcome=oa2Outcome_(value);
  if(!appt) throw new Error('Unknown appointment ID; no outcome recorded.');
  if(outcome===null) throw new Error('Only Show / No Show / blank is supported.');
  if(outcome && (['canceled','superseded','reschedule_requested'].includes(appt.state) || !appt.date || appt.date>ctx.today) && appt.provenance!=='legacy_show') throw new Error('Canceled, unscheduled or future appointment cannot receive an outcome.');
  const supplied=oa2Date_(arrivalDate);
  if(oa2Text_(arrivalDate) && !supplied) throw new Error('Invalid arrival date.');
  if(outcome==='Show' && !supplied && appt.provenance!=='legacy_show')throw new Error('Enter an arrival date before marking Show; a cleared date is never guessed.');
  const date=outcome==='Show' ? (supplied || (appt.outcome==='Show'?appt.arrivalDate:'') || '') : '';
  if(date && date>ctx.today) throw new Error('Arrival date cannot be in the future.');
  if(appt.outcome===outcome && appt.arrivalDate===date) return false;
  const before=oa2StateView_(appt);
  if(outcome==='Show' && !appt.outcome && supplied!==oa2QueueArrivalDate_(appt))appt.pendingArrivalOverride=supplied;
  appt.revision++; appt.outcome=outcome; appt.arrivalDate=date; appt.outcomeAt=ctx.now; appt.updatedAt=ctx.now;
  appt.state=outcome?'completed':appt.date?'active':'unscheduled';
  appt.generatedArrivalDate=outcome==='Show' && appt.pendingArrivalOverride==='scheduled' && date===appt.date && appt.provenance!=='legacy_show'?date:'';
  oa2Event_(ctx,appt,outcome?'outcome_changed':'outcome_cleared',before,source||'queue_edit'); return true;
}
function oa2ImportLegacyShow_(ctx,q,record) {
  if(!q.entryId || !q.customerKey || oa2Outcome_(q.outcome)!=='Show') return null;
  const id='legacy_'+oa2Hash_(q.entryId);
  if(ctx.appointments[id]) return ctx.appointments[id];
  // No appointment/arrival/booking dates are guessed. Existing evidence is retained verbatim in A:S.
  const a={id,leadId:record?record.leadId:'legacy_'+oa2Hash_(q.entryId),account:q.account,customerKey:q.customerKey,phone:record?record.phone:(oa2Text_(q.customerKey).match(/\|p:(\d{8})$/)||[])[1]||'',name:record?record.name:'',brand:record?record.brand:'',treatment:q.treatment,branch:q.branch,createdAt:record?oa2Date_(record.createdAt):'',date:oa2Date_(q.date),time:oa2Time_(q.time),bookedAt:'',provenance:'legacy_show',state:'completed',outcome:'Show',arrivalDate:oa2Date_(q.arrivalDate),outcomeAt:'',revision:1,previousId:'',queueId:q.entryId,lastStatus:'show',lastSchedule:oa2Date_(q.date)+'|'+oa2Time_(q.time),firstSeenAt:ctx.now,updatedAt:ctx.now,generatedArrivalDate:''};
  ctx.appointments[id]=a; oa2Event_(ctx,a,'legacy_show_preserved',null,'migration'); return a;
}
/** Test oracle only. Native dashboard integration is separately reviewed.
 * Compatibility: one earliest retained lifetime stage date per person; repeat visits remain in registry detail.
 */
function oa2MetricPeople_(appointments,type,start,end) {
  const first={};
  Object.keys(appointments).forEach(id=>{const a=appointments[id];let day='';if(type==='book')day=oa2Date_(a.bookedAt);else if(type==='show'&&a.outcome==='Show')day=a.arrivalDate;else if(type==='no_show'&&a.outcome==='No Show')day=a.date;
    const digits=oa2Text_(a.phone).replace(/\D/g,''),key=digits.length>=8?a.account+'|'+digits.slice(-8):a.account+'|lead:'+(a.leadId||a.id||id);
    if(day&&(!first[key]||day<first[key]))first[key]=day;
  });return Object.keys(first).filter(key=>first[key]>=start&&first[key]<=end).length;
}

function oa2QueueAction_(ctx,apptId,action) {
  const a=ctx.appointments[apptId]; if(!a) throw new Error('Unknown appointment ID');
  if(a.outcome) throw new Error('Clear the outcome before canceling or rescheduling this appointment.');
  const state=action==='取消'?'canceled':action==='改期'?'reschedule_requested':action==='待到店'?(a.date?'active':'unscheduled'):null;
  if(!state) throw new Error('Unsupported appointment action'); if(a.state===state) return false;
  const before=oa2StateView_(a); a.revision++; a.state=state; a.updatedAt=ctx.now;
  oa2Event_(ctx,a,action==='取消'?'canceled':action==='改期'?'reschedule_requested':'pending_restored',before,'queue_edit'); return true;
}


function oa2QueueInputState_(q){return JSON.stringify([oa2Date_(q.date),oa2Time_(q.time),oa2Text_(q.outcome),oa2Date_(q.arrivalDate)]);}
/** Compare calendar/time meaning across native Date and numeric time readbacks; invalid inputs still differ. */
function oa2AbsorbQueueInputs_(ctx,queue) {
  queue.forEach(q=>{
    if(!q.appointmentId)return;
    if(q.origin==='allocating' && q.raw.slice(0,6).every(v=>!oa2Text_(v)))return;
    const a=ctx.appointments[q.appointmentId];if(!a){ctx.errors.push('Unknown queue appointment ID '+q.appointmentId);return;}
    if(q.entryId!==a.queueId && !(q.origin==='allocating'&&!q.entryId)){ctx.errors.push('Queue identity mismatch '+q.appointmentId);return;}
    // A persisted before-image distinguishes an unfinished script refresh from a new staff edit.
    if(a.pendingQueueBefore && a.pendingQueueBefore===oa2QueueInputState_(q))return;
    const actual=oa2Text_(q.outcome),expected=oa2QueueStatus_(a),display=oa2QueueArrivalDate_(a);
    // A pending input changes only its display provenance, never actual arrival evidence or outcome time.
    if(!a.outcome && a.provenance!=='legacy_show' && (oa2Outcome_(actual)==='' || actual==='改期') && (oa2Date_(q.arrivalDate)!==display || (oa2Text_(q.arrivalDate)&&!oa2Date_(q.arrivalDate)))) {
      try {if(a.pendingArrivalOverride || oa2Text_(q.arrivalDate))oa2SetPendingArrivalDate_(ctx,a.id,q.arrivalDate,'queue_reconciliation',false);}
      catch(e){ctx.errors.push('Arrival row '+q.row+': '+e.message);}
    }
    if(actual!==expected || (a.outcome && oa2Date_(q.arrivalDate)!==a.arrivalDate)) {
      try {if(['取消','改期'].includes(actual) || (actual==='待到店' && ['canceled','reschedule_requested'].includes(a.state)))oa2QueueAction_(ctx,a.id,actual);else oa2SetOutcome_(ctx,a.id,actual,q.arrivalDate,'queue_reconciliation');}
      catch(e){ctx.errors.push('Arrival row '+q.row+': '+e.message);}
    }
    if(q.origin==='managed' && (oa2Date_(q.date)!==a.date || oa2Time_(q.time)!==a.time))ctx.errors.push('Arrival row '+q.row+': schedule changed outside Account; review rather than overwrite.');
  });
}
function oa2AbsorbWorkerQueueInputs_(ctx,queue) {
  const seen=new Set(),deferred=new Set();
  queue.forEach(q=>{
    if(!q.appointmentId)return;
    if(seen.has(q.appointmentId))ctx.errors.push('Duplicate queue appointment ID '+q.appointmentId);
    seen.add(q.appointmentId);
    const a=ctx.appointments[q.appointmentId];
    if(!a)ctx.errors.push('Unknown queue appointment ID '+q.appointmentId);
    else if(q.entryId!==a.queueId && !(q.origin==='allocating'&&!q.entryId))ctx.errors.push('Queue identity mismatch '+q.appointmentId);
  });
  if(ctx.errors.length)return deferred;
  queue.forEach(q=>{
    if(!q.appointmentId)return;
    const id=q.appointmentId,a=ctx.appointments[id];
    const recoveringBefore=a.pendingQueueBefore&&a.pendingQueueBefore===oa2QueueInputState_(q);
    if(q.origin==='managed'&&!recoveringBefore&&(oa2Date_(q.date)!==a.date||oa2Time_(q.time)!==a.time)){deferred.add(id);return;}
    const staged=Object.assign({},ctx,{appointments:{},events:[],errors:[]});
    staged.appointments[id]=oa2Clone_(ctx.appointments[id]);
    oa2AbsorbQueueInputs_(staged,[q]);
    if(staged.errors.length){ctx.errors.push(...staged.errors);return;}
    ctx.appointments[id]=staged.appointments[id];
    ctx.events.push(...staged.events);
  });
  return deferred;
}
function oa2QueueStatus_(a) {return a.outcome==='Show'?'已到店':a.outcome || (a.state==='canceled'?'取消':a.state==='reschedule_requested'?'改期':'待到店');}